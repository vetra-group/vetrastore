import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { CmsError } from "./validation";
import { configuredSessionSecret, createStaffSession, passwordAuthConfigured, readStaffSession, revokeStaffSession, verifyStaff, type StaffIdentity } from "./staff-auth";

export const CMS_COOKIE = "vetra-cms-session";
const sessionSeconds = 8 * 60 * 60;
export function cmsMode(): "local" | "configured" | "unavailable" {
  if (process.env.CMS_AUTH_MODE === "password") {
    const durable = process.env.CMS_STORAGE === "mongodb" && process.env.MONGODB_URI && process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;
    const local = process.env.NEXT_PUBLIC_DEMO_MODE === "true" && !process.env.VERCEL && process.env.CMS_STORAGE !== "mongodb";
    return passwordAuthConfigured() && (durable || local) ? "configured" : "unavailable";
  }
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true" && !process.env.VERCEL && process.env.CMS_STORAGE !== "mongodb" ? "local" : "unavailable";
}
export function cmsDirectory() { return path.resolve(/* turbopackIgnore: true */ process.env.CMS_LOCAL_DATA_DIR || path.join(process.cwd(), ".local", "cms")); }
async function secret() {
  if (cmsMode() === "configured") return configuredSessionSecret();
  const directory = cmsDirectory();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const filename = path.join(directory, "session-secret");
  try {
    const value = await readFile(filename, "utf8");
    if (!/^[a-f0-9]{64}$/.test(value)) throw new CmsError("The local CMS session secret needs repair.", 503, "CMS_AUTH_UNAVAILABLE");
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const value = randomBytes(32).toString("hex");
    try { await writeFile(filename, value, { flag: "wx", mode: 0o600 }); return value; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; return await readFile(filename, "utf8"); }
  }
}
function sign(payload: string, key: string) { return createHmac("sha256", key).update(payload).digest("base64url"); }
type SessionPayload = { scope: string; nonce: string; exp: number };
function readToken(token: string, key: string): SessionPayload | null {
  if (!token || token.length > 900) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !/^[a-zA-Z0-9_-]+$/.test(parts[0]) || !/^[a-zA-Z0-9_-]+$/.test(parts[1])) return null;
  const expected = Buffer.from(sign(parts[0], key)), actual = Buffer.from(parts[1]);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    return typeof payload.nonce === "string" && Number.isInteger(payload.exp) && payload.exp > Date.now() && payload.exp <= Date.now() + (sessionSeconds + 60) * 1000 ? payload : null;
  } catch { return null; }
}
export function verifySessionToken(token: string, key: string, now = Date.now()) {
  if (!token || token.length > 300) return false;
  const parts = token.split(".");
  if (parts.length !== 2 || !/^[a-zA-Z0-9_-]+$/.test(parts[0]) || !/^[a-zA-Z0-9_-]+$/.test(parts[1])) return false;
  const expected = Buffer.from(sign(parts[0], key)), actual = Buffer.from(parts[1]);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    return payload.scope === "local-cms" && typeof payload.nonce === "string" && payload.nonce.length === 32 && Number.isInteger(payload.exp) && payload.exp > now && payload.exp <= now + (sessionSeconds + 60) * 1000;
  } catch { return false; }
}
export function issueSessionToken(key: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ scope: "local-cms", nonce: randomBytes(16).toString("hex"), exp: now + sessionSeconds * 1000 })).toString("base64url");
  return `${payload}.${sign(payload, key)}`;
}
function actualRequestUrl(request: Request): URL {
  const url = new URL(request.url);
  const host = request.headers.get("host") || url.host;
  if (!host || /[\s/\\@?#]/.test(host)) throw new Error("Invalid request host");
  const actual = new URL(`${url.protocol}//${host}`);
  if (actual.username || actual.password || actual.pathname !== "/") throw new Error("Invalid request host");
  return actual;
}
export function isLocalCmsRequest(request: Request) {
  try { const loopback = ["localhost", "127.0.0.1", "[::1]", "::1"]; return loopback.includes(actualRequestUrl(request).hostname) && loopback.includes(new URL(request.url).hostname); } catch { return false; }
}
async function sessionOwner(request: Request): Promise<string | null> {
  if (!await cmsIdentity(request)) return null;
  return createHash("sha256").update(requestToken(request)).digest("hex");
}
function requestToken(request: Request) {
  const cookie = request.headers.get("cookie")?.split(";").map((entry) => entry.trim()).find((entry) => entry.startsWith(`${CMS_COOKIE}=`));
  return cookie?.slice(CMS_COOKIE.length + 1) ?? "";
}
export function isAllowedCmsRequest(request: Request) {
  if (cmsMode() === "local") return isLocalCmsRequest(request);
  if (cmsMode() !== "configured") return false;
  if (!process.env.VERCEL && isLocalCmsRequest(request)) return true;
  try { const expected = new URL(process.env.NEXT_PUBLIC_SITE_URL || ""); return expected.protocol === "https:" && actualRequestUrl(request).origin === expected.origin; } catch { return false; }
}
export async function cmsIdentity(request: Request): Promise<StaffIdentity | null> {
  if (!isAllowedCmsRequest(request)) return null;
  const token = requestToken(request);
  if (!token) return null;
  const key = await secret();
  if (cmsMode() === "local") return verifySessionToken(token, key) ? { id: "local", name: "Local CMS editor", role: "owner" } : null;
  const payload = readToken(token, key);
  return payload?.scope === "staff-cms" ? readStaffSession(payload.nonce) : null;
}
export async function authenticated(request: Request) { return Boolean(await sessionOwner(request)); }
export function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  try {
    if (!origin || new URL(origin).origin !== actualRequestUrl(request).origin || request.headers.get("sec-fetch-site") === "cross-site") throw new Error("origin");
  } catch { throw new CmsError("This request must come from the local CMS.", 403, "INVALID_ORIGIN"); }
}
export async function authorizeCms(request: Request, write = false) {
  if (!isAllowedCmsRequest(request)) throw new CmsError("CMS storage is not configured for this environment.", 503, "CMS_UNAVAILABLE");
  if (write) assertOrigin(request);
  const owner = await sessionOwner(request);
  if (!owner) throw new CmsError("Sign in to the local CMS to continue.", 401, "UNAUTHENTICATED");
  return owner;
}
const actorContext = new AsyncLocalStorage<StaffIdentity>();
export function cmsActor() { const identity = actorContext.getStore(); return identity ? `${identity.name} (${identity.id})` : "Local CMS editor"; }
export function cmsStaffId() { return actorContext.getStore()?.id ?? (cmsMode() === "local" ? "local" : undefined); }
export function cmsMediaOwner() { const identity = cmsStaffId(); if (!identity) throw new CmsError("Sign in to continue.", 401, "UNAUTHENTICATED"); return createHash("sha256").update(`cms-media-staff:${identity}`).digest("hex"); }
export function cmsRole() { return actorContext.getStore()?.role ?? (cmsMode() === "local" ? "owner" : undefined); }
export function assertCmsOwner() { if (cmsRole() !== "owner") throw new CmsError("An owner account is required for this action.", 403, "FORBIDDEN"); }
export async function authorizeCmsPermission(request: Request, permission: "edit" | "publish" | "admin") {
  const identity = await cmsIdentity(request);
  if (!identity) throw new CmsError("Sign in to continue.", 401, "UNAUTHENTICATED");
  if (permission !== "edit" && identity.role !== "owner") throw new CmsError("An owner account is required for this action.", 403, "FORBIDDEN");
  return identity;
}
export async function withCmsIdentity<T>(request: Request, write: boolean, task: (owner: string) => Promise<T>, permission: "edit" | "publish" | "admin" = "edit") {
  const owner = await authorizeCms(request, write);
  const identity = await authorizeCmsPermission(request, permission);
  return actorContext.run(identity, () => task(owner));
}
export async function sessionCookie(request: Request, credentials?: { email?: unknown; password?: unknown }) {
  const secure = !isLocalCmsRequest(request) || new URL(request.url).protocol === "https:" ? "; Secure" : "";
  if (cmsMode() === "configured") {
    const staff = await verifyStaff(credentials?.email, credentials?.password);
    const exp = Date.now() + sessionSeconds * 1000;
    const session = await createStaffSession(staff, new Date(exp));
    const payload = Buffer.from(JSON.stringify({ scope: "staff-cms", nonce: session.nonce, exp })).toString("base64url");
    return `${CMS_COOKIE}=${payload}.${sign(payload, await secret())}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionSeconds}${secure}`;
  }
  return `${CMS_COOKIE}=${issueSessionToken(await secret())}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionSeconds}${secure}`;
}
export async function revokeSession(request: Request) {
  if (cmsMode() === "configured") { const payload = readToken(requestToken(request), await secret()); if (payload?.scope === "staff-cms") await revokeStaffSession(payload.nonce); }
}
export function expiredSessionCookie() { return `${CMS_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`; }
export async function boundedBody(request: Request, limit: number): Promise<Uint8Array> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > limit)) throw new CmsError("This submission is too large.", 413, "BODY_TOO_LARGE");
  const reader = request.body?.getReader();
  if (!reader) throw new CmsError("The submission is empty.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > limit) { await reader.cancel(); throw new CmsError("This submission is too large.", 413, "BODY_TOO_LARGE"); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}
export async function readCmsJson(request: Request, limit = 2 * 1024 * 1024): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new CmsError("Send JSON content.", 415, "CONTENT_TYPE");
  const bytes = await boundedBody(request, limit);
  try { const body: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>; }
  catch { /* The invalid body is reported below. */ }
  throw new CmsError("The JSON submission is invalid.");
}
export function cmsErrorResponse(error: unknown): Response {
  if (error instanceof CmsError) return Response.json({ error: error.message, code: error.code }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  console.error("CMS request failed", error);
  return Response.json({ error: "The CMS could not complete this request. Your previous data is preserved; try again.", code: "CMS_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

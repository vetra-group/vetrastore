import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDb } from "@/lib/db";
import { CmsError } from "./validation";

const scrypt = promisify(scryptCallback);
export type StaffIdentity = { id: string; name: string; role: "owner" | "editor" };
type Staff = StaffIdentity & { email: string; passwordHash: string; sessionVersion: number };
type Session = { _id: string; staffId: string; sessionVersion: number; expiresAt: Date };
const localDirectory = () => path.resolve(/* turbopackIgnore: true */ process.env.CMS_LOCAL_DATA_DIR || path.join(process.cwd(), ".local", "cms"), "sessions");

function accounts(): Staff[] {
  try {
    const values: unknown = JSON.parse(process.env.CMS_STAFF_ACCOUNTS || "[]");
    if (!Array.isArray(values) || !values.length || values.length > 30) throw new Error();
    const ids = new Set(), emails = new Set();
    for (const staff of values) {
      if (!staff || !/^[a-zA-Z0-9_-]{1,80}$/.test(staff.id) || typeof staff.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staff.email) || typeof staff.name !== "string" || !staff.name.trim() || staff.name.length > 100 || !["owner", "editor"].includes(staff.role) || !/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(staff.passwordHash) || !Number.isSafeInteger(staff.sessionVersion) || staff.sessionVersion < 1 || ids.has(staff.id) || emails.has(staff.email.toLowerCase())) throw new Error();
      ids.add(staff.id); emails.add(staff.email.toLowerCase());
    }
    if (!values.some((staff) => staff.role === "owner")) throw new Error();
    return values;
  } catch { throw new CmsError("Staff authentication configuration needs attention.", 503, "CMS_AUTH_UNAVAILABLE"); }
}
export function passwordAuthConfigured() {
  if (process.env.CMS_AUTH_MODE !== "password") return false;
  return Boolean(process.env.CMS_SESSION_SECRET && process.env.CMS_SESSION_SECRET.length >= 64 && process.env.CMS_STAFF_ACCOUNTS);
}
export function configuredSessionSecret() {
  if (!passwordAuthConfigured()) throw new CmsError("Staff authentication is not configured.", 503, "CMS_AUTH_UNAVAILABLE");
  return process.env.CMS_SESSION_SECRET!;
}
export async function limitStaffLogin(email: unknown, request: Request) {
  if (process.env.CMS_STORAGE !== "mongodb") return;
  const database = await getDb();
  if (!database) throw new CmsError("Sign-in is temporarily unavailable.", 503);
  const bucket = Math.floor(Date.now() / (15 * 60 * 1000));
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 100) || "unknown";
  const account = typeof email === "string" ? email.trim().toLowerCase().slice(0, 200) : "invalid";
  const counters = database.collection<{ _id: string; attempts: number; expiresAt: Date }>("cms_login_limits");
  for (const [scope, limit] of [[`account:${account}`, 10], [`address:${ip}`, 30]] as const) {
    const id = createHash("sha256").update(`${scope}:${bucket}`).digest("hex");
    const result = await counters.findOneAndUpdate({ _id: id }, { $inc: { attempts: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * 15 * 60 * 1000) } }, { upsert: true, returnDocument: "after" });
    if (!result || result.attempts > limit) throw new CmsError("Too many sign-in attempts. Please try again in 15 minutes.", 429, "RATE_LIMITED");
  }
}
export async function verifyStaff(email: unknown, password: unknown): Promise<Staff> {
  if (typeof email !== "string" || email.length > 200 || typeof password !== "string" || password.length < 1 || password.length > 256) throw new CmsError("Check your email and password.", 401, "INVALID_CREDENTIALS");
  const staff = accounts().find((entry) => entry.email.toLowerCase() === email.trim().toLowerCase());
  // Always run the same expensive hash operation, including unknown accounts.
  const [, salt, expected] = (staff?.passwordHash ?? `scrypt$${"0".repeat(32)}$${"0".repeat(128)}`).split("$");
  const hash = await scrypt(password, salt, 64) as Buffer;
  if (!timingSafeEqual(hash, Buffer.from(expected, "hex")) || !staff) throw new CmsError("Check your email and password.", 401, "INVALID_CREDENTIALS");
  return staff;
}
function identity(staff: Staff): StaffIdentity { return { id: staff.id, name: staff.name, role: staff.role }; }
export async function createStaffSession(staff: Staff, expiresAt: Date) {
  const nonce = randomBytes(32).toString("hex");
  const session: Session = { _id: createHash("sha256").update(nonce).digest("hex"), staffId: staff.id, sessionVersion: staff.sessionVersion, expiresAt };
  if (process.env.CMS_STORAGE === "mongodb") {
    const db = await getDb();
    if (!db) throw new CmsError("Staff session storage is unavailable.", 503);
    await db.collection<Session>("cms_sessions").insertOne(session);
  } else {
    await mkdir(localDirectory(), { recursive: true, mode: 0o700 });
    await writeFile(path.join(localDirectory(), `${session._id}.json`), JSON.stringify(session), { flag: "wx", mode: 0o600 });
  }
  return { nonce, identity: identity(staff) };
}
export async function readStaffSession(nonce: string): Promise<StaffIdentity | null> {
  if (!/^[a-f0-9]{64}$/.test(nonce)) return null;
  const id = createHash("sha256").update(nonce).digest("hex");
  let session: Session | null;
  if (process.env.CMS_STORAGE === "mongodb") {
    const db = await getDb();
    if (!db) return null;
    session = await db.collection<Session>("cms_sessions").findOne({ _id: id, expiresAt: { $gt: new Date() } });
  } else {
    try { session = JSON.parse(await readFile(path.join(localDirectory(), `${id}.json`), "utf8")); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  }
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) return null;
  const staff = accounts().find((entry) => entry.id === session.staffId && entry.sessionVersion === session.sessionVersion);
  return staff ? identity(staff) : null;
}
export async function revokeStaffSession(nonce: string) {
  if (!/^[a-f0-9]{64}$/.test(nonce)) return;
  const id = createHash("sha256").update(nonce).digest("hex");
  if (process.env.CMS_STORAGE === "mongodb") {
    const db = await getDb();
    if (!db) throw new CmsError("Sign-out could not be confirmed. Please retry.", 503);
    await db.collection<Session>("cms_sessions").deleteOne({ _id: id });
  } else {
    await unlink(path.join(localDirectory(), `${id}.json`)).catch((error) => { if (error.code !== "ENOENT") throw error; });
  }
}

import * as fs from "node:fs/promises";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import type { ClientSession } from "mongodb";
import { getDb, getMongoClient } from "@/lib/db";
import { CmsError } from "./validation";
import { deletePrivateImage, downloadPrivateImage, uploadPrivateImage } from "./cloudinary-storage";

type StoredFile = { _id: string; text?: string; media?: boolean; ready?: boolean; size: number; hash: string; updatedAt: Date };
type Lock = { _id: string; owner: string; expiresAt: Date };
const context = new AsyncLocalStorage<{ owner: string }>();
export const remoteCmsStorage = () => process.env.CMS_STORAGE === "mongodb";
const directory = () => path.resolve(/* turbopackIgnore: true */ process.env.CMS_LOCAL_DATA_DIR || path.join(process.cwd(), ".local", "cms"));
function remoteKey(filename: string) {
  if (!remoteCmsStorage()) return null;
  const relative = path.relative(directory(), path.resolve(filename));
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  const key = relative.split(path.sep).join("/");
  if (!/^[a-zA-Z0-9_.\/-]+$/.test(key) || key.split("/").some((part) => part === "..")) throw new CmsError("Invalid CMS storage path.");
  return key;
}
async function db() { const value = await getDb(); if (!value) throw new CmsError("CMS database is not configured.", 503, "CMS_UNAVAILABLE"); return value; }
const absent = () => Object.assign(new Error("CMS file not found"), { code: "ENOENT" });
async function document(key: string) { const value = await (await db()).collection<StoredFile>("cms_files").findOne({ _id: key }); if (!value) throw absent(); return value; }

/** Fenced database mutations prevent a worker with an expired lease committing. */
async function mutate<T>(task: (session: ClientSession) => Promise<T>) {
  const owner = context.getStore()?.owner;
  if (!owner) throw new CmsError("A CMS write lock is required.", 503, "CMS_BUSY");
  const client = await getMongoClient(); if (!client) throw new CmsError("CMS database unavailable.", 503);
  const session = client.startSession();
  try {
    return await session.withTransaction(async () => {
      const lock = await (await db()).collection<Lock>("cms_locks").findOneAndUpdate({ _id: "content", owner, expiresAt: { $gt: new Date() } }, { $set: { expiresAt: new Date(Date.now() + 120000) } }, { session, returnDocument: "after" });
      if (!lock) throw new CmsError("The write session expired. Reload before saving again.", 409, "CMS_LOCK_EXPIRED");
      return task(session);
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, maxCommitTimeMS: 10000 });
  } finally { await session.endSession(); }
}
export async function withRemoteCmsLock<T>(task: () => Promise<T>): Promise<T> {
  const collection = (await db()).collection<Lock>("cms_locks"), owner = randomUUID();
  try { await collection.insertOne({ _id: "content", owner, expiresAt: new Date(Date.now() + 120000) }); }
  catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const lock = await collection.findOneAndUpdate({ _id: "content", expiresAt: { $lte: new Date() } }, { $set: { owner, expiresAt: new Date(Date.now() + 120000) } }, { returnDocument: "after" });
    if (!lock) throw new CmsError("Another CMS save is in progress. Try again shortly.", 503, "CMS_BUSY");
  }
  const timer = setInterval(() => { void collection.updateOne({ _id: "content", owner, expiresAt: { $gt: new Date() } }, { $set: { expiresAt: new Date(Date.now() + 120000) } }).catch(() => undefined); }, 30000);
  timer.unref();
  try { return await context.run({ owner }, task); }
  finally { clearInterval(timer); await collection.deleteOne({ _id: "content", owner }).catch(() => undefined); }
}
export async function readFile(filename: string, encoding: "utf8"): Promise<string>;
export async function readFile(filename: string): Promise<Buffer>;
export async function readFile(filename: string, encoding?: "utf8"): Promise<string | Buffer> {
  const key = remoteKey(filename);
  if (!key) return encoding ? fs.readFile(filename, encoding) : fs.readFile(filename);
  const entry = await document(key);
  const bytes = entry.media ? await downloadPrivateImage(path.basename(key)) : Buffer.from(entry.text ?? "", "utf8");
  if (bytes.length !== entry.size || createHash("sha256").update(bytes).digest("hex") !== entry.hash) throw new CmsError("Stored CMS data failed its integrity check. It has been preserved.", 503, "CMS_STORAGE_INVALID");
  return encoding ? bytes.toString(encoding) : bytes;
}
export async function stat(filename: string) {
  const key = remoteKey(filename);
  if (!key) return fs.stat(filename);
  const entry = await document(key);
  if (entry.media && !entry.ready) await downloadPrivateImage(path.basename(key));
  return { size: entry.size, isFile: () => true, isDirectory: () => false };
}

/** This metadata probe is authoritative even when a public content cache exists.
 * MongoDB explicitly excludes the large state text from this read. */
export async function fileVersion(filename: string): Promise<{ version: string; size: number }> {
  const key = remoteKey(filename);
  if (!key) {
    const entry = await fs.stat(filename, { bigint: true });
    return { version: `${entry.dev}:${entry.ino}:${entry.size}:${entry.mtimeNs}:${entry.ctimeNs}`, size: Number(entry.size) };
  }
  const entry = await (await db()).collection<StoredFile>("cms_files").findOne({ _id: key }, { projection: { hash: 1, size: 1 } });
  if (!entry) throw absent();
  if (!/^[a-f0-9]{64}$/.test(entry.hash) || !Number.isSafeInteger(entry.size) || entry.size < 0) throw new CmsError("CMS storage metadata is invalid.", 503, "CMS_STORAGE_INVALID");
  return { version: entry.hash, size: entry.size };
}
type FileEntry = { name: string; isFile: () => boolean; isDirectory: () => boolean };
export async function readdir(filename: string): Promise<string[]>;
export async function readdir(filename: string, options: { withFileTypes: true }): Promise<FileEntry[]>;
export async function readdir(filename: string, options?: { withFileTypes: true }): Promise<string[] | FileEntry[]> {
  const key = remoteKey(path.join(filename, "placeholder"));
  if (!key) return options ? fs.readdir(filename, options) : fs.readdir(filename);
  const prefix = key.slice(0, -"placeholder".length);
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const entries = await (await db()).collection<StoredFile>("cms_files").find({ _id: { $regex: `^${escaped}[^/]+$` } }, { projection: { _id: 1 } }).limit(15001).toArray();
  if (entries.length > 15000) throw new CmsError("This storage folder exceeds the safe listing limit. No files were removed.", 503, "CMS_STORAGE_CAPACITY");
  const names = entries.map((entry) => entry._id.slice(prefix.length));
  return options ? names.map((name) => ({ name, isFile: () => true, isDirectory: () => false })) : names;
}
export async function mkdir(filename: string, options: { recursive: true; mode?: number }) {
  if (remoteCmsStorage() && (path.resolve(filename) === directory() || remoteKey(path.join(filename, "placeholder")))) return;
  await fs.mkdir(filename, options);
}
export async function atomicFile(filename: string, value: string | Uint8Array) {
  const key = remoteKey(filename);
  if (!key) {
    await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
    const temporary = `${filename}.${randomUUID()}.tmp`; let committed = false;
    try { const file = await fs.open(temporary, "wx", 0o600); try { await file.writeFile(value); await file.sync(); } finally { await file.close(); } await fs.rename(temporary, filename); committed = true; }
    finally { if (!committed) await fs.unlink(temporary).catch(() => undefined); }
    return;
  }
  const bytes = typeof value === "string" ? Buffer.from(value) : Buffer.from(value);
  const media = /^media\/[a-f0-9]{64}\.(jpg|png|webp|gif)$/.test(key);
  if (bytes.length > (media ? 5 : 12) * 1024 * 1024) throw new CmsError("This CMS file exceeds the durable storage limit. Existing data is preserved.", 413, "CMS_STORAGE_CAPACITY");
  const entry: StoredFile = { _id: key, size: bytes.length, hash: createHash("sha256").update(bytes).digest("hex"), updatedAt: new Date(), ...(media ? { media: true, ready: false } : { text: bytes.toString("utf8") }) };
  // Save a durable intent before the provider call so interrupted uploads are discoverable.
  await mutate(async (session) => (await db()).collection<StoredFile>("cms_files").replaceOne({ _id: key }, entry, { session, upsert: true }));
  if (media) {
    await uploadPrivateImage(path.basename(key), bytes);
    await mutate(async (session) => (await db()).collection<StoredFile>("cms_files").updateOne({ _id: key, hash: entry.hash }, { $set: { ready: true } }, { session }));
  }
}

/** A public projection is bound to the exact committed state, never a draft.
 * Remote writes commit both documents in the same fenced transaction. Locally,
 * readers check the state version before using the sidecar; an interrupted
 * sidecar write falls back to the committed state's published field. */
export async function atomicStateAndPublished(filename: string, value: string, content: unknown) {
  const key = remoteKey(filename), projectionPath = path.join(path.dirname(filename), "published.json");
  const hash = createHash("sha256").update(JSON.stringify(content)).digest("hex");
  if (!key) {
    await atomicFile(filename, value);
    const { version } = await fileVersion(filename);
    try { await atomicFile(projectionPath, JSON.stringify({ version: 1, sourceVersion: version, hash, content })); }
    catch (error) { console.error("The CMS save committed; its public projection will be read from the committed snapshot until the next save.", error); }
    return;
  }
  const textEntry = (id: string, text: string): StoredFile => {
    const bytes = Buffer.byteLength(text);
    if (bytes > 12 * 1024 * 1024) throw new CmsError("This CMS file exceeds the durable storage limit. Existing data is preserved.", 413, "CMS_STORAGE_CAPACITY");
    return { _id: id, text, size: bytes, hash: createHash("sha256").update(text).digest("hex"), updatedAt: new Date() };
  };
  const state = textEntry(key, value);
  const projectionKey = remoteKey(projectionPath)!;
  const projection = textEntry(projectionKey, JSON.stringify({ version: 1, sourceVersion: state.hash, hash, content }));
  await mutate(async (session) => {
    const collection = (await db()).collection<StoredFile>("cms_files");
    await collection.replaceOne({ _id: key }, state, { session, upsert: true });
    await collection.replaceOne({ _id: projectionKey }, projection, { session, upsert: true });
  });
}
export async function unlink(filename: string) {
  const key = remoteKey(filename);
  if (!key) return fs.unlink(filename);
  const entry = await document(key);
  if (entry.media) {
    // Refresh and verify the lease immediately before bounded external deletion.
    await mutate(async () => undefined);
    await deletePrivateImage(path.basename(key));
  }
  await mutate(async (session) => (await db()).collection<StoredFile>("cms_files").deleteOne({ _id: key, hash: entry.hash }, { session }));
}

/** Backup discovery reads storage metadata only, never remote image bytes. */
export async function listFileMetadata(filename: string): Promise<{ name: string; bytes: number; hash?: string; ready: boolean }[]> {
  const key = remoteKey(path.join(filename, "placeholder"));
  if (!key) {
    let entries;
    try { entries = await fs.readdir(filename, { withFileTypes: true }); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
    return Promise.all(entries.filter((entry) => entry.isFile()).map(async (entry) => ({ name: entry.name, bytes: (await fs.stat(path.join(filename, entry.name))).size, ready: true })));
  }
  const prefix = key.slice(0, -"placeholder".length), escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const entries = await (await db()).collection<StoredFile>("cms_files").find({ _id: { $regex: `^${escaped}[^/]+$` } }, { projection: { _id: 1, size: 1, hash: 1, ready: 1 } }).limit(10001).toArray();
  if (entries.length > 10000) throw new CmsError("This backup has too many media files.", 413, "BACKUP_TOO_LARGE");
  return entries.map((entry) => ({ name: entry._id.slice(prefix.length), bytes: entry.size, hash: entry.hash, ready: entry.ready !== false }));
}

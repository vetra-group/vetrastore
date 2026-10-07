import { open, readFile, mkdir, rename, unlink, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { ClientSession, Db, Document } from "mongodb";
import { cmsDirectory, cmsMode } from "../cms/auth";
import { CmsError } from "../cms/validation";
import { getDb, getMongoClient } from "../db";
import type { OperationsQuery, OperationsRepository, OperationsTable, OperationsTables, OperationsTransaction } from "./types";

export const OPERATIONS_PAGE_SIZE = 20;
type LocalState = { version: 1; tables: { [K in OperationsTable]: Record<string, OperationsTables[K]> } };
const empty = (): LocalState => ({ version: 1, tables: { requests: {}, inventory: {}, outbox: {}, settings: {}, commands: {}, deliveries: {} } });
function allowed() { if (cmsMode() === "unavailable") throw new CmsError("Operations storage is not configured.", 503, "OPERATIONS_UNAVAILABLE"); }
function localPath() { return path.join(cmsDirectory(), "operations.json"); }
async function readLocal(): Promise<LocalState> {
  try {
    if ((await stat(localPath())).size > 24 * 1024 * 1024) throw new Error("capacity");
    const value = JSON.parse(await readFile(localPath(), "utf8")) as LocalState;
    if (value.version !== 1 || !value.tables || Object.keys(empty().tables).some((key) => !value.tables[key as OperationsTable] || typeof value.tables[key as OperationsTable] !== "object" || Array.isArray(value.tables[key as OperationsTable]))) throw new Error("invalid");
    return value;
  } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return empty(); throw new CmsError("Saved operations data could not be read. It has been preserved.", 503, "OPERATIONS_STORAGE_INVALID"); }
}
async function localTransaction<T>(task: (tx: OperationsTransaction) => Promise<T>): Promise<T> {
  await mkdir(cmsDirectory(), { recursive: true, mode: 0o700 });
  const lockPath = path.join(cmsDirectory(), "operations.lock");
  const deadline = Date.now() + 5000;
  let lock;
  while (!lock) {
    try { lock = await open(lockPath, "wx", 0o600); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (Date.now() >= deadline) throw new CmsError("Another operations write is active. Retry shortly. A stale lock must be reviewed before removal.", 503, "OPERATIONS_BUSY");
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  try {
    const state = await readLocal(); let changed = false;
    const tx: OperationsTransaction = {
      async get(table, id) { return structuredClone(Object.hasOwn(state.tables[table], id) ? state.tables[table][id] : null); },
      async put(table, value) { Object.defineProperty(state.tables[table], value.id, { value: structuredClone(value), enumerable: true, writable: true, configurable: true }); changed = true; },
    };
    const result = await task(tx);
    if (changed) {
      const raw = JSON.stringify(state);
      if (Buffer.byteLength(raw) > 24 * 1024 * 1024) throw new CmsError("The local operations store is full. Export and move to durable storage before continuing.", 413, "OPERATIONS_CAPACITY");
      const temporary = `${localPath()}.${randomUUID()}.tmp`;
      try { const file = await open(temporary, "wx", 0o600); try { await file.writeFile(raw); await file.sync(); } finally { await file.close(); } await rename(temporary, localPath()); }
      finally { await unlink(temporary).catch(() => undefined); }
    }
    return result;
  } finally { await lock.close(); await unlink(lockPath); }
}
const collectionName = (table: OperationsTable) => `vetra_operations_${table}`;
const indexes = new WeakMap<Db, Promise<unknown>>();
async function database() {
  const db = await getDb(); if (!db) throw new CmsError("Operations database is unavailable.", 503, "OPERATIONS_UNAVAILABLE");
  let ready = indexes.get(db);
  if (!ready) {
    ready = Promise.all([
      db.collection(collectionName("requests")).createIndexes([
        { key: { "value.archived": 1, "value.updatedAt": -1, _id: -1 }, name: "inbox_updated" },
        { key: { "value.archived": 1, "value.kind": 1, "value.updatedAt": -1, _id: -1 }, name: "inbox_kind" },
        { key: { "value.email": 1, "value.archived": 1, "value.updatedAt": -1, _id: -1 }, name: "customer_context" },
      ]),
      db.collection(collectionName("outbox")).createIndex({ "value.updatedAt": -1, _id: -1 }, { name: "outbox_updated" }),
    ]).catch((error) => { indexes.delete(db); throw error; });
    indexes.set(db, ready);
  }
  await ready; return db;
}
function mongoTransaction(session: ClientSession, db: Awaited<ReturnType<typeof database>>): OperationsTransaction {
  return {
    async get<K extends OperationsTable>(table: K, id: string): Promise<OperationsTables[K] | null> { const record = await db.collection<{ _id: string; value: OperationsTables[K] }>(collectionName(table)).findOne({ _id: id }, { session }); return record?.value ?? null; },
    async put<K extends OperationsTable>(table: K, value: OperationsTables[K]) { await db.collection<{ _id: string; value: OperationsTables[K] }>(collectionName(table)).replaceOne({ _id: value.id }, { value }, { session, upsert: true }); },
  };
}
async function transaction<T>(task: (tx: OperationsTransaction) => Promise<T>): Promise<T> {
  allowed();
  if (process.env.CMS_STORAGE !== "mongodb") return localTransaction(task);
  const client = await getMongoClient(); if (!client) throw new CmsError("Operations database is unavailable.", 503);
  const db = await database();
  for (let attempt = 0; ; attempt++) {
    const session = client.startSession();
    try { return await session.withTransaction(() => task(mongoTransaction(session, db)), { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, maxCommitTimeMS: 10000 }); }
    catch (error) { if ((error as { code?: number }).code !== 11000 || attempt >= 2) throw error; }
    finally { await session.endSession(); }
  }
}
export function normalizeOperationsQuery(parameters: URLSearchParams): OperationsQuery {
  const page = Number(parameters.get("page") || 1), q = (parameters.get("q") || "").trim(), email = (parameters.get("email") || "").trim().toLowerCase();
  const kind = parameters.get("kind") || "all", status = parameters.get("status") || "all", assignment = parameters.get("assignment") || "all", view = parameters.get("view") || "requests";
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000 || q.length > 100 || email.length > 254 || !["all", "contact", "wholesale", "order", "newsletter"].includes(kind) || !["all", "new", "reviewing", "completed"].includes(status) || !["all", "assigned", "unassigned"].includes(assignment) || !["requests", "outbox"].includes(view)) throw new CmsError("Check inbox filters.");
  return { page, q, email, kind, status, assignment, view: view as OperationsQuery["view"], archived: parameters.get("archived") === "true" };
}
async function list(query: OperationsQuery) {
  allowed(); const table = query.view === "outbox" ? "outbox" : "requests";
  const skip = (query.page - 1) * OPERATIONS_PAGE_SIZE;
  if (process.env.CMS_STORAGE !== "mongodb") {
    const state = await readLocal(), needle = query.q.toLowerCase();
    const requests = Object.values(state.tables.requests).filter((record) => record.archived === query.archived && (query.kind === "all" || query.kind === record.kind) && (query.status === "all" || query.status === record.status) && (query.assignment === "all" || Boolean(record.assignedTo) === (query.assignment === "assigned")) && (!query.email || record.email === query.email) && [record.name, record.email, record.reference, record.message, record.assignedTo, record.wholesale?.business].join(" ").toLowerCase().includes(needle));
    const notices = Object.values(state.tables.outbox).filter((notice) => [notice.subject, notice.recipient, notice.reference].join(" ").toLowerCase().includes(needle));
    const results = [...(table === "requests" ? requests : notices)].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id));
    return { records: table === "requests" ? results.slice(skip, skip + OPERATIONS_PAGE_SIZE) as OperationsTables["requests"][] : [], notices: table === "outbox" ? results.slice(skip, skip + OPERATIONS_PAGE_SIZE) as OperationsTables["outbox"][] : [], total: results.length, page: query.page, pageSize: OPERATIONS_PAGE_SIZE };
  }
  const db = await database(), collection = db.collection<{ _id: string; value: OperationsTables[typeof table] }>(collectionName(table));
  const filter: Document = {};
  if (table === "requests") {
    filter["value.archived"] = query.archived;
    if (query.kind !== "all") filter["value.kind"] = query.kind;
    if (query.status !== "all") filter["value.status"] = query.status;
    if (query.assignment !== "all") filter["value.assignedTo"] = query.assignment === "assigned" ? { $nin: ["", null] } : { $in: ["", null] };
    if (query.email) filter["value.email"] = query.email;
  }
  if (query.q) { const regex = query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); filter.$or = (table === "requests" ? ["name", "email", "reference", "message", "assignedTo", "wholesale.business"] : ["subject", "recipient", "reference"]).map((field) => ({ [`value.${field}`]: { $regex: regex, $options: "i" } })); }
  const [total, rows] = await Promise.all([collection.countDocuments(filter, { maxTimeMS: 10000 }), collection.find(filter).sort({ "value.updatedAt": -1, _id: -1 }).skip(skip).limit(OPERATIONS_PAGE_SIZE).maxTimeMS(10000).toArray()]);
  return { records: table === "requests" ? rows.map((row) => row.value) as OperationsTables["requests"][] : [], notices: table === "outbox" ? rows.map((row) => row.value) as OperationsTables["outbox"][] : [], total, page: query.page, pageSize: OPERATIONS_PAGE_SIZE };
}
export const operationsRepository: OperationsRepository = { transaction, list };

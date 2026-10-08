import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";

const REQUIRED_INDEXES = [
  { collection: "cms_sessions", name: "expires_at_ttl", key: { expiresAt: 1 }, expireAfterSeconds: 0 },
  { collection: "cms_login_limits", name: "expires_at_ttl", key: { expiresAt: 1 }, expireAfterSeconds: 0 },
];
const MAX_CMS_FILES = 15_000;
class ManagementError extends Error {}
const digest = (value) => createHash("sha256").update(value).digest("hex");
const sameKey = (left, right) => JSON.stringify(left) === JSON.stringify(right);

/** The hash binds an approved index plan to one URI endpoint and database. */
export function mongoTargetFingerprint(uri, database) {
  if (typeof uri !== "string" || typeof database !== "string" || !database.trim() || database !== database.trim()) throw new ManagementError("Set MONGODB_URI and an explicit MONGODB_DB before inspecting storage.");
  const match = /^(mongodb(?:\+srv)?):\/\/([^/?#]+)/i.exec(uri);
  if (!match) throw new ManagementError("MONGODB_URI must be a MongoDB connection string.");
  const hosts = match[2].slice(match[2].lastIndexOf("@") + 1).toLowerCase();
  if (!hosts) throw new ManagementError("MONGODB_URI has no database endpoint.");
  return digest(`${match[1].toLowerCase()}://${hosts}/${database.trim()}`);
}

export function mongoTransactionTopology(hello) {
  if (!hello || typeof hello !== "object") return false;
  return Boolean((typeof hello.setName === "string" && hello.setName) || hello.msg === "isdbgrid")
    && Number.isFinite(hello.logicalSessionTimeoutMinutes);
}

function indexSignature(index) {
  return {
    name: index.name,
    key: index.key,
    expireAfterSeconds: index.expireAfterSeconds ?? null,
    unique: index.unique === true,
    sparse: index.sparse === true,
    partialFilterExpression: index.partialFilterExpression ?? null,
  };
}

/** No index is modified or dropped. A conflicting existing index needs review. */
export function planMongoIndexes(targetFingerprint, existingByCollection) {
  if (!/^[a-f0-9]{64}$/.test(targetFingerprint)) throw new ManagementError("Inspect the MongoDB target first.");
  const actions = REQUIRED_INDEXES.map((required) => {
    const existing = existingByCollection[required.collection] || [];
    const sameName = existing.find((index) => index.name === required.name);
    const sameFields = existing.find((index) => sameKey(index.key, required.key));
    const candidate = sameFields || sameName;
    if (candidate && sameKey(candidate.key, required.key) && candidate.expireAfterSeconds === 0
      && candidate.unique !== true && candidate.sparse !== true && !candidate.partialFilterExpression) {
      return { collection: required.collection, status: "present", name: candidate.name };
    }
    if (candidate) return { collection: required.collection, status: "conflict", name: candidate.name };
    return { collection: required.collection, status: "create", name: required.name };
  });
  const snapshot = REQUIRED_INDEXES.map(({ collection }) => [
    collection,
    (existingByCollection[collection] || []).map(indexSignature).sort((a, b) => a.name.localeCompare(b.name)),
  ]);
  const planHash = digest(JSON.stringify({ targetFingerprint, required: REQUIRED_INDEXES, snapshot }));
  return { planHash, actions };
}

/** Inspect only metadata. This does not prove stored JSON or media bytes intact. */
export function inspectCmsFileMetadata(entries) {
  const summary = { inspected: Math.min(entries.length, MAX_CMS_FILES), complete: entries.length <= MAX_CMS_FILES, invalid: 0, unfinishedMedia: 0 };
  for (const entry of entries.slice(0, MAX_CMS_FILES)) {
    if (typeof entry._id !== "string" || !/^[a-f0-9]{64}$/.test(entry.hash)
      || !Number.isSafeInteger(entry.size) || entry.size < 0
      || (entry.media === true && !/^media\/[a-f0-9]{64}\.(jpg|png|webp|gif)$/.test(entry._id))) {
      summary.invalid++;
    }
    if (entry.media === true && entry.ready !== true) summary.unfinishedMedia++;
  }
  return summary;
}

async function collectionIndexes(db, name) {
  try { return await db.collection(name).listIndexes().toArray(); }
  catch (error) { if (error.code === 26 || error.codeName === "NamespaceNotFound") return []; throw error; }
}

export async function inspectMongoData(db, targetFingerprint) {
  const [hello, existing, entries] = await Promise.all([
    db.admin().command({ hello: 1 }),
    Promise.all(REQUIRED_INDEXES.map(async ({ collection }) => [collection, await collectionIndexes(db, collection)])),
    db.collection("cms_files").find({}, { projection: { _id: 1, size: 1, hash: 1, media: 1, ready: 1 } }).limit(MAX_CMS_FILES + 1).toArray(),
  ]);
  return {
    transactionCapableTopology: mongoTransactionTopology(hello),
    indexPlan: planMongoIndexes(targetFingerprint, Object.fromEntries(existing)),
    cmsFileMetadata: inspectCmsFileMetadata(entries),
  };
}

/** A snapshot read proves that this connection can actually run a transaction. */
export async function probeMongoTransaction(client, db) {
  const session = client.startSession();
  try {
    await session.withTransaction(
      () => db.collection("cms_files").findOne({}, { projection: { _id: 1 }, session }),
      { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, maxCommitTimeMS: 10_000 },
    );
    return true;
  } catch { return false; }
  finally { await session.endSession(); }
}

async function main(args = process.argv.slice(2)) {
  const require = createRequire(import.meta.url);
  require("@next/env").loadEnvConfig(process.cwd());
  const apply = args[0] === "--apply";
  if ((!apply && args.length && !(args.length === 1 && args[0] === "--inspect"))
    || (apply && (args.length !== 3 || args[1] !== "--expected-plan" || !/^[a-f0-9]{64}$/.test(args[2])))) {
    throw new ManagementError("Use --inspect, or --apply --expected-plan <64-character plan hash>.");
  }
  if (process.env.CMS_STORAGE !== "mongodb") throw new ManagementError("Set CMS_STORAGE=mongodb for the intended staging or production target.");
  const uri = process.env.MONGODB_URI, database = process.env.MONGODB_DB;
  const targetFingerprint = mongoTargetFingerprint(uri, database);
  const client = new MongoClient(uri, { appName: "vetra-mongodb-management", serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000, socketTimeoutMS: 10000, maxPoolSize: 2 });
  try {
    await client.connect();
    const db = client.db(database);
    const before = await inspectMongoData(db, targetFingerprint);
    const transactionVerified = before.transactionCapableTopology && await probeMongoTransaction(client, db);
    console.log(JSON.stringify({ mode: apply ? "apply" : "inspect", targetFingerprint, ...before, transactionVerified }, null, 2));
    if (!transactionVerified) throw new ManagementError("MongoDB must pass a read-only transaction check before indexes can be applied; no indexes were changed.");
    if (!before.cmsFileMetadata.complete || before.cmsFileMetadata.invalid) throw new ManagementError("CMS storage metadata needs review; no indexes were changed.");
    if (before.indexPlan.actions.some((action) => action.status === "conflict")) throw new ManagementError("An existing TTL index conflicts with the required shape; no indexes were changed.");
    if (!apply) return;
    if (args[2] !== before.indexPlan.planHash) throw new ManagementError("The inspected index plan or target changed. Inspect again before applying.");
    for (const action of before.indexPlan.actions) {
      if (action.status !== "create") continue;
      const spec = REQUIRED_INDEXES.find((index) => index.collection === action.collection);
      await db.collection(spec.collection).createIndex(spec.key, { name: spec.name, expireAfterSeconds: spec.expireAfterSeconds });
    }
    const after = await inspectMongoData(db, targetFingerprint);
    if (after.indexPlan.actions.some((action) => action.status !== "present")) throw new ManagementError("An index still needs review after apply; inspect the target before retrying.");
    console.log(JSON.stringify({ result: "required TTL indexes present", indexPlan: after.indexPlan, cmsFileMetadata: after.cmsFileMetadata }, null, 2));
  } finally { await client.close(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    // Driver errors may contain connection details. Never print URI or credentials.
    console.error(`MongoDB management stopped: ${error instanceof ManagementError ? error.message : "Connection or database operation failed. Check the target, permissions and network access."}`);
    process.exitCode = 1;
  });
}

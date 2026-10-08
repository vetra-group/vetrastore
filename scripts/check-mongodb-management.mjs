import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  inspectCmsFileMetadata,
  inspectMongoData,
  mongoTargetFingerprint,
  mongoTransactionTopology,
  planMongoIndexes,
  probeMongoTransaction,
} from "./mongodb-management.mjs";

const target = mongoTargetFingerprint("mongodb+srv://owner:secret@staging.example.invalid/", "vetra_staging");
assert.equal(target, mongoTargetFingerprint("mongodb+srv://another:password@staging.example.invalid/", "vetra_staging"));
assert.notEqual(target, mongoTargetFingerprint("mongodb+srv://owner:secret@production.example.invalid/", "vetra_staging"));
assert.notEqual(target, mongoTargetFingerprint("mongodb+srv://owner:secret@staging.example.invalid/", "vetra_production"));
assert.throws(() => mongoTargetFingerprint("mongodb://localhost", ""));
assert.throws(() => mongoTargetFingerprint("https://example.invalid", "vetra_staging"));
console.log("PASS: plan identity binds the endpoint and explicit database without including credentials");

const absent = { cms_sessions: [], cms_login_limits: [] };
const initial = planMongoIndexes(target, absent);
assert.equal(initial.actions.filter((entry) => entry.status === "create").length, 2);
assert.match(initial.planHash, /^[a-f0-9]{64}$/);
const ttl = { name: "expires_at_ttl", key: { expiresAt: 1 }, expireAfterSeconds: 0 };
const present = planMongoIndexes(target, { cms_sessions: [ttl], cms_login_limits: [{ ...ttl, name: "expiresAt_1" }] });
assert.deepEqual(present.actions.map((entry) => entry.status), ["present", "present"]);
assert.notEqual(initial.planHash, present.planHash);
const conflict = planMongoIndexes(target, { cms_sessions: [{ ...ttl, expireAfterSeconds: 3600 }], cms_login_limits: [{ ...ttl, key: { createdAt: 1 } }] });
assert.deepEqual(conflict.actions.map((entry) => entry.status), ["conflict", "conflict"]);
assert.equal(mongoTransactionTopology({ setName: "rs0", logicalSessionTimeoutMinutes: 30 }), true);
assert.equal(mongoTransactionTopology({ msg: "isdbgrid", logicalSessionTimeoutMinutes: 30 }), true);
assert.equal(mongoTransactionTopology({ logicalSessionTimeoutMinutes: 30 }), false);
console.log("PASS: dry-run identifies safe index creation, existing TTL indexes, conflicts and transaction topology");

const validId = "a".repeat(64);
const metadata = inspectCmsFileMetadata([
  { _id: "state.json", size: 10, hash: validId },
  { _id: `media/${validId}.png`, media: true, size: 50, hash: validId, ready: false },
  { _id: "uploads.json", size: -1, hash: validId },
]);
assert.deepEqual(metadata, { inspected: 3, complete: true, invalid: 1, unfinishedMedia: 1 });
assert.equal(inspectCmsFileMetadata(Array.from({ length: 15_001 }, () => ({ _id: "state.json", size: 0, hash: validId }))).complete, false);

const calls = [];
const fakeDb = {
  admin() { return { async command(value) { calls.push(["command", value]); return { setName: "rs0", logicalSessionTimeoutMinutes: 30 }; } }; },
  collection(name) {
    return {
      listIndexes() { calls.push(["listIndexes", name]); return { async toArray() { return []; } }; },
      find(filter, options) {
        calls.push(["find", name, filter, options]);
        return { limit(amount) { calls.push(["limit", amount]); return { async toArray() { return [{ _id: "state.json", size: 10, hash: validId }]; } }; } };
      },
      createIndex() { throw new Error("Inspection must not create indexes."); },
    };
  },
};
const inspected = await inspectMongoData(fakeDb, target);
assert.equal(inspected.transactionCapableTopology, true);
assert.equal(inspected.cmsFileMetadata.invalid, 0);
assert.equal(inspected.indexPlan.actions.filter((entry) => entry.status === "create").length, 2);
assert.deepEqual(calls.filter(([kind]) => kind === "listIndexes").map(([, name]) => name), ["cms_sessions", "cms_login_limits"]);
assert.equal(calls.find(([kind]) => kind === "limit")[1], 15_001);
assert.deepEqual(calls.find(([kind]) => kind === "find")[3].projection, { _id: 1, size: 1, hash: 1, media: 1, ready: 1 });
console.log("PASS: inspection is read-only and excludes CMS content and media bytes");

let ended = 0;
const session = { async withTransaction(task, options) { assert.equal(options.readConcern.level, "snapshot"); return task(); }, async endSession() { ended++; } };
const transactionDb = { collection(name) { assert.equal(name, "cms_files"); return { async findOne(filter, options) { assert.deepEqual(filter, {}); assert.equal(options.session, session); assert.deepEqual(options.projection, { _id: 1 }); return null; } }; } };
assert.equal(await probeMongoTransaction({ startSession: () => session }, transactionDb), true);
assert.equal(ended, 1);
const failing = { async withTransaction() { throw new Error("unavailable"); }, async endSession() { ended++; } };
assert.equal(await probeMongoTransaction({ startSession: () => failing }, transactionDb), false);
assert.equal(ended, 2);
console.log("PASS: a read-only transaction probe confirms session support and closes sessions on failure");

const script = fileURLToPath(new URL("./mongodb-management.mjs", import.meta.url));
const rejected = spawnSync(process.execPath, [script, "--apply"], {
  encoding: "utf8",
  env: { ...process.env, CMS_STORAGE: "mongodb", MONGODB_URI: "mongodb://owner:secret@private.example.invalid/", MONGODB_DB: "vetra_staging" },
});
assert.equal(rejected.status, 1);
assert.match(rejected.stderr, /--expected-plan/);
assert.doesNotMatch(`${rejected.stdout}${rejected.stderr}`, /owner|secret|private\.example/);
console.log("PASS: apply requires an exact plan hash before connecting and does not expose connection secrets");

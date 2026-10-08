/* Staff fulfilment state tests with fake MongoDB; no provider or live writes. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function load(relative, mocks) {
  const filename = path.resolve(root, relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const record = { exports: {} };
  const localRequire = (name) => Object.hasOwn(mocks, name) ? mocks[name] : nativeRequire(name);
  new Function("require", "module", "exports", compiled)(localRequire, record, record.exports);
  return record.exports;
}

class CmsError extends Error {
  constructor(message, status = 400, code = "INVALID_REQUEST") { super(message); this.status = status; this.code = code; }
}
const orderId = randomUUID();
const tables = {
  payment_orders: new Map([[orderId, { _id: orderId, status: "paid", requiresPaymentReview: false, updatedAt: new Date() }]]),
  payment_inventory_allocations: new Map([[orderId, { _id: orderId, state: "committed" }]]),
  payment_fulfilments: new Map(),
};
const match = (row, filter) => Object.entries(filter).every(([key, value]) => value && typeof value === "object" && "$ne" in value ? row[key] !== value.$ne : row[key] === value);
const db = { collection(name) {
  const rows = tables[name];
  assert.ok(rows, `Unexpected collection: ${name}`);
  return {
    async findOne(filter) { return structuredClone([...rows.values()].find((row) => match(row, filter)) ?? null); },
    async updateOne(filter, update) {
      const row = [...rows.values()].find((item) => match(item, filter));
      if (!row) return { modifiedCount: 0 };
      for (const [key, amount] of Object.entries(update.$inc ?? {})) row[key] = (row[key] ?? 0) + amount;
      Object.assign(row, structuredClone(update.$set ?? {}));
      return { modifiedCount: 1 };
    },
    async insertOne(value) {
      if (rows.has(value._id)) throw Object.assign(new Error("duplicate"), { code: 11000 });
      rows.set(value._id, structuredClone(value));
      return { acknowledged: true };
    },
    async replaceOne(filter, value) {
      const row = [...rows.values()].find((item) => match(item, filter));
      if (!row) return { modifiedCount: 0 };
      rows.set(row._id, structuredClone(value));
      return { modifiedCount: 1 };
    },
  };
} };
const { parseFulfilmentInput, readPaymentFulfilment, updatePaymentFulfilment } = load("src/lib/payments/fulfilment.ts", {
  "@/lib/cms/validation": { CmsError },
  "./orders": { withPaymentTransaction: async (task) => task({}) },
});

const input = (revision, status, extra = {}) => ({ expectedRevision: revision, status, assignedTo: "Packing team", carrier: "", tracking: "", ...extra });
const expectCode = (code) => (error) => error instanceof CmsError && error.code === code;

assert.equal((await readPaymentFulfilment(db, orderId)).status, "not-started");
assert.throws(() => parseFulfilmentInput({ expectedRevision: 0, status: "paid", assignedTo: "x" }), expectCode("INVALID_FULFILMENT"));
let record = await updatePaymentFulfilment(db, orderId, input(0, "not-started"), "Owner");
assert.equal(record.revision, 1, "Staff assignment is saved with a revision");
record = await updatePaymentFulfilment(db, orderId, input(1, "preparing"), "Owner");
assert.equal(record.status, "preparing");
await assert.rejects(updatePaymentFulfilment(db, orderId, input(1, "shipped", { carrier: "Carrier", tracking: "123" }), "Owner"), expectCode("REVISION_CONFLICT"));
await assert.rejects(updatePaymentFulfilment(db, orderId, input(2, "shipped"), "Owner"), expectCode("TRACKING_REQUIRED"));
record = await updatePaymentFulfilment(db, orderId, input(2, "shipped", { carrier: "Carrier", tracking: "TRACK-123" }), "Owner");
assert.equal(record.status, "shipped");
assert.equal(record.tracking, "TRACK-123");
await assert.rejects(updatePaymentFulfilment(db, orderId, input(3, "preparing"), "Owner"), expectCode("INVALID_TRANSITION"));
record = await updatePaymentFulfilment(db, orderId, input(3, "delivered"), "Owner");
assert.equal(record.status, "delivered");
assert.equal(record.activity.length, 4);
assert.equal(tables.payment_orders.get(orderId).status, "paid", "Fulfilment never changes payment truth");

tables.payment_orders.get(orderId).requiresPaymentReview = true;
await assert.rejects(updatePaymentFulfilment(db, orderId, input(4, "delivered", { assignedTo: "Another team" }), "Owner"), expectCode("PAYMENT_REVIEW_REQUIRED"));
tables.payment_orders.get(orderId).requiresPaymentReview = false;
tables.payment_inventory_allocations.get(orderId).state = "released";
await assert.rejects(updatePaymentFulfilment(db, orderId, input(4, "delivered", { assignedTo: "Another team" }), "Owner"), expectCode("INVENTORY_REVIEW_REQUIRED"));

console.log("PASS: authenticated-staff fulfilment primitive requires paid committed stock, ordered stages, assignment, tracking and optimistic revisions. Fake DB only.");

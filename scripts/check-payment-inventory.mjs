/* Isolated inventory state tests. MongoDB transactions and provider webhooks
 * still require a connected test environment before enabling live payments. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function load(relative, cache = new Map()) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const moduleRecord = { exports: {} };
  cache.set(filename, moduleRecord);
  const localRequire = (name) => name.startsWith("@/") ? load(`src/${name.slice(2)}.ts`, cache) : name.startsWith(".") ? load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`)), cache) : nativeRequire(name);
  new Function("require", "module", "exports", compiled)(localRequire, moduleRecord, moduleRecord.exports);
  return moduleRecord.exports;
}

function fakeStore() {
  let current = new Map();
  let queue = Promise.resolve();
  const table = (tables, name) => {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name);
  };
  const matches = (document, filter) => Object.entries(filter).every(([key, criterion]) => {
    if (criterion && typeof criterion === "object" && "$gte" in criterion) return document[key] >= criterion.$gte;
    return document[key] === criterion;
  });
  const db = {
    collection(name) {
      return {
        async findOne(filter, { session }) {
          const entry = [...table(session.tables, name).values()].find((document) => matches(document, filter));
          return entry ? structuredClone(entry) : null;
        },
        async insertOne(record, { session }) {
          const records = table(session.tables, name);
          if (records.has(record._id)) throw Object.assign(new Error("Duplicate key"), { code: 11000 });
          records.set(record._id, structuredClone(record));
          return { acknowledged: true };
        },
        async updateOne(filter, update, { session }) {
          const records = table(session.tables, name);
          const found = [...records].find(([, document]) => matches(document, filter));
          if (!found) return { modifiedCount: 0 };
          const next = structuredClone(found[1]);
          for (const [field, amount] of Object.entries(update.$inc || {})) next[field] += amount;
          Object.assign(next, structuredClone(update.$set || {}));
          records.set(found[0], next);
          return { modifiedCount: 1 };
        },
      };
    },
  };
  const run = async (task) => {
    const previous = queue;
    let unlock;
    queue = new Promise((resolve) => { unlock = resolve; });
    await previous;
    try {
      const tables = structuredClone(current);
      const result = await task({ tables });
      current = tables;
      return result;
    } finally { unlock(); }
  };
  return { db, run, row: (name, id) => structuredClone(table(current, name).get(id)), rows: (name) => [...table(current, name).values()].map((row) => structuredClone(row)) };
}

const { reservePaymentInventory, settlePaymentInventory, reconcilePaymentInventory } = load("src/lib/payments/inventory.ts");
const product = (id, stock) => ({ id, status: "published", stock });
const order = (id, items) => ({ _id: id, items });
const one = (id, quantity = 6) => order(id, [{ id: "honey", quantity }]);
const run = async () => {
  const store = fakeStore();
  const products = [product("honey", 10)];
  const first = one(randomUUID());
  await store.run((session) => reservePaymentInventory(store.db, first, products, session));
  await store.run((session) => reservePaymentInventory(store.db, first, products, session));
  assert.deepEqual(store.row("payment_inventory", "honey"), {
    _id: "honey", publishedStock: 10, sourceStock: 10, available: 4, reserved: 6, committed: 0, version: 1, updatedAt: store.row("payment_inventory", "honey").updatedAt,
  });
  assert.equal(store.rows("payment_inventory_ledger").length, 1, "A duplicate reserve is idempotent");

  const competing = one(randomUUID());
  const claims = await Promise.allSettled([
    store.run((session) => reservePaymentInventory(store.db, competing, products, session)),
    store.run((session) => reservePaymentInventory(store.db, one(randomUUID()), products, session)),
  ]);
  assert.equal(claims.filter((claim) => claim.status === "fulfilled").length, 0, "Concurrent claims cannot exceed the last four units");
  assert.ok(claims.every((claim) => claim.reason.code === "STOCK_INSUFFICIENT"));

  await store.run((session) => settlePaymentInventory(store.db, first, "paid", session));
  await store.run((session) => settlePaymentInventory(store.db, first, "paid", session));
  await store.run((session) => settlePaymentInventory(store.db, first, "released", session));
  assert.equal(store.row("payment_inventory", "honey").committed, 6, "A late failure cannot release paid stock");
  assert.equal(store.rows("payment_inventory_ledger").length, 2, "Duplicate and out-of-order callbacks do not duplicate ledger entries");

  const second = one(randomUUID(), 4);
  await store.run((session) => reservePaymentInventory(store.db, second, products, session));
  await store.run((session) => settlePaymentInventory(store.db, second, "released", session));
  await store.run((session) => settlePaymentInventory(store.db, second, "released", session));
  assert.equal(store.row("payment_inventory", "honey").available, 4, "A verified failure releases stock exactly once");
  await store.run((session) => reservePaymentInventory(store.db, second, products, session));
  assert.equal(store.row("payment_inventory_allocations", second._id).revision, 2, "An intentional retry creates a new reservation transition");
  await store.run((session) => settlePaymentInventory(store.db, second, "released", session));

  const third = one(randomUUID(), 4);
  await store.run((session) => reservePaymentInventory(store.db, third, products, session));
  await store.run((session) => settlePaymentInventory(store.db, third, "paid", session));
  const late = await store.run((session) => settlePaymentInventory(store.db, second, "paid", session));
  assert.equal(late.requiresReview, true, "A late charge after release requires staff review");
  assert.equal(store.row("payment_inventory", "honey").available, -4, "Every verified charge remains in the stock ledger, even after a prior release");
  await store.run((session) => settlePaymentInventory(store.db, second, "paid", session));
  assert.equal(store.row("payment_inventory", "honey").committed, 14, "A repeated late success is idempotent");

  const changed = [product("honey", 20)];
  await assert.rejects(store.run((session) => reservePaymentInventory(store.db, one(randomUUID(), 1), changed, session)), (error) => error.code === "STOCK_RECONCILIATION_REQUIRED", "CMS stock edits cannot silently reset live inventory");
  const version = store.row("payment_inventory", "honey").version;
  const reconcile = { productId: "honey", expectedVersion: version, confirmedPublishedStock: 20, totalSellableBudget: 20, actor: "Owner", reason: "Confirmed physical count and prior paid units" };
  await assert.rejects(store.run((session) => reconcilePaymentInventory(store.db, { ...reconcile, totalSellableBudget: 13 }, session)), (error) => error.code === "STOCK_BELOW_COMMITMENTS", "Reconciliation cannot erase committed units");
  const adjusted = await store.run((session) => reconcilePaymentInventory(store.db, reconcile, session));
  assert.equal(adjusted.available, 6);
  assert.equal(adjusted.publishedStock, 20);
  assert.equal(adjusted.sourceStock, 20);
  assert.equal(store.rows("payment_inventory_ledger").filter((entry) => entry.action === "reconciled").length, 1, "A stock adjustment is audited");
  await assert.rejects(store.run((session) => reconcilePaymentInventory(store.db, reconcile, session)), (error) => error.code === "INVENTORY_CONFLICT", "A stale stock adjustment cannot overwrite a newer balance");
  await store.run((session) => reservePaymentInventory(store.db, one(randomUUID(), 1), changed, session));

  const multi = fakeStore();
  const productsTwo = [product("a", 3), product("b", 0)];
  await assert.rejects(multi.run((session) => reservePaymentInventory(multi.db, order(randomUUID(), [{ id: "a", quantity: 2 }, { id: "b", quantity: 1 }]), productsTwo, session)), (error) => error.code === "STOCK_INSUFFICIENT");
  assert.equal(multi.rows("payment_inventory").length, 0, "A later line failure rolls back the entire reservation transaction");

  console.log("PASS: real-payment inventory reserve, concurrent stock limit, atomic rollback, verified commitment/release, duplicate callbacks, late success review, published-stock mismatch and audited reconciliation. Fake transactions only.");
};
run().catch((error) => { console.error(error); process.exitCode = 1; });

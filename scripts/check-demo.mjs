/* Pure local checks. No browser, network, database, email or payment service. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cache = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const moduleRecord = { exports: {} };
  cache.set(filename, moduleRecord);
  const localRequire = (name) => {
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
    if (name.startsWith(".")) return load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`)));
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled)(localRequire, moduleRecord, moduleRecord.exports);
  return moduleRecord.exports;
}

globalThis.fetch = () => { throw new Error("Network access is not permitted in demo checks"); };
const { honey, MAX_QUANTITY } = load("src/lib/catalog.ts");
const { STORE_KEY, parseStoredCart } = load("src/lib/cart.ts");
const { demoChecklistKeys } = load("src/lib/demo-types.ts");
const { DEMO_STORAGE_KEY, DEMO_TRASH_RETENTION_MS, emptyDemoData, normalizeDemoInput, createDemoSubmission, parseDemoData, demoSamples, trashDemoRecord, restoreDemoRecord, resetDemoData, readDemoStorage, writeDemoStorage } = load("src/lib/demo.ts");
const date = "2026-10-04T03:00:00.000Z";
const order = {
  kind: "order", locale: "en", name: " Sample buyer ", email: " BUYER@example.test ",
  phone: " 0812345678 ", message: " Sample enquiry ",
  items: [{ id: honey.id, quantity: 2, unitPrice: 1 }], subtotal: 2,
};
let checked = 0;
function test(name, run) {
  try { run(); checked++; }
  catch (error) { throw new Error(`${name}: ${error.message}`, { cause: error }); }
}

test("Customer dictionaries have complete Arabic text for every English key", () => {
  function compare(english, arabic, at) {
    assert.deepEqual(Object.keys(arabic).sort(), Object.keys(english).sort(), `${at}: same translation keys`);
    for (const [key, value] of Object.entries(english)) {
      if (typeof value === "object") compare(value, arabic[key], `${at}.${key}`);
      else assert.match(arabic[key], /[\u0600-\u06ff]/u, `${at}.${key}: Arabic text required`);
    }
  }
  for (const [file, exported] of [["commerce", "commerce"], ["workflow", "workflowCopy"], ["staff", "staffCopy"], ["mock-checkout", "mockCheckoutCopy"], ["mini-cart", "miniCartCopy"], ["quick-search", "quickSearchCopy"], ["errors", "errorCopy"], ["notifications", "notificationCopy"]]) {
    const copy = load(`src/content/${file}.ts`)[exported];
    compare(copy.en, copy.ar, exported);
  }
});

test("Catalog owns prices and totals; inputs are preserved", () => {
  const original = structuredClone(order);
  const result = normalizeDemoInput(order);
  assert.equal(result.name, "Sample buyer");
  assert.equal(result.email, "buyer@example.test");
  assert.equal(result.phone, "0812345678");
  assert.equal(result.message, "Sample enquiry");
  assert.equal(result.currency, "USD");
  assert.equal(result.items[0].unitPrice, 50);
  assert.equal(result.items[0].lineTotal, 100);
  assert.equal(result.subtotal, 100);
  assert.equal(result.payment, "enquiry");
  assert.deepEqual(order, original);
});
test("Arabic orders preserve locale, localize notices and survive retry and Trash restoration", () => {
  const input = { ...order, locale: "ar", name: "عميل تجريبي", message: "استفسار تجريبي عن عسل أزهار القهوة" };
  const created = createDemoSubmission(emptyDemoData(), input, "arabic-order", date);
  assert.equal(created.record.locale, "ar");
  assert.ok(created.data.outbox.every((notice) => /[\u0600-\u06ff]/u.test(notice.subject) && notice.body.includes("لم تُرسل رسالة بريد")));
  assert.ok(created.data.outbox.every((notice) => !notice.body.includes("Notification preview") && !notice.body.includes("undefined")));
  assert.deepEqual(createDemoSubmission(created.data, input, "arabic-order", date).data, created.data);
  const reloaded = parseDemoData(JSON.parse(JSON.stringify(created.data)), Date.parse(date));
  assert.equal(reloaded.records[0].locale, "ar");
  const deleted = trashDemoRecord(reloaded, created.record.id, Date.parse(date));
  const restored = restoreDemoRecord(deleted, deleted.trash[0].id, Date.parse(date));
  assert.equal(restored.records[0].locale, "ar");
  assert.deepEqual(restored.outbox, created.data.outbox);
});

test("Order quantity and product validation", () => {
  for (const quantity of [0, -1, 1.5, MAX_QUANTITY + 1, NaN, Infinity, "2", null]) {
    assert.throws(() => normalizeDemoInput({ ...order, items: [{ id: honey.id, quantity, unitPrice: 0 }] }));
  }
  for (const quantity of [1, MAX_QUANTITY]) {
    assert.equal(normalizeDemoInput({ ...order, items: [{ id: honey.id, quantity, unitPrice: 0 }] }).subtotal, load("src/lib/catalog.ts").quoteProduct(honey, quantity, "en").total);
  }
  for (const items of [[], null, [{ id: "unavailable", quantity: 1, unitPrice: 0 }], [{ ...order.items[0] }, { ...order.items[0] }]]) {
    assert.throws(() => normalizeDemoInput({ ...order, items }));
  }
  assert.throws(() => normalizeDemoInput({ ...order, locale: "fr" }));
  assert.throws(() => normalizeDemoInput({ ...order, payment: "paid" }));
  assert.throws(() => normalizeDemoInput({ ...order, name: " " }));
  assert.throws(() => normalizeDemoInput({ ...order, email: "invalid" }));
});

test("CMS catalog changes update prices and stock without losing historical orders", () => {
  const original = createDemoSubmission(emptyDemoData(), order, "historic-order", date);
  const published = [{ ...honey, pricing: { ...honey.pricing, USD: honey.pricing.USD.map((tier) => tier.quantity === 1 ? { ...tier, total: 72 } : tier) }, stock: 1 }];
  const retry = createDemoSubmission(original.data, order, "historic-order", date, published);
  assert.equal(retry.record.subtotal, 100);
  assert.equal(retry.record.items[0].unitPrice, 50);
  assert.equal(retry.record.items[0].lineTotal, 100);
  assert.deepEqual(retry.data, original.data);
  assert.equal(createDemoSubmission(original.data, order, "historic-order", date, []).record.reference, original.record.reference);
  assert.throws(() => createDemoSubmission(original.data, { ...order, email: "changed@example.test" }, "historic-order", date, []), /details changed/i);
  assert.throws(() => createDemoSubmission(original.data, { ...order, items: [{ ...order.items[0], quantity: 1 }] }, "historic-order", date, []), /details changed/i);
  assert.throws(() => createDemoSubmission(original.data, order, "new-order", date, []));
  assert.throws(() => normalizeDemoInput(order, published));
  assert.equal(normalizeDemoInput({ ...order, items: [{ ...order.items[0], quantity: 1 }] }, published).subtotal, 72);
  assert.throws(() => normalizeDemoInput({ ...order, items: [{ ...order.items[0], quantity: 1 }] }, [{ ...honey, stock: 0 }]));
  assert.deepEqual(parseDemoData(JSON.parse(JSON.stringify(original.data))), original.data);
});

test("Published stock limits constrain persisted cart and archived products disappear", () => {
  const second = { ...honey, id: "second-product", slug: "second-product", price: 250, stock: 2 };
  const stored = { items: [{ id: honey.id, quantity: 5 }, { id: second.id, quantity: 4 }], wishlist: [honey.id, second.id] };
  const constrained = parseStoredCart(stored, [{ ...honey, stock: 1 }, second]);
  assert.deepEqual(constrained.items, [{ id: honey.id, quantity: 1 }, { id: second.id, quantity: 2 }]);
  assert.deepEqual(parseStoredCart(stored, [second]), { items: [{ id: second.id, quantity: 2 }], wishlist: [second.id] });
  assert.deepEqual(parseStoredCart(stored, [{ ...honey, stock: 0 }]), { items: [], wishlist: [honey.id] });
  assert.deepEqual(stored.items, [{ id: honey.id, quantity: 5 }, { id: second.id, quantity: 4 }]);
});

test("Same-key retries do not create records or notifications", () => {
  const original = emptyDemoData();
  const first = createDemoSubmission(original, order, "order-retry", date);
  const retry = createDemoSubmission(first.data, { ...order, subtotal: 123, items: [{ ...order.items[0], unitPrice: 999 }] }, "order-retry", date);
  assert.equal(first.data.records.length, 1);
  assert.equal(first.data.outbox.length, 2);
  assert.equal(retry.record.id, first.record.id);
  assert.equal(retry.record.reference, first.record.reference);
  assert.deepEqual(retry.data, first.data);
  assert.equal(original.records.length, 0);
  assert.equal(original.outbox.length, 0);
  assert.deepEqual(new Set(first.data.outbox.map((notification) => notification.to)), new Set(["staff", "customer"]));
  assert.ok(first.data.outbox.every((notification) => notification.state === "preview" && notification.recordId === first.record.id));
});

test("Conflicting idempotency keys fail without changing data", () => {
  const first = createDemoSubmission(emptyDemoData(), order, "order-conflict", date);
  const snapshot = structuredClone(first.data);
  assert.throws(() => createDemoSubmission(first.data, { ...order, items: [{ ...order.items[0], quantity: 3 }] }, "order-conflict", date), /details changed/i);
  assert.deepEqual(first.data, snapshot);
  for (const key of ["", "a b", "../record", "x".repeat(101)]) assert.throws(() => createDemoSubmission(first.data, order, key, date));
});

test("Declined simulation can retry as successful with a new key", () => {
  const declined = createDemoSubmission(emptyDemoData(), { ...order, payment: "demo-failed" }, "payment-declined", date);
  assert.throws(() => createDemoSubmission(declined.data, { ...order, payment: "demo-paid" }, "payment-declined", date), /details changed/i);
  const paid = createDemoSubmission(declined.data, { ...order, payment: "demo-paid" }, "payment-approved", date);
  assert.equal(paid.data.records.length, 2);
  assert.equal(paid.data.outbox.length, 4);
  assert.equal(declined.record.payment, "demo-failed");
  assert.equal(paid.record.payment, "demo-paid");
  assert.notEqual(paid.record.reference, declined.record.reference);
  assert.equal(paid.record.subtotal, declined.record.subtotal);
});

test("Newsletter deduplicates normalized email addresses", () => {
  const input = { kind: "newsletter", locale: "en", name: "Subscriber", email: " Reader@example.test " };
  const first = createDemoSubmission(emptyDemoData(), input, "newsletter-one", date);
  const repeat = createDemoSubmission(first.data, { ...input, locale: "th", email: "reader@EXAMPLE.test" }, "newsletter-two", date);
  assert.equal(repeat.record.id, first.record.id);
  assert.equal(repeat.data.records.length, 1);
  assert.equal(repeat.data.outbox.length, 2);
  const another = createDemoSubmission(repeat.data, { ...input, email: "another@example.test" }, "newsletter-three", date);
  assert.equal(another.data.records.length, 2);
});

test("Corrupt records and orphan notifications cannot enter the inbox", () => {
  const valid = createDemoSubmission(emptyDemoData(), order, "record-valid", date);
  const invalid = [
    null, {}, { ...valid.record, id: "bad-product", items: [{ id: "missing", quantity: 1, unitPrice: 0 }] },
    { ...valid.record, id: "bad-date", createdAt: "not a date" },
    { ...valid.record, id: "bad-status", status: "paid" },
    { ...valid.record, id: "bad-notes", notes: "x".repeat(5001) },
    { ...valid.record, id: "bad-reference", reference: null },
  ];
  const brokenOutbox = [null, {}, { ...valid.data.outbox[0], recordId: "missing" }, { ...valid.data.outbox[0], state: "sent" }];
  const parsed = parseDemoData({ ...valid.data, records: [valid.record, ...invalid, valid.record], outbox: [...valid.data.outbox, ...brokenOutbox] });
  assert.deepEqual(parsed.records, [valid.record]);
  assert.deepEqual(parsed.outbox, valid.data.outbox);
  for (const data of [null, undefined, false, "broken", {}, [], { version: 2, records: valid.data.records }]) assert.deepEqual(parseDemoData(data), emptyDemoData());
  assert.deepEqual(parseDemoData({ version: 1, records: {}, outbox: {}, checklist: {} }), emptyDemoData());
});

test("Inbox capacity rejects additions while preserving retries", () => {
  let data = emptyDemoData();
  for (let index = 0; index < 200; index++) data = createDemoSubmission(data, order, `capacity-${index}`, date).data;
  const snapshot = structuredClone(data);
  assert.equal(data.records.length, 200);
  assert.equal(data.outbox.length, 400);
  assert.throws(() => createDemoSubmission(data, order, "capacity-overflow", date), /full/i);
  assert.deepEqual(data, snapshot);
  const retry = createDemoSubmission(data, order, "capacity-0", date);
  assert.deepEqual(retry.data, data);
  assert.equal(retry.record.id, "capacity-0");
  const extra = { ...data.records[0], id: "corrupt-extra" };
  const parsed = parseDemoData({ ...data, records: [extra, ...data.records], outbox: [...data.outbox, ...data.outbox] });
  assert.equal(parsed.records.length, 201, "Restored or legacy valid records must not be silently truncated");
  assert.equal(parsed.outbox.length, 400, "Duplicate notification IDs are normalized without removing valid notifications");
});

test("Sample seeding is repeat-safe and leaves existing work intact", () => {
  const customer = createDemoSubmission(emptyDemoData(), order, "customer-existing", date);
  const seed = (data) => demoSamples().reduce((current, input, index) => createDemoSubmission(current, input, `sample-${index + 1}`, date).data, data);
  const once = seed(customer.data);
  const twice = seed(once);
  assert.deepEqual(twice, once);
  assert.equal(once.records.length, demoSamples().length + 1);
  assert.equal(once.outbox.length, (demoSamples().length + 1) * 2);
  assert.deepEqual(once.records.find((record) => record.id === customer.record.id), customer.record);
});

test("Checklist defaults are independent and reviewed state survives reload", () => {
  const first = emptyDemoData();
  const second = emptyDemoData();
  assert.deepEqual(Object.keys(first.checklist), demoChecklistKeys);
  assert.ok(Object.values(first.checklist).every((status) => status === "needs-confirmation"));
  first.checklist.shipping = "reviewed";
  assert.equal(second.checklist.shipping, "needs-confirmation");
  const parsed = parseDemoData({ ...first, checklist: { ...first.checklist, returns: "approved", unknown: "reviewed" } });
  assert.equal(parsed.checklist.shipping, "reviewed");
  assert.equal(parsed.checklist.returns, "needs-confirmation");
  assert.ok(!Object.hasOwn(parsed.checklist, "unknown"));
});

test("Demo data uses separate storage and preserves cart/favourites", () => {
  assert.notEqual(DEMO_STORAGE_KEY, STORE_KEY);
  const cart = { items: [{ id: honey.id, quantity: 3 }], wishlist: [honey.id] };
  const storage = new Map([[STORE_KEY, JSON.stringify(cart)]]);
  storage.set(DEMO_STORAGE_KEY, JSON.stringify(createDemoSubmission(emptyDemoData(), order, "separate-storage", date).data));
  storage.set(DEMO_STORAGE_KEY, JSON.stringify(emptyDemoData()));
  assert.deepEqual(parseStoredCart(JSON.parse(storage.get(STORE_KEY))), cart);
  assert.deepEqual(parseDemoData(JSON.parse(storage.get(DEMO_STORAGE_KEY))), emptyDemoData());
});

test("Legacy version 1 data gains an empty Trash without losing records", () => {
  const original = createDemoSubmission(emptyDemoData(), order, "legacy-record", date).data;
  const legacy = structuredClone(original);
  delete legacy.trash;
  assert.deepEqual(parseDemoData(legacy), original);
});

test("Deleting and restoring keeps the original record, price, notes and notification previews", () => {
  let original = emptyDemoData();
  for (const key of ["first", "middle", "last"]) original = createDemoSubmission(original, order, key, date).data;
  original.records[1].notes = "Follow up after delivery";
  original.records[1].status = "reviewing";
  const before = structuredClone(original);
  const now = Date.parse(date);
  const deleted = trashDemoRecord(original, "middle", now);
  assert.deepEqual(original, before);
  assert.deepEqual(deleted.records.map((entry) => entry.id), ["last", "first"]);
  assert.equal(deleted.outbox.length, 4);
  assert.equal(deleted.trash.length, 1);
  const entry = deleted.trash[0];
  assert.equal(entry.position, 1);
  assert.equal(Date.parse(entry.expiresAt) - Date.parse(entry.deletedAt), DEMO_TRASH_RETENTION_MS);
  assert.deepEqual(entry.record, original.records[1]);
  assert.deepEqual(entry.notifications, original.outbox.filter((item) => item.recordId === "middle"));
  const restored = restoreDemoRecord(deleted, entry.id, now + 1);
  assert.deepEqual(restored.records, before.records);
  assert.deepEqual([...restored.outbox].sort((a, b) => a.id.localeCompare(b.id)), [...before.outbox].sort((a, b) => a.id.localeCompare(b.id)));
  assert.deepEqual(restored.trash, []);
  assert.throws(() => trashDemoRecord(deleted, "middle", now), /no longer exists/i);
  assert.throws(() => createDemoSubmission(deleted, order, "middle", date), /trash/i);
  assert.equal(createDemoSubmission(deleted, order, "another-record", date).data.records.length, 3);
});

test("Trash expires at exactly 30 days and restores are refused after expiry", () => {
  const now = Date.parse("2026-02-01T12:34:56.000Z");
  const deleted = trashDemoRecord(createDemoSubmission(emptyDemoData(), order, "expiry-record", date).data, "expiry-record", now);
  const expires = now + 30 * 24 * 60 * 60 * 1000;
  assert.equal(DEMO_TRASH_RETENTION_MS, 30 * 24 * 60 * 60 * 1000);
  assert.equal(parseDemoData(deleted, expires - 1).trash.length, 1);
  assert.equal(restoreDemoRecord(deleted, deleted.trash[0].id, expires - 1).records.length, 1);
  assert.equal(parseDemoData(deleted, expires).trash.length, 0);
  assert.throws(() => restoreDemoRecord(deleted, deleted.trash[0].id, expires), /expired/i);
  assert.equal(parseDemoData(deleted, expires + 1).trash.length, 0);
  assert.equal(deleted.trash.length, 1, "Pruning must not mutate the supplied snapshot");
});

test("Reset moves all records into Trash and keeps earlier deletions restorable", () => {
  const now = Date.parse(date);
  let original = createDemoSubmission(emptyDemoData(), order, "earlier-delete", date).data;
  original = trashDemoRecord(original, "earlier-delete", now - 1000);
  for (const key of ["reset-one", "reset-two", "reset-three"]) original = createDemoSubmission(original, order, key, date).data;
  original.checklist.shipping = "reviewed";
  const reset = resetDemoData(original, now);
  assert.equal(reset.records.length, 0);
  assert.equal(reset.outbox.length, 0);
  assert.equal(reset.trash.length, 4);
  assert.equal(reset.checklist.shipping, "needs-confirmation");
  assert.deepEqual(reset.trash.at(-1), original.trash[0]);
  let restored = reset;
  for (const entry of reset.trash.slice(0, 3)) restored = restoreDemoRecord(restored, entry.id, now + 1);
  assert.deepEqual(restored.records, original.records);
  assert.equal(restored.outbox.length, original.outbox.length);
  assert.deepEqual(restored.trash, original.trash);
});

test("A conflicting restore cannot overwrite a current record or lose its Trash snapshot", () => {
  const now = Date.parse(date);
  const original = createDemoSubmission(emptyDemoData(), order, "restore-conflict", date).data;
  const deleted = trashDemoRecord(original, "restore-conflict", now);
  const conflict = { ...deleted, records: original.records, outbox: original.outbox };
  const before = structuredClone(conflict);
  assert.throws(() => restoreDemoRecord(conflict, deleted.trash[0].id, now + 1), /already exists/i);
  assert.deepEqual(conflict, before);
  const other = createDemoSubmission(emptyDemoData(), order, "different-record", date).data;
  other.outbox[0].id = deleted.trash[0].notifications[0].id;
  const notificationConflict = { ...deleted, records: other.records, outbox: other.outbox };
  assert.throws(() => restoreDemoRecord(notificationConflict, deleted.trash[0].id, now + 1), /already exists/i);
  assert.equal(notificationConflict.trash.length, 1);
});

test("Corrupt Trash fields cannot erase unrelated records or shorten retention", () => {
  const now = Date.parse(date);
  const original = createDemoSubmission(emptyDemoData(), order, "trash-valid", date).data;
  const deleted = trashDemoRecord(original, "trash-valid", now);
  const current = createDemoSubmission(deleted, order, "live-valid", date).data;
  const validEntry = deleted.trash[0];
  const broken = [null, {}, { ...validEntry, id: "bad-position", position: -1 }, { ...validEntry, id: "bad-date", deletedAt: "invalid" }, { ...validEntry, id: "bad-record", record: null }];
  const parsed = parseDemoData({ ...current, trash: [{ ...validEntry, expiresAt: new Date(now + 1000).toISOString(), notifications: [...validEntry.notifications, { ...validEntry.notifications[0], recordId: "unrelated" }] }, ...broken] }, now + 1001);
  assert.deepEqual(parsed.records, current.records);
  assert.deepEqual(parsed.outbox, current.outbox);
  assert.equal(parsed.trash.length, 1);
  assert.equal(Date.parse(parsed.trash[0].expiresAt), now + DEMO_TRASH_RETENTION_MS);
  assert.deepEqual(parsed.trash[0].notifications, validEntry.notifications);
  const missingNotifications = parseDemoData({ ...current, trash: [{ ...validEntry, notifications: null }] }, now);
  assert.equal(restoreDemoRecord(missingNotifications, validEntry.id, now).records.length, 2);
});

test("Trash and restored records have no eviction cap before 30 days", () => {
  const now = Date.parse(date);
  let data = emptyDemoData();
  for (let index = 0; index < 420; index++) {
    data = createDemoSubmission(data, order, `retained-${index}`, date).data;
    data = trashDemoRecord(data, `retained-${index}`, now);
  }
  assert.equal(parseDemoData(data, now + 1).trash.length, 420);
  for (const entry of [...data.trash]) data = restoreDemoRecord(data, entry.id, now + 1);
  assert.equal(data.records.length, 420);
  assert.equal(data.outbox.length, 840);
  const reloaded = parseDemoData(data, now + 1);
  assert.equal(reloaded.records.length, 420);
  assert.equal(reloaded.outbox.length, 840);
  assert.throws(() => createDemoSubmission(data, order, "new-at-capacity", date), /full/i);
});

test("Expiry is persisted on read and storage failures never report a completed mutation", () => {
  const now = Date.parse(date);
  const original = createDemoSubmission(emptyDemoData(), order, "storage-guard", date).data;
  const deleted = trashDemoRecord(original, "storage-guard", now);
  let raw = JSON.stringify(deleted), writes = 0, blocked = false;
  const storage = { getItem: () => raw, setItem: (_key, value) => { if (blocked) throw new Error("Storage full"); raw = value; writes++; } };
  assert.equal(readDemoStorage(storage, now + DEMO_TRASH_RETENTION_MS - 1).trash.length, 1);
  assert.equal(writes, 0);
  assert.equal(readDemoStorage(storage, now + DEMO_TRASH_RETENTION_MS).trash.length, 0);
  assert.equal(writes, 1);
  assert.equal(JSON.parse(raw).trash.length, 0);
  raw = JSON.stringify(deleted); blocked = true;
  assert.equal(readDemoStorage(storage, now + DEMO_TRASH_RETENTION_MS).trash.length, 0);
  assert.equal(JSON.parse(raw).trash.length, 1, "An unsuccessful sweep stays retryable on disk");
  blocked = false;
  assert.equal(readDemoStorage(storage, now + DEMO_TRASH_RETENTION_MS + 1).trash.length, 0);
  assert.equal(JSON.parse(raw).trash.length, 0);
  raw = JSON.stringify(original); blocked = true;
  let visibleSnapshot = original;
  assert.throws(() => { visibleSnapshot = writeDemoStorage(storage, deleted); }, /Storage full/);
  assert.deepEqual(visibleSnapshot, original);
  assert.deepEqual(JSON.parse(raw), original);
  raw = JSON.stringify(deleted);
  assert.throws(() => { visibleSnapshot = writeDemoStorage(storage, restoreDemoRecord(deleted, deleted.trash[0].id, now + 1)); }, /Storage full/);
  assert.deepEqual(JSON.parse(raw), deleted);
});

const workflow = load("src/lib/commerce-workflow.ts");
test("Structured wholesale requests preserve historical selections and validate every field", () => {
  const wholesale = { productId: honey.id, quantity: 120, business: " Cafe ", destination: " Bangkok 10110 ", neededBy: "2026-12-10" };
  const input = { kind: "wholesale", locale: "en", name: "Wholesale buyer", email: "business@example.test", wholesale };
  const normalized = normalizeDemoInput(input);
  assert.equal(normalized.wholesale.business, "Cafe");
  assert.equal(normalized.wholesale.quantity, 120, "Wholesale estimates are not limited to retail cart quantity");
  for (const invalid of [{ quantity: 0 }, { quantity: 1.1 }, { quantity: 1000001 }, { productId: "unknown" }, { business: " " }, { destination: "" }, { neededBy: "2026-02-30" }]) assert.throws(() => normalizeDemoInput({ ...input, wholesale: { ...wholesale, ...invalid } }));
  const saved = createDemoSubmission(emptyDemoData(), input, "wholesale-request", date);
  assert.deepEqual(parseDemoData(saved.data).records[0].wholesale, normalized.wholesale);
  assert.equal(createDemoSubmission(saved.data, input, "wholesale-request", date, []).data.records.length, 1);
  assert.throws(() => createDemoSubmission(saved.data, { ...input, wholesale: { ...wholesale, quantity: 121 } }, "wholesale-request", date));
});
test("Mock order transitions require payment and tracking, preserve prices, and end refunds once", () => {
  let data = createDemoSubmission(emptyDemoData(), order, "workflow-order", date).data;
  const subtotal = data.records[0].subtotal;
  assert.throws(() => workflow.transitionDemoOrder(data, "workflow-order", "shipped"));
  for (const stage of ["awaiting-payment", "paid", "processing"]) data = workflow.transitionDemoOrder(data, "workflow-order", stage, {}, date);
  assert.throws(() => workflow.transitionDemoOrder(data, "workflow-order", "shipped"));
  data = workflow.transitionDemoOrder(data, "workflow-order", "shipped", { carrier: "Mock carrier", tracking: "MOCK-123" }, date);
  assert.equal(data.records[0].order.tracking, "MOCK-123");
  data = workflow.transitionDemoOrder(data, "workflow-order", "delivered", {}, date);
  data = workflow.transitionDemoOrder(data, "workflow-order", "refunded", {}, date);
  assert.equal(data.records[0].subtotal, subtotal); assert.equal(data.records[0].order.mode, "mock");
  assert.throws(() => workflow.transitionDemoOrder(data, "workflow-order", "refunded"));
  assert.equal(new Set(data.outbox.map((notice) => notice.id)).size, data.outbox.length);
  assert.deepEqual(parseDemoData(data), data);
});
test("Cancellation is allowed only before payment; assignment and notes preserve an activity trail", () => {
  let data = createDemoSubmission(emptyDemoData(), order, "assigned-order", date).data;
  data = workflow.updateDemoRequest(data, "assigned-order", { assignedTo: " Editor A ", status: "reviewing", notes: "Follow up" }, date);
  assert.equal(data.records[0].assignedTo, "Editor A"); assert.equal(data.records[0].activity.length, 2);
  assert.equal(workflow.updateDemoRequest(data, "assigned-order", { assignedTo: "Editor A" }, date), data);
  data = workflow.transitionDemoOrder(data, "assigned-order", "cancelled", {}, date);
  assert.throws(() => workflow.transitionDemoOrder(data, "assigned-order", "paid"));
  const paid = createDemoSubmission(emptyDemoData(), { ...order, payment: "demo-paid" }, "paid-order", date).data;
  assert.throws(() => workflow.transitionDemoOrder(paid, "paid-order", "cancelled"));
  assert.throws(() => workflow.updateDemoRequest(data, "assigned-order", { assignedTo: "x".repeat(101) }));
});
test("Declined payment retry updates the same record outcome and survives reload and original-key retries", () => {
  const input = { ...order, payment: "demo-failed" };
  const initial = createDemoSubmission(emptyDemoData(), input, "declined-retry", date);
  const fingerprint = initial.record.fingerprint;
  const paid = workflow.transitionDemoOrder(initial.data, initial.record.id, "paid", {}, date);
  assert.equal(paid.records.length, 1); assert.equal(paid.records[0].id, initial.record.id);
  assert.equal(paid.records[0].payment, "demo-paid"); assert.equal(paid.records[0].submittedPayment, "demo-failed");
  assert.equal(paid.records[0].fingerprint, fingerprint);
  assert.deepEqual(parseDemoData(paid), paid);
  assert.equal(createDemoSubmission(paid, input, initial.record.id, date).record.payment, "demo-paid");
  const refunded = workflow.transitionDemoOrder(paid, initial.record.id, "refunded", {}, date);
  assert.equal(refunded.records[0].payment, "demo-refunded");
  assert.deepEqual(parseDemoData(refunded), refunded);
  assert.equal(createDemoSubmission(refunded, input, initial.record.id, date).record.payment, "demo-refunded");
  const legacyInconsistent = structuredClone(paid);
  legacyInconsistent.records[0].payment = "demo-failed"; delete legacyInconsistent.records[0].submittedPayment;
  const repaired = parseDemoData(legacyInconsistent);
  assert.equal(repaired.records[0].payment, "demo-paid"); assert.equal(repaired.records[0].submittedPayment, "demo-failed");
});
test("Manual mock delivery retries only its notification, retains success, and enforces the limit", () => {
  let data = createDemoSubmission(emptyDemoData(), order, "outbox-order", date).data;
  const [first, second] = data.outbox;
  data = workflow.retryDemoNotification(data, first.id, "success", date);
  assert.equal(data.outbox[0].state, "mock-delivered");
  assert.throws(() => workflow.retryDemoNotification(data, first.id, "success", date));
  for (let i = 0; i < workflow.MAX_OUTBOX_ATTEMPTS; i++) data = workflow.retryDemoNotification(data, second.id, "failure", date);
  assert.equal(data.outbox[1].state, "exhausted"); assert.equal(data.outbox.length, 2);
  assert.throws(() => workflow.retryDemoNotification(data, second.id, "success", date));
  assert.equal(data.outbox[0].attempts, 1);
  assert.deepEqual(parseDemoData(data).outbox, data.outbox);
});
await assert.rejects(workflow.disabledShippingProvider.createShipment({ reference: "test", idempotencyKey: "test" }), /not configured/);
const mock = load("src/lib/mock-checkout.ts");
const shippingRules = [
  { id: "fallback", label: "Test default", postcodePrefix: "*", fee: 80, freeOver: 1000 },
  { id: "specific", label: "Test prefix", postcodePrefix: "10", fee: 45.5, freeOver: null },
];
test("Mock shipping validates rules and matches specific coverage without inventing defaults", () => {
  assert.deepEqual(mock.normalizeMockShippingRules(shippingRules), shippingRules);
  for (const bad of [{ fee: -1 }, { fee: 0.001 }, { fee: "80" }, { freeOver: -1 }, { label: " " }, { postcodePrefix: "12x" }]) assert.throws(() => mock.normalizeMockShippingRules([{ ...shippingRules[0], ...bad }]));
  assert.throws(() => mock.normalizeMockShippingRules([shippingRules[0], { ...shippingRules[0], id: "duplicate-prefix" }]));
  assert.equal(mock.quoteMockShipping([], "10110", 960).reason, "unconfigured");
  assert.equal(mock.quoteMockShipping(shippingRules, "", 960).reason, "destination-missing");
  assert.equal(mock.quoteMockShipping([shippingRules[1]], "50000", 960).reason, "unsupported");
  assert.equal(mock.quoteMockShipping(shippingRules, "10110", 960).fee, 45.5);
  assert.equal(mock.quoteMockShipping(shippingRules, "10110", 960).total, 1005.5);
  assert.equal(mock.quoteMockShipping(shippingRules, "50000", 999).fee, 80);
  assert.equal(mock.quoteMockShipping(shippingRules, "50000", 1000).fee, 0);
});
test("Thai free-delivery quotes persist independently of mock rules and original-key retries", () => {
  const input = { ...order, locale: "th", customer: { postcode: "10110" } };
  const result = createDemoSubmission({ ...emptyDemoData(), mockShippingRules: shippingRules }, input, "quoted-order", date);
  assert.equal(result.record.shippingQuote.fee, 0);
  assert.equal(result.record.shippingQuote.total, 700);
  assert.ok(result.data.outbox.every((notice) => notice.body.includes("700")));
  const changed = { ...result.data, mockShippingRules: [] };
  assert.equal(createDemoSubmission(changed, input, "quoted-order", date).record.shippingQuote.fee, 0);
  assert.deepEqual(parseDemoData(changed), changed);
  assert.equal(createDemoSubmission(changed, { ...input, customer: { postcode: "" } }, "new-unquoted", date).record.shippingQuote.state, "pending");
  assert.equal(createDemoSubmission(changed, order, "usd-unquoted", date).record.shippingQuote, undefined);
  const tampered = structuredClone(result.data); tampered.records[0].shippingQuote.total = 1;
  assert.equal(parseDemoData(tampered).records[0].shippingQuote, undefined);
  assert.equal(parseDemoData(tampered).records.length, 1, "Invalid derived quotes must not discard the saved request");
});
test("Paid orders and failed-payment holds share stock; retries never double allocate", () => {
  const products = [{ ...honey, stock: 4 }], now = Date.parse(date);
  const input = { ...order, payment: "demo-failed" };
  const first = createDemoSubmission(emptyDemoData(), input, "held-stock", date, products);
  assert.equal(mock.availableMockStock(products[0], first.data.inventory, now), 2);
  assert.deepEqual(createDemoSubmission(first.data, input, "held-stock", date, products).data.inventory, first.data.inventory);
  const paid = workflow.transitionDemoOrder(first.data, first.record.id, "paid", {}, date, products);
  assert.equal(paid.inventory.length, 1); assert.equal(paid.inventory[0].state, "committed");
  const second = createDemoSubmission(paid, { ...order, payment: "demo-paid" }, "second-stock", date, products);
  const before = structuredClone(second.data);
  assert.equal(mock.availableMockStock(products[0], second.data.inventory, now), 0);
  assert.throws(() => createDemoSubmission(second.data, { ...order, payment: "demo-paid" }, "oversold-stock", date, products), mock.MockStockError);
  assert.deepEqual(second.data, before);
  assert.equal(mock.availableMockStock(honey, second.data.inventory, now), null, "Unconfirmed stock must stay unknown");
});
test("Expired reservations release stock and payment retries revalidate remaining availability", () => {
  const products = [{ ...honey, stock: 2 }], now = Date.parse(date);
  const first = createDemoSubmission(emptyDemoData(), { ...order, payment: "demo-failed" }, "expiring-stock", date, products);
  assert.equal(mock.availableMockStock(products[0], first.data.inventory, now + mock.MOCK_RESERVATION_MS - 1), 0);
  const expiredAt = now + mock.MOCK_RESERVATION_MS;
  const expired = parseDemoData(first.data, expiredAt);
  assert.equal(expired.inventory[0].state, "released");
  assert.equal(mock.availableMockStock(products[0], expired.inventory, expiredAt), 2);
  const competing = createDemoSubmission(expired, { ...order, payment: "demo-paid" }, "competing-stock", new Date(expiredAt).toISOString(), products).data;
  assert.throws(() => workflow.transitionDemoOrder(competing, first.record.id, "paid", {}, new Date(expiredAt).toISOString(), products), mock.MockStockError);
  assert.equal(competing.records.find((record) => record.id === first.record.id).payment, "demo-failed");
  const cancelled = workflow.transitionDemoOrder(first.data, first.record.id, "cancelled", {}, date, products);
  assert.equal(mock.availableMockStock(products[0], cancelled.inventory, now), 2);
});
test("Refunds release unshipped stock and require received-return confirmation after shipment", () => {
  const products = [{ ...honey, stock: 2 }], now = Date.parse(date);
  const paid = createDemoSubmission(emptyDemoData(), { ...order, payment: "demo-paid" }, "refund-stock", date, products).data;
  const early = workflow.transitionDemoOrder(paid, "refund-stock", "refunded", {}, date, products);
  assert.equal(mock.availableMockStock(products[0], early.inventory, now), 2);
  let shipped = workflow.transitionDemoOrder(paid, "refund-stock", "processing", {}, date, products);
  shipped = workflow.transitionDemoOrder(shipped, "refund-stock", "shipped", { carrier: "Mock", tracking: "TEST-1" }, date, products);
  const refundOnly = workflow.transitionDemoOrder(shipped, "refund-stock", "refunded", {}, date, products);
  assert.equal(mock.availableMockStock(products[0], refundOnly.inventory, now), 0);
  const received = workflow.transitionDemoOrder(shipped, "refund-stock", "refunded", { restock: true }, date, products);
  assert.equal(mock.availableMockStock(products[0], received.inventory, now), 2);
  assert.throws(() => workflow.transitionDemoOrder(paid, "refund-stock", "processing", { restock: true }, date, products));
});
test("Stock commitments survive Trash expiry, restore and reset without reusing old order references", () => {
  const products = [{ ...honey, stock: 2 }], now = Date.parse(date);
  const initial = createDemoSubmission({ ...emptyDemoData(), mockShippingRules: shippingRules }, { ...order, payment: "demo-paid" }, "retained-stock", date, products).data;
  const deleted = trashDemoRecord(initial, "retained-stock", now);
  assert.equal(mock.availableMockStock(products[0], deleted.inventory, now), 0);
  const restored = restoreDemoRecord(deleted, deleted.trash[0].id, now + 1);
  assert.deepEqual(restored.inventory, initial.inventory);
  const reset = resetDemoData(initial, now);
  assert.deepEqual(reset.inventory, initial.inventory); assert.deepEqual(reset.mockShippingRules, shippingRules);
  const expired = parseDemoData(deleted, now + DEMO_TRASH_RETENTION_MS);
  assert.equal(expired.trash.length, 0); assert.equal(expired.inventory.length, 1);
  assert.throws(() => createDemoSubmission(expired, order, "retained-stock", date, products), /previously used/);
  assert.throws(() => createDemoSubmission(expired, { ...order, payment: "demo-paid" }, "new-stock", date, products), mock.MockStockError);
});
test("Legacy saved paid orders gain conservative stock commitments without losing content", () => {
  const initial = createDemoSubmission(emptyDemoData(), { ...order, payment: "demo-paid" }, "legacy-paid", date).data;
  const old = structuredClone(initial); delete old.inventory; delete old.mockShippingRules; delete old.records[0].shippingQuote;
  const upgraded = parseDemoData(old);
  assert.deepEqual(upgraded.records, old.records); assert.deepEqual(upgraded.outbox, old.outbox);
  assert.equal(upgraded.inventory[0].state, "committed"); assert.deepEqual(upgraded.mockShippingRules, []);
  assert.deepEqual(parseDemoData(upgraded), upgraded);
});
console.log(`PASS: ${checked} demo checks for commerce, shipping quotes, inventory reservations, wholesale validation, lifecycle, activity, retry limits, Trash and storage safety. Payment/shipping adapters remain disabled. No external services called.`);

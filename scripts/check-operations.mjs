import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { randomUUID, scryptSync } from "node:crypto";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url), cache = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const entry = { exports: {} }; cache.set(filename, entry);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const require = (name) => name === "next/cache" ? { revalidatePath() {}, unstable_cache: (fn) => fn } : name.startsWith("@/") ? load(`src/${name.slice(2)}.ts`) : name.startsWith(".") ? load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`))) : nativeRequire(name);
  new Function("require", "module", "exports", compiled)(require, entry, entry.exports); return entry.exports;
}
fs.mkdirSync(path.join(root, "output"), { recursive: true });
const directory = fs.mkdtempSync(path.join(root, "output", "operations-check-"));
const environment = { ...process.env }, previousFetch = globalThis.fetch;
let checks = 0;
const pass = (label) => { checks++; console.log(`PASS: ${label}`); };
const key = () => randomUUID();
try {
  process.env.NEXT_PUBLIC_DEMO_MODE = "true"; process.env.CMS_LOCAL_DATA_DIR = directory;
  delete process.env.VERCEL; delete process.env.MONGODB_URI; delete process.env.CMS_STORAGE; delete process.env.CMS_AUTH_MODE;
  globalThis.fetch = async () => { throw new Error("External requests are prohibited in operations checks"); };
  const service = load("src/lib/operations/service.ts"), { submitSharedDemo } = load("src/lib/operations/public-demo.ts");
  const { operationsRepository: repository, normalizeOperationsQuery } = load("src/lib/operations/repository.ts");
  const defaults = load("src/lib/cms/defaults.ts");
  const products = defaults.defaultContent().products.map((product) => ({ ...product, stock: 2 }));
  const deps = { repository, products, role: "owner", actor: "QA owner", now: "2026-10-05T01:00:00.000Z" };
  const list = (query = "") => repository.list(normalizeOperationsQuery(new URLSearchParams(query)));
  const table = (name) => JSON.parse(fs.readFileSync(path.join(directory, "operations.json"), "utf8")).tables[name];
  const input = { kind: "contact", locale: "en", name: "Synthetic customer", email: "customer@example.invalid", message: "A synthetic enquiry for regression checks." };
  const orderInput = { ...input, locale: "th", kind: "order", payment: "enquiry", items: [{ id: products[0].id, quantity: 2, unitPrice: 0 }], customer: { postcode: "10110" } };
  const createCommand = { action: "create", key: key(), input };
  const one = (await service.executeOperations(createCommand, deps)).record;
  assert.deepEqual((await service.executeOperations(createCommand, deps)).record, one);
  assert.equal((await list()).total, 1); assert.equal(Object.keys(table("outbox")).length, 2);
  await assert.rejects(service.executeOperations({ ...createCommand, input: { ...input, message: "Different message" } }, deps), (error) => error.code === "OPERATIONS_KEY_CONFLICT");
  pass("request, two outbox messages and command receipt are atomic and idempotent");

  const edits = await Promise.allSettled(["First staff", "Second staff"].map((assignedTo) => service.executeOperations({ action: "update", key: key(), id: one.id, revision: 0, patch: { assignedTo, notes: assignedTo } }, deps)));
  assert.equal(edits.filter((value) => value.status === "fulfilled").length, 1);
  assert.equal(edits.find((value) => value.status === "rejected").reason.code, "OPERATIONS_CONFLICT");
  let current = await service.operationsDetail(one.id, repository);
  assert.equal(current.revision, 1); assert.equal(current.notes, current.assignedTo); assert.equal(current.activity.at(-1).actor, "QA owner");
  assert.equal((await list("assignment=assigned&status=new&q=synthetic")).total, 1);
  assert.equal((await list("assignment=unassigned")).total, 0);
  pass("concurrent staff edits reject stale revisions, preserve the winning draft and audit the actor");

  for (const command of [
    { action: "update", key: key(), id: one.id, revision: 1, patch: { payment: "demo-paid" } },
    { action: "transition", key: key(), id: one.id, revision: 1, stage: "paid", restock: true },
    { action: "archive", key: key(), id: "../state", revision: 0 },
    { action: "update", key: key(), id: one.id, revision: 1, patch: { notes: "x".repeat(5001) } },
  ]) await assert.rejects(service.executeOperations(command, deps), (error) => error.status === 400);
  for (const command of [createCommand, { action: "shipping", key: key(), revision: 0, rules: [] }, { action: "transition", key: key(), id: one.id, revision: 1, stage: "paid" }, { action: "deliver", key: key(), id: `${one.id}-created-customer`, revision: 0, outcome: "success" }]) await assert.rejects(service.executeOperations(command, { ...deps, role: "editor" }), (error) => error.status === 403);
  pass("crafted fields and financial actions cannot bypass validation or editor permissions");

  current = (await service.executeOperations({ action: "archive", key: key(), id: one.id, revision: current.revision }, { ...deps, role: "editor" })).record;
  assert.equal((await list()).total, 0); assert.equal((await list("archived=true")).total, 1);
  current = (await service.executeOperations({ action: "restore", key: key(), id: one.id, revision: current.revision }, deps)).record;
  assert.equal(current.notes, current.assignedTo); assert.equal(Object.keys(table("outbox")).length, 2);
  pass("archive and restore retain customer history and outbox entries");

  await service.executeOperations({ action: "shipping", key: key(), revision: 0, rules: [{ id: "local-rule", label: "Synthetic shipping", postcodePrefix: "10", fee: 30, freeOver: null }] }, deps);
  let first = (await service.executeOperations({ action: "create", key: key(), input: orderInput }, deps)).record;
  let second = (await service.executeOperations({ action: "create", key: key(), input: orderInput }, deps)).record;
  const orderIds = [first.id, second.id];
  assert.equal(first.items[0].lineTotal, 700); assert.equal(first.currency, "THB"); assert.equal(first.shippingQuote.fee, 0);
  await service.executeOperations({ action: "shipping", key: key(), revision: 1, rules: [] }, deps);
  assert.equal((await service.operationsDetail(first.id, repository)).shippingQuote.fee, 0);
  const reservations = await Promise.allSettled([first, second].map((record) => service.executeOperations({ action: "transition", key: key(), id: record.id, revision: 0, stage: "awaiting-payment" }, deps)));
  assert.equal(reservations.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(reservations.find((result) => result.status === "rejected").reason.code, "OPERATIONS_STOCK");
  first = reservations.find((result) => result.status === "fulfilled").value.record;
  second = await service.operationsDetail(orderIds.find((id) => id !== first.id), repository);
  assert.equal(second.order.stage, "enquiry"); assert.equal(second.revision, 0);
  assert.equal(table("inventory")[products[0].id].reservations.length, 1);
  pass("simultaneous orders cannot oversell finite stock; Thai bundle and free-delivery snapshots stay authoritative");

  const awaiting = { action: "transition", key: key(), id: second.id, revision: 0, stage: "awaiting-payment" };
  const later = { ...deps, now: "2026-10-05T01:16:00.000Z" };
  second = (await service.executeOperations(awaiting, later)).record;
  await assert.rejects(service.executeOperations({ action: "transition", key: key(), id: first.id, revision: first.revision, stage: "paid" }, later), (error) => error.code === "OPERATIONS_STOCK");
  const pay = { action: "transition", key: key(), id: second.id, revision: second.revision, stage: "paid" };
  second = (await service.executeOperations(pay, later)).record;
  assert.equal((await service.executeOperations(pay, later)).record.id, second.id);
  assert.equal(table("inventory")[products[0].id].committed, 2); assert.equal(table("inventory")[products[0].id].reservations.length, 0);
  second = (await service.executeOperations({ action: "transition", key: key(), id: second.id, revision: second.revision, stage: "processing" }, later)).record;
  await assert.rejects(service.executeOperations({ action: "transition", key: key(), id: second.id, revision: second.revision, stage: "shipped" }, later), (error) => error.status === 400);
  second = (await service.executeOperations({ action: "transition", key: key(), id: second.id, revision: second.revision, stage: "shipped", carrier: "Mock carrier", tracking: "SYNTHETIC-ONLY" }, later)).record;
  assert.match(table("outbox")[`${second.id}-shipped-customer`].body, /SYNTHETIC-ONLY/);
  assert.match(table("outbox")[`${second.id}-shipped-customer`].body, /฿0/);
  second = (await service.executeOperations({ action: "transition", key: key(), id: second.id, revision: second.revision, stage: "refunded", restock: false }, later)).record;
  assert.equal(second.payment, "demo-refunded"); assert.equal(table("inventory")[products[0].id].committed, 2);
  pass("expired reservations revalidate, payment commits once, shipment needs tracking and refunds do not silently restock shipped goods");

  let notice = table("outbox")[`${one.id}-created-customer`];
  const delivery = { action: "deliver", key: key(), id: notice.id, revision: notice.revision, outcome: "success" };
  await assert.rejects(service.executeOperations(delivery, { ...deps, afterDelivery: async () => { throw new Error("Simulated crash after provider receipt"); } }), /Simulated crash/);
  notice = table("outbox")[notice.id]; assert.equal(notice.state, "processing"); assert.equal(notice.attempts, 1);
  const retryResults = await Promise.all([service.executeOperations(delivery, deps), service.executeOperations(delivery, deps)]);
  assert.ok(retryResults.every((result) => result.notice.state === "mock-delivered")); assert.equal(Object.keys(table("deliveries")).length, 1); assert.equal(table("outbox")[notice.id].attempts, 1);
  await assert.rejects(service.executeOperations({ ...delivery, key: key(), revision: 2 }, deps), (error) => error.code === "OPERATIONS_RETRY_LIMIT");
  pass("interrupted provider acknowledgement and concurrent retries resolve the same durable receipt without a second delivery");

  notice = table("outbox")[`${one.id}-created-staff`];
  const interrupted = { action: "deliver", key: key(), id: notice.id, revision: 0, outcome: "failure" };
  await assert.rejects(service.executeOperations(interrupted, { ...deps, afterDelivery: async () => { throw new Error("Interrupted"); } }));
  notice = table("outbox")[notice.id];
  notice = (await service.executeOperations({ action: "resolve-notice", key: key(), id: notice.id, revision: notice.revision }, deps)).notice;
  for (let index = 0; index < 2; index++) notice = (await service.executeOperations({ action: "deliver", key: key(), id: notice.id, revision: notice.revision, outcome: "failure" }, deps)).notice;
  assert.equal(notice.attempts, 3); assert.equal(notice.state, "exhausted");
  await assert.rejects(service.executeOperations({ action: "deliver", key: key(), id: notice.id, revision: notice.revision, outcome: "success" }, deps), (error) => error.code === "OPERATIONS_RETRY_LIMIT");
  pass("manual resolution preserves a failed attempt and retries stop at the configured three-attempt limit");

  const raw = { _id: key(), name: "Existing enquiry", email: "existing@example.invalid", message: "A previously saved enquiry", subject: "general", locale: "th", createdAt: new Date() };
  assert.equal(await service.ingestOperationsRequest("contact", raw, repository), true);
  const imported = await service.operationsDetail(`contact-${raw._id}`, repository);
  await service.executeOperations({ action: "archive", key: key(), id: imported.id, revision: 0 }, deps);
  assert.equal(await service.ingestOperationsRequest("contact", raw, repository), false);
  assert.equal((await service.operationsDetail(imported.id, repository)).archived, true);
  const historicalOrder = { _id: key(), locale: "en", reference: "VT-ORIGINAL", customer: { name: "Original", email: "original@example.invalid" }, items: [{ id: "retired-product", quantity: 1, unitPrice: 123 }], createdAt: new Date() };
  await service.ingestOperationsRequest("order", historicalOrder, repository);
  assert.equal((await service.operationsDetail(`order-${historicalOrder._id}`, repository)).items[0].unitPrice, 123);
  const foreignHistory = { ...historicalOrder, _id: key(), currency: "USD", items: [{ id: "retired-product", quantity: 2, unitPrice: 50, lineTotal: 100 }] };
  await service.ingestOperationsRequest("order", foreignHistory, repository);
  const importedForeign = await service.operationsDetail(`order-${foreignHistory._id}`, repository);
  assert.equal(importedForeign.currency, "USD"); assert.equal(importedForeign.subtotal, 100);
  pass("source replay does not revive archived requests and preserves historical prices for retired products");

  const publicBody = { submissionId: key(), input, consent: true, website: "" };
  const shared = await submitSharedDemo(publicBody, deps);
  assert.deepEqual(await submitSharedDemo(publicBody, { ...deps, products: [] }), shared);
  assert.equal((await service.operationsDetail(shared.id, repository)).source, "website-test");
  await assert.rejects(submitSharedDemo({ ...publicBody, input: { ...input, message: "Changed after saved" } }, deps), (error) => error.code === "OPERATIONS_KEY_CONFLICT");
  for (const body of [{ ...publicBody, consent: false }, { ...publicBody, website: "spam" }, { ...publicBody, input: { ...input, payment: "demo-paid" } }, { ...publicBody, input: { ...input, kind: "wholesale" } }]) await assert.rejects(submitSharedDemo(body, deps), (error) => error.status === 400);
  const customer = { name: input.name, email: input.email, phone: "+66000000000", address: "Synthetic address", district: "Synthetic district", province: "Synthetic province", postcode: "10110", notes: "" };
  const publicOrder = { submissionId: key(), consent: true, input: { ...orderInput, phone: customer.phone, customer } };
  const savedOrder = await submitSharedDemo(publicOrder, deps);
  assert.equal((await service.operationsDetail(savedOrder.id, repository)).items[0].lineTotal, 700);
  assert.deepEqual(await submitSharedDemo(publicOrder, { ...deps, products: [] }), savedOrder);
  const foreignCustomer = { ...customer, country: "United Kingdom", postcode: "SW1A 1AA" };
  const foreignOrder = { submissionId: key(), consent: true, input: { ...orderInput, locale: "en", currency: "THB", phone: foreignCustomer.phone, customer: foreignCustomer } };
  const foreignSaved = await submitSharedDemo(foreignOrder, deps);
  const foreignRecord = await service.operationsDetail(foreignSaved.id, repository);
  assert.equal(foreignRecord.currency, "USD", "The server ignores a client currency claim");
  assert.equal(foreignRecord.items[0].lineTotal, 100);
  assert.equal(foreignRecord.shippingQuote, undefined, "USD orders do not receive Thai delivery quotes");
  assert.deepEqual(await submitSharedDemo(foreignOrder, { ...deps, products: [] }), foreignSaved);
  await assert.rejects(submitSharedDemo({ ...foreignOrder, submissionId: key(), input: { ...foreignOrder.input, customer: { ...foreignCustomer, country: "" } } }, deps), (error) => error.status === 400);
  for (const [locale, country, district] of [["ar", "United Arab Emirates", "Dubai"], ["ar", "Qatar", "Doha"], ["en", "Singapore", "Singapore"]]) {
    const internationalCustomer = { ...customer, country, district, province: "", postcode: "" };
    const internationalOrder = { ...foreignOrder, submissionId: key(), input: { ...foreignOrder.input, locale, customer: internationalCustomer } };
    const internationalSaved = await submitSharedDemo(internationalOrder, deps);
    const internationalRecord = await service.operationsDetail(internationalSaved.id, repository);
    assert.equal(internationalRecord.customer.postcode, "");
    assert.equal(internationalRecord.customer.province, "");
    assert.equal(internationalRecord.shippingQuote, undefined);
    const omitted = structuredClone(internationalOrder);
    delete omitted.input.customer.province;
    delete omitted.input.customer.postcode;
    assert.deepEqual(await submitSharedDemo(omitted, deps), internationalSaved, "Empty and omitted optional fields preserve retry identity");
    assert.ok((await submitSharedDemo({ ...omitted, submissionId: key() }, deps)).id, "New shared enquiries accept omitted international fields");
    for (const change of [{ postcode: "--" }, { province: "x".repeat(101) }, { province: null }]) {
      await assert.rejects(submitSharedDemo({ ...internationalOrder, submissionId: key(), input: { ...internationalOrder.input, customer: { ...internationalCustomer, ...change } } }, deps), (error) => error.status === 400);
    }
  }
  for (const field of ["province", "postcode"]) await assert.rejects(submitSharedDemo({ ...publicOrder, submissionId: key(), input: { ...publicOrder.input, customer: { ...customer, [field]: "" } } }, deps), (error) => error.status === 400);
  pass("public test submissions require consent and valid data, reject payment claims and retain server prices across retries");

  const auth = load("src/lib/cms/auth.ts"), cmsApi = load("src/app/api/cms/operations/route.ts"), publicApi = load("src/app/api/demo/requests/route.ts");
  const origin = "http://127.0.0.1:3100";
  const request = (route, body, cookie = "", extra = {}) => new Request(`${origin}${route}`, { method: body === undefined ? "GET" : "POST", headers: { ...(body ? { origin, "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}), ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.equal((await cmsApi.GET(request("/api/cms/operations"))).status, 401);
  const cookie = (await auth.sessionCookie(request("/api/cms"))).split(";")[0];
  assert.equal((await cmsApi.POST(request("/api/cms/operations", { action: "sync" }, cookie, { origin: "https://external.invalid" }))).status, 403);
  const publicRequest = { ...publicBody, submissionId: key(), input: { ...input, email: "other-browser@example.invalid" } };
  assert.equal((await publicApi.POST(request("/api/demo/requests", publicRequest))).status, 201);
  const otherBrowser = await cmsApi.GET(request("/api/cms/operations?email=other-browser%40example.invalid", undefined, cookie));
  const visible = await otherBrowser.json(); assert.equal(visible.total, 1); assert.equal(visible.records[0].source, "website-test"); assert.equal(visible.records[0].email, publicRequest.input.email);
  const response = await publicApi.POST(request("/api/demo/requests", publicRequest));
  assert.equal(response.status, 201); assert.deepEqual(Object.keys(await response.json()).sort(), ["id", "reference", "status"]);
  assert.equal((await publicApi.POST(request("/api/demo/requests", publicRequest, "", { origin: "https://external.invalid" }))).status, 403);
  assert.equal((await publicApi.POST(new Request("https://store.invalid/api/demo/requests", { method: "POST", headers: { "content-type": "application/json", origin: "https://store.invalid" }, body: JSON.stringify(publicRequest) }))).status, 403);
  process.env.VERCEL = "1"; assert.equal((await publicApi.POST(request("/api/demo/requests", publicRequest))).status, 403); delete process.env.VERCEL;
  pass("public form API persists a request visible to a separate authenticated inbox session; origin and deployment boundaries hold");

  process.env.CMS_AUTH_MODE = "password"; process.env.CMS_SESSION_SECRET = "z".repeat(64);
  const salt = "c".repeat(32), password = "Synthetic operations test password";
  const staff = { id: "ops-editor", email: "editor@example.invalid", name: "QA editor", role: "editor", passwordHash: `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`, sessionVersion: 1 };
  process.env.CMS_STAFF_ACCOUNTS = JSON.stringify([staff, { ...staff, id: "ops-owner", email: "owner@example.invalid", role: "owner" }]);
  const editor = (await auth.sessionCookie(request("/api/cms"), { email: staff.email, password })).split(";")[0];
  assert.equal((await cmsApi.GET(request("/api/cms/operations", undefined, editor))).status, 200);
  assert.equal((await cmsApi.POST(request("/api/cms/operations", { action: "create", key: key(), input }, editor))).status, 403);
  current = await service.operationsDetail(shared.id, repository);
  assert.equal((await cmsApi.POST(request("/api/cms/operations", { action: "update", key: key(), id: current.id, revision: current.revision, patch: { notes: "Editor follow-up", assignedTo: "QA editor" } }, editor))).status, 200);
  assert.match((await service.operationsDetail(shared.id, repository)).activity.at(-1).actor, /QA editor/);
  await auth.revokeSession(request("/api/cms", undefined, editor));
  assert.equal((await cmsApi.GET(request("/api/cms/operations", undefined, editor))).status, 401);
  pass("live route handlers enforce staff roles, audit identity and revoked sessions");

  const before = fs.readFileSync(path.join(directory, "operations.json"), "utf8");
  await assert.rejects(repository.transaction(async (tx) => { await tx.put("requests", { ...one, name: "Rollback this" }); throw new Error("Atomic failure"); }), /Atomic failure/);
  assert.equal(fs.readFileSync(path.join(directory, "operations.json"), "utf8"), before);
  fs.writeFileSync(path.join(directory, "operations.json"), "broken fixture");
  await assert.rejects(repository.list(normalizeOperationsQuery(new URLSearchParams())), (error) => error.code === "OPERATIONS_STORAGE_INVALID");
  assert.equal(fs.readFileSync(path.join(directory, "operations.json"), "utf8"), "broken fixture");
  pass("failed transactions leave no partial writes and malformed storage is preserved instead of reset");

  // This verifies adapter contracts and retry boundaries without claiming a
  // real MongoDB transaction test or connecting to any external database.
  const dbModule = load("src/lib/db.ts");
  const originalDb = dbModule.getDb, originalClient = dbModule.getMongoClient;
  let durable = new Map(), starts = 0, ended = 0, indexCalls = 0, duplicateOnce = true;
  const options = [];
  const fakeDb = { collection(name) { return {
    async createIndexes() { indexCalls++; }, async createIndex() { indexCalls++; },
    async findOne(filter, opts) { assert.ok(opts.session.state); return structuredClone(opts.session.state.get(name)?.get(filter._id) || null); },
    async replaceOne(filter, value, opts) { assert.equal(opts.upsert, true); assert.ok(opts.session.state); if (!opts.session.state.has(name)) opts.session.state.set(name, new Map()); opts.session.state.get(name).set(filter._id, structuredClone({ _id: filter._id, ...value })); },
  }; } };
  const fakeClient = { startSession() { starts++; return {
    async withTransaction(fn, opts) { options.push(opts); this.state = structuredClone(durable); const result = await fn(); if (duplicateOnce) { duplicateOnce = false; throw Object.assign(new Error("Synthetic concurrent upsert"), { code: 11000 }); } durable = this.state; return result; },
    async endSession() { ended++; },
  }; } };
  Object.assign(process.env, { CMS_STORAGE: "mongodb", MONGODB_URI: "mongodb://synthetic.invalid/no-network", CLOUDINARY_CLOUD_NAME: "synthetic", CLOUDINARY_API_KEY: "synthetic", CLOUDINARY_API_SECRET: "synthetic" });
  dbModule.getDb = async () => fakeDb; dbModule.getMongoClient = async () => fakeClient;
  try {
    const command = { action: "create", key: key(), input };
    const result = await service.executeOperations(command, deps);
    assert.equal(starts, 2); assert.equal(ended, 2); assert.equal(indexCalls, 2);
    assert.equal(durable.get("vetra_operations_requests").size, 1);
    assert.equal(durable.get("vetra_operations_outbox").size, 2);
    assert.equal(durable.get("vetra_operations_commands").size, 1);
    assert.ok(options.every((entry) => entry.readConcern.level === "snapshot" && entry.writeConcern.w === "majority" && entry.maxCommitTimeMS === 10000));
    assert.equal((await service.executeOperations(command, deps)).record.id, result.record.id);
    const snapshot = structuredClone(durable);
    await assert.rejects(repository.transaction(async (tx) => { await tx.put("requests", { ...result.record, notes: "Must roll back" }); throw new Error("Synthetic transaction abort"); }), /Synthetic transaction abort/);
    assert.deepEqual(durable, snapshot); assert.equal(starts, ended);
    pass("MongoDB adapter uses majority/snapshot transactions, bounded duplicate-key retry, indexed access and closes aborted sessions");
  } finally { dbModule.getDb = originalDb; dbModule.getMongoClient = originalClient; }
  const arabicNotices = service.requestNotices({ ...one, locale: "ar", name: "عميل تجريبي", message: "استفسار تجريبي باللغة العربية" }, deps.now, "arabic-preview");
  assert.equal(arabicNotices.length, 2);
  assert.ok(arabicNotices.every((notice) => notice.subject.includes("استفسار") && notice.body.includes("للمحاكاة فقط")));
  assert.match(arabicNotices.find((notice) => notice.audience === "staff").recipient, /[\u0600-\u06ff]/u);
  assert.ok(arabicNotices.every((notice) => !notice.body.includes("undefined")));
  pass("Arabic shared enquiries produce Arabic notices for staff and customer without sending email");
  console.log(`\n${checks} operations checks passed. Isolated files: ${path.relative(root, directory)}`);
} finally {
  for (const name of Object.keys(process.env)) if (!(name in environment)) delete process.env[name];
  Object.assign(process.env, environment); globalThis.fetch = previousFetch;
}

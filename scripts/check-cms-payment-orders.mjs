/* Run through npm run test:payments. Fake database and CMS session; no network writes. */
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
  const moduleRecord = { exports: {} };
  const localRequire = (name) => Object.hasOwn(mocks, name) ? mocks[name] : nativeRequire(name);
  new Function("require", "module", "exports", compiled)(localRequire, moduleRecord, moduleRecord.exports);
  return moduleRecord.exports;
}

class CmsError extends Error {
  constructor(message, status = 400, code = "INVALID_REQUEST") { super(message); this.status = status; this.code = code; }
}
const saved = { payment_orders: [], payment_attempts: [] };
function matches(row, query) {
  return Object.entries(query).every(([key, expected]) => expected && typeof expected === "object" && "$in" in expected
    ? expected.$in.includes(row[key]) : row[key] === expected);
}
const db = {
  collection(name) {
    const rows = saved[name];
    assert.ok(rows, `Unexpected collection: ${name}`);
    return {
      async findOne(query) { return rows.find((row) => matches(row, query)) ?? null; },
      find(query) {
        let result = rows.filter((row) => matches(row, query));
        return {
          sort(spec) {
            result = [...result].sort((left, right) => {
              for (const [key, direction] of Object.entries(spec)) {
                const a = left[key] instanceof Date ? left[key].getTime() : left[key];
                const b = right[key] instanceof Date ? right[key].getTime() : right[key];
                if (a < b) return -direction;
                if (a > b) return direction;
              }
              return 0;
            });
            return this;
          },
          skip(count) { result = result.slice(count); return this; },
          limit(count) { result = result.slice(0, count); return this; },
          async toArray() { return result; },
        };
      },
    };
  },
};
const mocks = {
  "@/lib/db": { getDb: async () => db },
  "@/lib/cms/auth": {
    async withCmsIdentity(request, write, task) {
      assert.equal(write, false);
      if (request.headers.get("cookie") !== "cms=authorized") throw new CmsError("Sign in", 401, "UNAUTHENTICATED");
      return await task();
    },
    cmsErrorResponse: (error) => Response.json({ code: error.code ?? "UNAVAILABLE" }, { status: error.status ?? 503, headers: { "Cache-Control": "no-store" } }),
  },
  "@/lib/cms/validation": { CmsError },
  "@/lib/payments/orders": { paymentIdPattern: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i },
};
const { GET } = load("src/app/api/cms/payment-orders/route.ts", mocks);
const now = Date.now();
function order(status, reference, expiryMs) {
  const id = randomUUID();
  return {
    _id: id, reference, status,
    customer: { name: "Staff-visible Buyer", email: "private@example.test", phone: "0812345678", address: "Private address", district: "Bang Kapi", province: "Bangkok", postcode: "10240", notes: "Doorbell" },
    items: [{ id: "honey", name: "Honey", quantity: 1, lineTotalMinor: 38000 }],
    subtotalMinor: 38000, shippingMinor: 0, totalMinor: 38000, currency: "THB",
    createdAt: new Date(now - 300_000), paidAt: status === "paid" ? new Date(now - 120_000) : undefined,
    expiresAt: new Date(expiryMs), lastAttemptId: randomUUID(),
  };
}
const paid = order("paid", "VT-PAID", now + 300_000);
paid.paidAttemptId = paid.lastAttemptId;
const unknown = order("pending", "VT-UNKNOWN", now - 60_000);
const open = order("pending", "VT-OPEN", now + 1_800_000);
saved.payment_orders.push(paid, unknown, open);
saved.payment_attempts.push(
  { _id: paid.lastAttemptId, orderId: paid._id, status: "paid", provider: "stripe", providerPaymentId: "cs_paid", providerExpiresAtUnix: Math.floor(now / 1000) + 1800 },
  { _id: unknown.lastAttemptId, orderId: unknown._id, status: "uncertain", provider: "stripe", providerPaymentId: "cs_unknown", providerExpiresAtUnix: Math.floor(now / 1000) - 60 },
  { _id: open.lastAttemptId, orderId: open._id, status: "ready", provider: "stripe", providerPaymentId: "cs_open", providerExpiresAtUnix: Math.floor(now / 1000) + 1800 },
);
const initialSnapshot = JSON.stringify(saved);
const oldStorage = process.env.CMS_STORAGE;
process.env.CMS_STORAGE = "mongodb";
const request = (url, authorized = true) => new Request(`https://store.example.test${url}`, { headers: authorized ? { cookie: "cms=authorized" } : {} });

try {
  const denied = await GET(request(`/api/cms/payment-orders?id=${paid._id}`, false));
  assert.equal(denied.status, 401, "Unauthenticated callers cannot read order PII");
  assert.doesNotMatch(await denied.text(), /private@example\.test|Private address/);

  const paidResponse = await GET(request("/api/cms/payment-orders?group=paid"));
  assert.equal(paidResponse.status, 200);
  assert.match(paidResponse.headers.get("cache-control"), /no-store/);
  const paidList = await paidResponse.json();
  assert.deepEqual(paidList.orders.map((entry) => entry.reference), ["VT-PAID"]);
  assert.doesNotMatch(JSON.stringify(paidList), /private@example\.test|Private address/);

  const reviewResponse = await GET(request("/api/cms/payment-orders?group=review"));
  const reviewList = await reviewResponse.json();
  assert.equal(reviewList.orders.length, 2);
  const uncertainRow = reviewList.orders.find((entry) => entry.id === unknown._id);
  assert.equal(uncertainRow.status, "pending", "Elapsed local time never changes payment truth");
  assert.equal(uncertainRow.initiationWindowElapsed, true);
  assert.deepEqual(uncertainRow.attempt, { status: "uncertain", provider: "stripe", providerPaymentId: "cs_unknown" });
  assert.equal(reviewList.orders.find((entry) => entry.id === open._id).attempt.status, "ready");
  assert.doesNotMatch(JSON.stringify(reviewList), /private@example\.test|Private address/);

  const detailResponse = await GET(request(`/api/cms/payment-orders?id=${unknown._id}`));
  const detail = (await detailResponse.json()).order;
  assert.equal(detail.customer.email, "private@example.test", "Signed-in staff can access delivery details");
  assert.equal(detail.attempt.providerPaymentId, "cs_unknown");
  assert.equal(detail.attempt.status, "uncertain");
  assert.equal(detail.initiationWindowElapsed, true);
  assert.equal(detail.status, "pending");
  assert.ok(!Object.hasOwn(detail, "accessToken"));

  assert.equal((await GET(request("/api/cms/payment-orders?group=other"))).status, 400);
  assert.equal(JSON.stringify(saved), initialSnapshot, "Read-only CMS views never mutate orders or attempts");
  process.env.CMS_STORAGE = "local";
  const local = await (await GET(request("/api/cms/payment-orders?group=review"))).json();
  assert.equal(local.available, false, "Local demo has a neutral empty state");
  console.log("PASS: CMS payment groups are authenticated, paid/pending separated, provider references shown only to staff, and local expiry does not infer failure or mutate state.");
} finally {
  if (oldStorage === undefined) delete process.env.CMS_STORAGE;
  else process.env.CMS_STORAGE = oldStorage;
}

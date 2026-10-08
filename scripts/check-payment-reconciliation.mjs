/* Provider lookup and owner-only reconciliation checks; no network or DB writes. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHmac, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function load(relative, mocks = {}, cache = new Map()) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const record = { exports: {} };
  cache.set(filename, record);
  const resolve = (name) => Object.hasOwn(mocks, name) ? mocks[name]
    : name.startsWith("@/") ? load(`src/${name.slice(2)}.ts`, mocks, cache)
      : name.startsWith(".") ? load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`)), mocks, cache)
        : nativeRequire(name);
  new Function("require", "module", "exports", compiled)(resolve, record, record.exports);
  return record.exports;
}

const prior = { key: process.env.STRIPE_SECRET_KEY, webhook: process.env.STRIPE_WEBHOOK_SECRET, vercelEnv: process.env.VERCEL_ENV, vercel: process.env.VERCEL };
const priorFetch = globalThis.fetch;
process.env.VERCEL_ENV = "preview";
process.env.STRIPE_SECRET_KEY = "sk_test_offline-only";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_offline-only";

try {
  const providers = load("src/lib/payments/providers.ts");
  const stripe = providers.getProvider("stripe");
  for (const [environment, key, available] of [
    ["production", "sk_test_offline-only", false],
    ["production", "sk_live_offline-only", true],
    ["preview", "sk_test_offline-only", true],
    ["preview", "sk_live_offline-only", false],
    ["development", "sk_test_offline-only", true],
    ["unknown", "sk_test_offline-only", false],
  ]) {
    process.env.VERCEL_ENV = environment;
    process.env.STRIPE_SECRET_KEY = key;
    assert.equal(stripe.available, available, `${environment} must ${available ? "accept" : "reject"} ${key.slice(0, 7)} credentials`);
    assert.equal(providers.listAvailableProviders().some((provider) => provider.id === "stripe"), available);
    if (!available) await assert.rejects(stripe.verify({ rawBody: Buffer.from("{}"), signature: "invalid" }), (error) => error.kind === "unavailable", "Wrong-mode credentials must not process a webhook");
  }
  delete process.env.VERCEL_ENV;
  delete process.env.VERCEL;
  process.env.STRIPE_SECRET_KEY = "sk_test_offline-only";
  assert.equal(stripe.available, true, "Local test checkout remains available");
  process.env.STRIPE_SECRET_KEY = "sk_live_offline-only";
  assert.equal(stripe.available, false, "A live key cannot silently run in a local test rehearsal");
  process.env.VERCEL_ENV = "preview";
  process.env.STRIPE_SECRET_KEY = "sk_test_offline-only";
  const input = { providerPaymentId: "cs_test_saved", orderId: randomUUID(), attemptId: randomUUID(), reference: "VT-P-TEST", amountMinor: 38000, currency: "THB" };
  let currentStatus = "complete";
  let currentPaymentStatus = "paid";
  let mismatch = false;
  let providerLiveMode = false;
  let requests = 0;
  globalThis.fetch = async (url, options) => {
    requests++;
    assert.match(String(url), /\/v1\/checkout\/sessions\/cs_test_saved$/);
    assert.equal(options.method, "GET");
    return Response.json({
      id: input.providerPaymentId,
      client_reference_id: input.orderId,
      amount_total: mismatch ? input.amountMinor + 1 : input.amountMinor,
      currency: "thb", status: currentStatus, payment_status: currentPaymentStatus, livemode: providerLiveMode,
      metadata: { app: "vetra-store", orderId: input.orderId, attemptId: input.attemptId, reference: input.reference },
    });
  };
  assert.equal((await stripe.inspect(input)).status, "paid", "Only a provider-retrieved paid Session confirms payment");
  currentStatus = "expired"; currentPaymentStatus = "unpaid";
  assert.equal((await stripe.inspect(input)).status, "failed", "A provider-retrieved expired unpaid Session can release stock");
  currentStatus = "open";
  assert.equal((await stripe.inspect(input)).status, "pending", "An open Session keeps stock reserved");
  mismatch = true;
  await assert.rejects(stripe.inspect(input), (error) => error.kind === "uncertain", "Mismatched provider amount never settles an order");
  assert.equal(requests, 4);
  mismatch = false;
  providerLiveMode = true;
  await assert.rejects(stripe.inspect(input), (error) => error.kind === "uncertain", "A wrong-mode Session cannot settle an order");
  providerLiveMode = false;
  currentStatus = "complete"; currentPaymentStatus = "paid";
  const signedEvent = (livemode) => {
    const rawBody = Buffer.from(JSON.stringify({ id: "evt_mode_guard", type: "checkout.session.completed", livemode, data: { object: { id: input.providerPaymentId } } }));
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.`).update(rawBody).digest("hex");
    return { rawBody, signature: `t=${timestamp},v1=${signature}` };
  };
  await assert.rejects(stripe.verify(signedEvent(true)), (error) => error.kind === "invalid-webhook", "A signed wrong-mode event is rejected before provider lookup");
  assert.equal(requests, 5);
  process.env.VERCEL_ENV = "production";
  process.env.STRIPE_SECRET_KEY = "sk_live_offline-only";
  await assert.rejects(stripe.verify(signedEvent(false)), (error) => error.kind === "invalid-webhook", "Production rejects a signed test-mode event even with a live key");
  assert.equal(requests, 5);
  process.env.VERCEL_ENV = "preview";
  process.env.STRIPE_SECRET_KEY = "sk_test_offline-only";
  assert.equal((await stripe.verify(signedEvent(false))).status, "paid", "A signed same-mode event can use provider-verified state");
  providerLiveMode = true;
  await assert.rejects(stripe.verify(signedEvent(false)), (error) => error.kind === "uncertain", "A retrieved Session must match the signed event mode");
  providerLiveMode = false;

  class CmsError extends Error {
    constructor(message, status = 400, code = "INVALID_REQUEST") { super(message); this.status = status; this.code = code; }
  }
  const order = { _id: input.orderId, reference: input.reference, status: "pending", requiresPaymentReview: false };
  const attempt = { _id: input.attemptId, orderId: input.orderId, provider: "stripe", providerPaymentId: input.providerPaymentId, currency: "THB", amountMinor: input.amountMinor, status: "ready" };
  let inspectionCount = 0;
  const applied = [];
  const db = { collection(name) { return { async findOne(query) {
    if (name === "payment_orders") return query._id === order._id ? order : null;
    if (name === "payment_attempts") return query._id === attempt._id && (!query.orderId || query.orderId === attempt.orderId) ? attempt : null;
    throw new Error(`Unexpected collection: ${name}`);
  } }; } };
  const route = load("src/app/api/cms/payment-orders/[id]/reconcile/route.ts", {
    "@/lib/db": { getDb: async () => db },
    "@/lib/cms/auth": {
      async withCmsIdentity(request, write, task, permission) {
        assert.equal(write, true); assert.equal(permission, "admin");
        if (request.headers.get("cookie") !== "cms=owner") throw new CmsError("Sign in as owner", 403, "FORBIDDEN");
        return task();
      },
      async readCmsJson(request) { return await request.json(); },
      cmsErrorResponse(error) { return Response.json({ code: error.code }, { status: error.status ?? 503 }); },
    },
    "@/lib/cms/validation": { CmsError },
    "@/lib/payments/orders": {
      paymentIdPattern: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      PaymentOrderError: class PaymentOrderError extends Error {},
      async applyVerifiedPaymentEvent(_db, event) { applied.push(event); attempt.status = event.status; order.status = event.status === "paid" ? "paid" : "pending"; },
    },
    "@/lib/payments/inventory": { PaymentInventoryError: class PaymentInventoryError extends Error {} },
    "@/lib/payments/providers": {
      PaymentProviderError: providers.PaymentProviderError,
      getProvider(id) { assert.equal(id, "stripe"); return { async inspect(value) { inspectionCount++; assert.deepEqual(value, input); return { ...input, provider: "stripe", eventId: "reconcile:test", status: "paid" }; } }; },
    },
  });
  const context = { params: Promise.resolve({ id: order._id }) };
  const request = (authorized, body = { attemptId: attempt._id }) => new Request(`https://store.example.test/api/cms/payment-orders/${order._id}/reconcile`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(authorized ? { Cookie: "cms=owner" } : {}) }, body: JSON.stringify(body),
  });
  assert.equal((await route.POST(request(false), context)).status, 403, "Non-owners cannot query provider payment details");
  assert.equal(inspectionCount, 0);
  assert.equal((await route.POST(request(true, { attemptId: randomUUID() }), context)).status, 404, "Attempt must belong to the order");
  assert.equal(inspectionCount, 0);
  attempt.providerPaymentId = undefined;
  assert.equal((await route.POST(request(true), context)).status, 409, "Unknown provider references remain under review");
  attempt.providerPaymentId = input.providerPaymentId;
  const result = await route.POST(request(true), context);
  assert.equal(result.status, 200);
  assert.match(result.headers.get("cache-control"), /no-store/);
  assert.equal((await result.json()).status, "paid");
  assert.equal(inspectionCount, 1);
  assert.equal(applied.length, 1, "Only the provider-observed state enters the payment transition");

  console.log("PASS: Stripe deployment mode guard, signed event and Session mode checks, provider lookup and owner-only reconciliation. Fake provider/DB only.");
} finally {
  globalThis.fetch = priorFetch;
  if (prior.key === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = prior.key;
  if (prior.webhook === undefined) delete process.env.STRIPE_WEBHOOK_SECRET; else process.env.STRIPE_WEBHOOK_SECRET = prior.webhook;
  if (prior.vercelEnv === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = prior.vercelEnv;
  if (prior.vercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = prior.vercel;
}

/* Run with npm run test:payments. Uses fake storage and providers; no network or database writes. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
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
  const moduleRecord = { exports: {} };
  cache.set(filename, moduleRecord);
  const localRequire = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`, mocks, cache);
    if (name.startsWith(".")) return load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`)), mocks, cache);
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled)(localRequire, moduleRecord, moduleRecord.exports);
  return moduleRecord.exports;
}

function fakeDb() {
  const tables = new Map();
  const table = (name) => {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name);
  };
  const matches = (document, filter) => Object.entries(filter).every(([key, criterion]) => {
    const value = document[key];
    if (criterion && typeof criterion === "object" && !Array.isArray(criterion)) {
      if ("$exists" in criterion && (value !== undefined) !== criterion.$exists) return false;
      if ("$ne" in criterion && value === criterion.$ne) return false;
      if ("$in" in criterion && !criterion.$in.includes(value)) return false;
      return true;
    }
    return value === criterion;
  });
  const apply = (document, update, inserted) => {
    if (inserted && update.$setOnInsert) Object.assign(document, structuredClone(update.$setOnInsert));
    if (update.$set) Object.assign(document, structuredClone(update.$set));
    for (const key of Object.keys(update.$unset || {})) delete document[key];
    for (const [key, value] of Object.entries(update.$addToSet || {})) {
      document[key] ||= [];
      if (!document[key].includes(value)) document[key].push(value);
    }
  };
  return {
    table,
    collection(name) {
      const records = table(name);
      return {
        async findOne(filter) {
          const value = [...records.values()].find((entry) => matches(entry, filter));
          return value ? structuredClone(value) : null;
        },
        async updateOne(filter, update, options = {}) {
          const found = [...records].find(([, value]) => matches(value, filter));
          if (found) {
            const next = structuredClone(found[1]);
            apply(next, update, false);
            records.set(found[0], next);
            return { matchedCount: 1, modifiedCount: 1 };
          }
          if (options.upsert) {
            assert.equal(typeof filter._id, "string", "This fake only upserts by exact ID");
            if (records.has(filter._id)) throw Object.assign(new Error("Duplicate key"), { code: 11000 });
            const document = { _id: filter._id };
            apply(document, update, true);
            records.set(document._id, document);
            return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
          }
          return { matchedCount: 0, modifiedCount: 0 };
        },
      };
    },
  };
}

function testCustomer() {
  return { name: "Test Buyer", email: "buyer@example.test", phone: "0812345678", address: "1 Test Road", district: "Bang Kapi", province: "Bangkok", country: "Thailand", postcode: "10240", notes: "" };
}

async function main() {
  const { honey } = load("src/lib/catalog.ts");
  const { quotePaymentOrder } = load("src/lib/payments/order-pricing.ts");
  const orders = load("src/lib/payments/orders.ts");
  const providers = load("src/lib/payments/providers.ts");
  const { parsePaymentOrderInput, paymentOrderFingerprint, newPaymentOrder, applyVerifiedPaymentEvent, PaymentOrderError } = orders;

  const source = { locale: "th", market: "TH", consent: true, customer: testCustomer(), items: [{ id: honey.id, quantity: 6, lineTotal: 1 }], expectedTotalMinor: 198000 };
  const input = parsePaymentOrderInput(source);
  assert.deepEqual(input.items, [{ id: honey.id, quantity: 6 }], "Browser prices are discarded during validation");
  const quote = quotePaymentOrder(input.items, [honey], input.locale);
  const id = randomUUID();
  const saved = newPaymentOrder(id, paymentOrderFingerprint(input), input, quote, [honey]);
  assert.equal(saved.status, "pending");
  assert.equal(saved.currency, "THB");
  assert.equal(saved.subtotalMinor, 198000);
  assert.equal(saved.totalMinor, 198000);
  assert.equal(saved.shippingMinor, 0);
  assert.equal(saved.items[0].lineTotalMinor, 198000);
  assert.equal(saved.items[0].name, honey.name.th);
  assert.notEqual(saved.items[0].lineTotalMinor, source.items[0].lineTotal);
  const reordered = parsePaymentOrderInput({ ...source, items: [...source.items].reverse() });
  assert.equal(paymentOrderFingerprint(reordered), saved.fingerprint, "Equivalent bag order keeps an idempotent fingerprint");
  assert.equal(parsePaymentOrderInput({ ...source, locale: "en" }).locale, "en", "A Thai delivery can use English checkout");
  assert.throws(() => newPaymentOrder(randomUUID(), saved.fingerprint, { ...input, expectedTotalMinor: 1 }, quote, [honey]), (error) => error.code === "INVALID_TOTAL");
  for (const invalid of [
    { ...source, market: "INTL" }, { ...source, consent: false },
    { ...source, customer: { ...testCustomer(), postcode: "SW1A 1AA" } },
    { ...source, customer: { ...testCustomer(), country: "United Kingdom" } },
    { ...source, items: [{ id: honey.id, quantity: 0 }] },
    { ...source, items: [{ id: honey.id, quantity: 6 }, { id: honey.id, quantity: 1 }] },
    { ...source, expectedTotalMinor: 1980.5 },
  ]) assert.throws(() => parsePaymentOrderInput(invalid), PaymentOrderError);

  const env = { PAYMENT_ACCESS_SECRET: process.env.PAYMENT_ACCESS_SECRET, NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL };
  process.env.PAYMENT_ACCESS_SECRET = "payment-test-secret-of-at-least-thirty-two-characters";
  process.env.NEXT_PUBLIC_SITE_URL = "https://store.example.test";
  try {
    const db = fakeDb();
    db.table("payment_orders").set(saved._id, structuredClone(saved));
    const calls = [];
    let behavior = "ready";
    const fakeStripe = {
      id: "stripe", available: true,
      async createPayment(request) {
        calls.push({ provider: this.id, ...request });
        if (behavior === "rejected") throw new providers.PaymentProviderError("rejected", "Rejected before checkout", this.id);
        if (behavior === "uncertain") throw new providers.PaymentProviderError("uncertain", "Provider response lost", this.id);
        return { providerPaymentId: `cs_test_${request.attemptId}`, redirectUrl: `https://checkout.stripe.com/test/${request.attemptId}` };
      },
    };
    const fakeFallback = {
      id: "merchant-ipay", available: true,
      async createPayment(request) {
        calls.push({ provider: this.id, ...request });
        return { providerPaymentId: `bank-${request.attemptId}`, redirectUrl: `https://bank.example.test/pay/${request.attemptId}` };
      },
    };
    const service = load("src/lib/payments/service.ts", { "./providers": { ...providers, getProvider: (key) => key === "stripe" ? fakeStripe : fakeFallback } });
    const first = await service.startPaymentAttempt(db, saved._id, "stripe");
    assert.equal(first.amountMinor, 198000);
    assert.equal(first.currency, "THB");
    assert.equal(first.reference, saved.reference);
    assert.match(first.checkoutUrl, /^https:\/\/checkout\.stripe\.com\//);
    assert.equal(calls.length, 1);
    const attemptId = db.table("payment_orders").get(saved._id).activeAttemptId;
    assert.equal(db.table("payment_attempts").get(attemptId).status, "ready");
    assert.equal(db.table("payment_attempts").get(attemptId).amountMinor, 198000);
    const providerExpiry = db.table("payment_attempts").get(attemptId).providerExpiresAtUnix * 1000;
    const initialExpiry = saved.expiresAt.getTime();
    assert.equal(db.table("payment_orders").get(saved._id).expiresAt.getTime(), providerExpiry, "Claiming the attempt extends the order through the frozen provider expiry");
    assert.ok(providerExpiry > initialExpiry, "The provider window exceeds the initial order window");
    const realNow = Date.now;
    try {
      Date.now = () => initialExpiry + 5_000;
      const stillOpen = await service.startPaymentAttempt(db, saved._id, "stripe");
      assert.equal(stillOpen.checkoutUrl, first.checkoutUrl, "An existing session remains resumable after the original order window");
      assert.equal(calls.length, 1, "Resuming does not create another provider session");
      Date.now = () => providerExpiry;
      await assert.rejects(service.startPaymentAttempt(db, saved._id, "stripe"), (error) => error.code === "ORDER_EXPIRED", "The session cannot be resumed at its provider expiry");
    } finally {
      Date.now = realNow;
    }
    const repeat = await service.startPaymentAttempt(db, saved._id, "stripe");
    assert.equal(repeat.checkoutUrl, first.checkoutUrl);
    assert.equal(repeat.accessToken, first.accessToken);
    assert.equal(calls.length, 1, "Retry reuses an existing ready attempt without a new provider call");
    await assert.rejects(service.startPaymentAttempt(db, saved._id, "merchant-ipay"), (error) => error.code === "ATTEMPT_ACTIVE");

    const event = (order, attempt, status, eventId = randomUUID(), amountMinor = order.totalMinor) => ({
      provider: attempt.provider, eventId, providerPaymentId: attempt.providerPaymentId,
      orderId: order._id, attemptId: attempt._id, reference: order.reference,
      status, amountMinor, currency: "THB",
    });
    const currentOrder = db.table("payment_orders").get(saved._id);
    const currentAttempt = db.table("payment_attempts").get(attemptId);
    const paid = event(currentOrder, currentAttempt, "paid", "evt_first_paid");
    await assert.rejects(applyVerifiedPaymentEvent(db, { ...paid, amountMinor: 198001 }), (error) => error.code === "PAYMENT_MISMATCH");
    assert.equal(db.table("payment_orders").get(saved._id).status, "pending");
    assert.equal(db.table("payment_events").size, 0, "A mismatched verified event changes nothing");
    await applyVerifiedPaymentEvent(db, paid);
    await applyVerifiedPaymentEvent(db, paid);
    assert.equal(db.table("payment_orders").get(saved._id).status, "paid");
    assert.equal(db.table("payment_orders").get(saved._id).paidAttemptId, attemptId);
    assert.equal(db.table("payment_events").size, 1, "Duplicate provider delivery has one event receipt");
    await applyVerifiedPaymentEvent(db, event(currentOrder, currentAttempt, "failed", "evt_late_failed"));
    assert.equal(db.table("payment_orders").get(saved._id).status, "paid", "A late failure cannot reverse a verified payment");
    assert.equal(db.table("payment_attempts").get(attemptId).status, "paid");

    const alternateId = randomUUID();
    const alternate = { _id: alternateId, orderId: saved._id, provider: "stripe", status: "ready", currency: "THB", amountMinor: saved.totalMinor, providerPaymentId: `cs_test_${alternateId}`, createdAt: new Date(), updatedAt: new Date() };
    db.table("payment_attempts").set(alternateId, alternate);
    await applyVerifiedPaymentEvent(db, event(currentOrder, alternate, "paid", "evt_second_paid"));
    await applyVerifiedPaymentEvent(db, event(currentOrder, alternate, "paid", "evt_second_paid"));
    const reviewed = db.table("payment_orders").get(saved._id);
    assert.equal(reviewed.paidAttemptId, attemptId, "The first successful attempt remains primary");
    assert.equal(reviewed.requiresPaymentReview, true);
    assert.deepEqual(reviewed.secondaryPaidAttemptIds, [alternateId], "A second payment is flagged exactly once for manual review");

    const declinedId = randomUUID();
    const declinedOrder = newPaymentOrder(declinedId, saved.fingerprint, input, quote, [honey]);
    db.table("payment_orders").set(declinedId, declinedOrder);
    behavior = "rejected";
    await assert.rejects(service.startPaymentAttempt(db, declinedId, "stripe"), (error) => error.code === "PAYMENT_NOT_STARTED");
    const declinedAttemptId = db.table("payment_orders").get(declinedId).lastAttemptId;
    assert.equal(db.table("payment_attempts").get(declinedAttemptId).status, "failed");
    assert.equal(db.table("payment_orders").get(declinedId).activeAttemptId, undefined, "Definite pre-payment failure permits a user-selected fallback");
    const fallback = await service.startPaymentAttempt(db, declinedId, "merchant-ipay");
    assert.match(fallback.checkoutUrl, /^https:\/\/bank\.example\.test\//);
    assert.notEqual(db.table("payment_orders").get(declinedId).activeAttemptId, declinedAttemptId, "Fallback creates a separate attempt");

    const uncertainId = randomUUID();
    db.table("payment_orders").set(uncertainId, newPaymentOrder(uncertainId, saved.fingerprint, input, quote, [honey]));
    behavior = "uncertain";
    const callsBeforeUncertain = calls.length;
    await assert.rejects(service.startPaymentAttempt(db, uncertainId, "stripe"), (error) => error.code === "PAYMENT_UNCERTAIN");
    const uncertainAttemptId = db.table("payment_orders").get(uncertainId).activeAttemptId;
    assert.equal(db.table("payment_attempts").get(uncertainAttemptId).status, "uncertain");
    await assert.rejects(service.startPaymentAttempt(db, uncertainId, "merchant-ipay"), (error) => error.code === "ATTEMPT_ACTIVE");
    behavior = "ready";
    const originalOrigin = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://changed.example.test";
    try { await service.startPaymentAttempt(db, uncertainId, "stripe"); }
    finally { process.env.NEXT_PUBLIC_SITE_URL = originalOrigin; }
    assert.equal(db.table("payment_orders").get(uncertainId).activeAttemptId, uncertainAttemptId, "Uncertain retry keeps the provider attempt ID");
    assert.equal(calls.length, callsBeforeUncertain + 2);
    assert.deepEqual(calls[callsBeforeUncertain + 1], calls[callsBeforeUncertain], "An uncertain Stripe create retries identical frozen provider parameters despite site configuration changing");
    assert.equal(calls[callsBeforeUncertain].siteOrigin, "https://store.example.test");
    assert.equal(calls[callsBeforeUncertain].expiresAtUnix, db.table("payment_attempts").get(uncertainAttemptId).providerExpiresAtUnix);

    // Exercise the real Stripe adapter's form serialization without a network
    // call. A lost first response must retry the same body and idempotency key.
    const stripeInput = structuredClone(calls[callsBeforeUncertain]);
    delete stripeInput.provider;
    const originalFetch = globalThis.fetch;
    const originalStripeKey = process.env.STRIPE_SECRET_KEY;
    const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_SECRET_KEY = "sk_test_offline-only";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_offline-only";
    const stripeRequests = [];
    globalThis.fetch = async (url, init) => {
      stripeRequests.push({ url, method: init.method, idempotencyKey: init.headers["Idempotency-Key"], body: String(init.body) });
      if (stripeRequests.length === 1) throw new TypeError("Simulated lost provider response");
      return Response.json({
        id: `cs_test_${stripeInput.attemptId}`,
        url: `https://checkout.stripe.com/test/${stripeInput.attemptId}`,
        amount_total: stripeInput.amountMinor,
        currency: "thb",
        metadata: { app: "vetra-store", orderId: stripeInput.orderId, attemptId: stripeInput.attemptId, reference: stripeInput.reference },
      });
    };
    try {
      const realStripe = providers.getProvider("stripe");
      await assert.rejects(realStripe.createPayment(stripeInput), (error) => error.kind === "uncertain");
      const resumed = await realStripe.createPayment(stripeInput);
      assert.equal(resumed.providerPaymentId, `cs_test_${stripeInput.attemptId}`);
      assert.equal(stripeRequests.length, 2);
      assert.deepEqual(stripeRequests[1], stripeRequests[0], "The Stripe HTTP retry preserves the complete form and idempotency key");
    } finally {
      globalThis.fetch = originalFetch;
      if (originalStripeKey === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = originalStripeKey;
      if (originalWebhookSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET; else process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
    }

    const lateId = randomUUID();
    const lateOrder = newPaymentOrder(lateId, saved.fingerprint, input, quote, [honey]);
    db.table("payment_orders").set(lateId, lateOrder);
    const lateAttempt = { ...alternate, _id: randomUUID(), orderId: lateId, providerPaymentId: `cs_test_${lateId}` };
    db.table("payment_attempts").set(lateAttempt._id, lateAttempt);
    db.table("payment_orders").set(lateId, { ...lateOrder, activeAttemptId: lateAttempt._id, activeProvider: "stripe", lastAttemptId: lateAttempt._id });
    await applyVerifiedPaymentEvent(db, event(lateOrder, lateAttempt, "failed", "evt_fail_before_paid"));
    assert.equal(db.table("payment_attempts").get(lateAttempt._id).status, "failed");
    assert.equal(db.table("payment_orders").get(lateId).status, "pending");
    await applyVerifiedPaymentEvent(db, event(lateOrder, lateAttempt, "paid", "evt_paid_after_failure"));
    assert.equal(db.table("payment_orders").get(lateId).status, "paid", "Authoritative late success wins over an earlier failure");

    const webhookId = randomUUID();
    const webhookOrder = newPaymentOrder(webhookId, saved.fingerprint, input, quote, [honey]);
    db.table("payment_orders").set(webhookId, webhookOrder);
    const webhookAttempt = { ...alternate, _id: randomUUID(), orderId: webhookId, providerPaymentId: `cs_test_${webhookId}` };
    db.table("payment_attempts").set(webhookAttempt._id, webhookAttempt);
    const verified = event(webhookOrder, webhookAttempt, "paid", "evt_webhook_verified");
    let verifications = 0;
    const webhook = load("src/app/api/payments/webhooks/stripe/route.ts", {
      "@/lib/db": { getDb: async () => db },
      "@/lib/payments/providers": {
        ...providers,
        getProvider: () => ({ async verify({ rawBody, signature }) {
          verifications++;
          if (signature !== "verified-test-signature") throw new providers.PaymentProviderError("invalid-webhook", "Bad test signature", "stripe");
          assert.ok(Buffer.isBuffer(rawBody));
          return JSON.parse(rawBody.toString("utf8"));
        } }),
      },
    });
    const deliver = (signature) => new Request("https://store.example.test/api/payments/webhooks/stripe", {
      method: "POST", headers: signature ? { "stripe-signature": signature } : {}, body: JSON.stringify(verified),
    });
    assert.equal((await webhook.POST(deliver(null))).status, 400);
    assert.equal((await webhook.POST(deliver("bad"))).status, 400);
    assert.equal(db.table("payment_orders").get(webhookId).status, "pending", "Unsigned callbacks never mark an order paid");
    assert.equal((await webhook.POST(deliver("verified-test-signature"))).status, 200);
    assert.equal(db.table("payment_orders").get(webhookId).status, "paid");
    assert.equal(verifications, 2);

    const routeDb = fakeDb();
    let published = { products: [{ ...structuredClone(honey), status: "published", stock: 96 }] };
    const orderRoute = load("src/app/api/payment-orders/route.ts", {
      "@/lib/db": { getDb: async () => routeDb },
      "@/lib/cms/server": { getPublishedContent: async () => published },
      "@/lib/payments/orders": { ...orders, paymentsConfigured: () => true },
      "@/lib/payments/service": service,
      "@/lib/payments/providers": { ...providers, listAvailableProviders: () => [fakeStripe], chooseDefaultProvider: () => fakeStripe },
    });
    let requestNumber = 0;
    const submit = (key, body = source) => new Request("https://store.example.test/api/payment-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": key, Origin: "https://store.example.test", Host: "store.example.test", "X-Forwarded-For": `192.0.2.${++requestNumber}` },
      body: JSON.stringify(body),
    });
    const routeKey = randomUUID();
    const routeFirst = await orderRoute.POST(submit(routeKey));
    assert.equal(routeFirst.status, 201);
    const routeResponse = await routeFirst.json();
    assert.equal(routeResponse.amountMinor, 198000);
    assert.equal(routeDb.table("payment_orders").get(routeKey).items[0].lineTotalMinor, 198000, "The API snapshots published prices, never forged client prices");
    const routeCalls = calls.length;
    published.products[0].pricing.THB.find((tier) => tier.quantity === 6).total = 1900;
    const routeRetry = await orderRoute.POST(submit(routeKey));
    assert.equal(routeRetry.status, 201, "An identical submission stays retryable after publication changes");
    assert.equal((await routeRetry.json()).checkoutUrl, routeResponse.checkoutUrl);
    assert.equal(routeDb.table("payment_orders").get(routeKey).totalMinor, 198000, "An order retains its frozen amount");
    assert.equal(calls.length, routeCalls, "A retry does not create another provider payment");
    const changedPrice = await orderRoute.POST(submit(randomUUID()));
    assert.equal(changedPrice.status, 409);
    assert.equal((await changedPrice.json()).code, "PRICE_CHANGED");
    published.products[0].stock = null;
    const unknownStock = await orderRoute.POST(submit(randomUUID()));
    assert.equal(unknownStock.status, 409);
    assert.equal((await unknownStock.json()).code, "PRODUCT_UNAVAILABLE", "Unconfirmed stock blocks a paid order");

    console.log("PASS: payment validation and server-frozen THB totals; route idempotency, attempt reuse, fallback and uncertain retry; verified webhook, duplicate/out-of-order events, mismatch rejection and second-payment review. Fake DB/provider only.");
  } finally {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

/* Run with node scripts/check-commerce.mjs. No network or database writes. */
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
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const moduleRecord = { exports: {} };
  cache.set(filename, moduleRecord);
  const localRequire = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/"))
      return load(`src/${name.slice(2)}.ts`, mocks, cache);
    if (name.startsWith("."))
      return load(
        path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`)),
        mocks,
        cache,
      );
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled)(
    localRequire,
    moduleRecord,
    moduleRecord.exports,
  );
  return moduleRecord.exports;
}

async function main() {
  const { parseStoredCart } = load("src/lib/cart.ts");
  for (const invalid of [
    null,
    undefined,
    false,
    14,
    "bad",
    [],
    {},
    { items: {} },
    {
      items: [
        null,
        false,
        "bad",
        { id: "unknown", quantity: 1 },
        { id: "coffee-blossom-honey", quantity: 1.5 },
      ],
    },
  ])
    assert.deepEqual(parseStoredCart(invalid), { items: [], wishlist: [] });
  assert.deepEqual(
    parseStoredCart({
      items: [
        { id: "coffee-blossom-honey", quantity: 12 },
        { id: "coffee-blossom-honey", quantity: 15 },
      ],
      wishlist: ["coffee-blossom-honey", "invalid"],
    }),
    {
      items: [{ id: "coffee-blossom-honey", quantity: 20 }],
      wishlist: ["coffee-blossom-honey"],
    },
  );
  const { formatPrice } = load("src/lib/catalog.ts");
  const { honey } = load("src/lib/catalog.ts");
  const { addCartItem, cartQuantityLimit, restoreCartItem } = load("src/lib/cart-actions.ts");
  assert.equal(cartQuantityLimit(undefined), 0, "Removed products cannot be restored");
  assert.equal(cartQuantityLimit(honey), 20);
  assert.equal(cartQuantityLimit({ ...honey, stock: 3.8 }), 3);
  for (const stock of [-1, NaN, Infinity, 0]) assert.equal(cartQuantityLimit({ ...honey, stock }), 0);
  assert.equal(cartQuantityLimit({ ...honey, stock: 100 }), 20);
  const bag = [{ id: "first", quantity: 2 }, { id: honey.id, quantity: 3 }, { id: "last", quantity: 1 }];
  assert.deepEqual(addCartItem(bag, honey.id, 2, 5), [bag[0], { id: honey.id, quantity: 5 }, bag[2]], "Changing quantity preserves stable row order");
  for (const quantity of [NaN, Infinity, -2, 0, 0.5]) assert.equal(addCartItem(bag, honey.id, quantity, 20), bag);
  assert.equal(addCartItem(bag, honey.id, 1, 3), bag, "A full bag does not claim an addition or reopen the drawer");
  const removed = { item: bag[1], index: 1 };
  assert.deepEqual(restoreCartItem([bag[0], bag[2]], removed, 20), bag, "Undo restores the original row position");
  assert.deepEqual(restoreCartItem([bag[0], bag[2]], removed, 2), [bag[0], { id: honey.id, quantity: 2 }, bag[2]], "Undo obeys reduced stock");
  assert.deepEqual(restoreCartItem([{ id: honey.id, quantity: 1 }], removed, 20), [{ id: honey.id, quantity: 4 }], "Undo preserves later additions without duplicate rows");
  assert.equal(restoreCartItem(bag, removed, 0), bag, "Unavailable stock cannot be restored");
  assert.deepEqual(bag, [{ id: "first", quantity: 2 }, { id: honey.id, quantity: 3 }, { id: "last", quantity: 1 }], "Mutations leave earlier snapshots unchanged");
  assert.equal(formatPrice(480, "en"), "฿480");
  assert.equal(formatPrice(480, "th"), "฿480");
  const { localizedDestination } = load("src/lib/i18n.ts");
  assert.equal(localizedDestination("en", "/products"), "/products");
  assert.equal(localizedDestination("th", "/products"), "/th/products");
  assert.equal(localizedDestination("en", "/en/products?q=honey#top"), "/en/products?q=honey#top");
  assert.equal(localizedDestination("en", "/th/products"), "/th/products");
  assert.equal(localizedDestination("th", "/en?category=coffee"), "/en?category=coffee");
  assert.equal(localizedDestination("en", "/english-products"), "/english-products");
  assert.equal(localizedDestination("en", "https://example.test/product"), "https://example.test/product");
  const { pageMetadata } = load("src/lib/metadata.ts");
  assert.deepEqual(pageMetadata("en", "/products", "Products", "Collection", "Custom Store").title, { absolute: "Products | Custom Store" });
  assert.equal(pageMetadata("en", "/products", "Products", "Collection", "Custom Store").openGraph.title, "Products | Custom Store");
  assert.deepEqual(pageMetadata("th", "/products", "สินค้า", "รายการสินค้า").title, { absolute: "สินค้า | VETRA STORE" });

  const documents = new Map();
  let fail = false;
  let failRead = false;
  let duplicateRace = false;
  let calls = 0;
  const fakeDb = {
    collection: () => ({
      updateOne: async (filter, update) => {
        calls++;
        if (fail) throw new Error("Simulated unavailable DB");
        if (!documents.has(filter._id))
          documents.set(filter._id, structuredClone(update.$setOnInsert));
        if (duplicateRace) {
          const error = new Error("Simulated concurrent upsert");
          error.code = 11000;
          throw error;
        }
      },
      findOne: async (filter) => {
        if (failRead && documents.has(filter._id))
          throw new Error("Simulated uncertain response after save");
        return documents.get(filter._id) || null;
      },
    }),
  };
  const { defaultContent } = load("src/lib/cms/defaults.ts");
  let publishedContent = defaultContent();
  const { POST } = load("src/app/api/orders/route.ts", {
    "@/lib/db": { getDb: async () => fakeDb },
    "@/lib/cms/server": { getPublishedContent: async () => publishedContent },
  });
  const makeBody = () => ({
    locale: "en",
    consent: true,
    customer: {
      name: "Test customer",
      email: "test@example.com",
      phone: "0812345678",
      address: "Test address",
      district: "Test district",
      province: "Test province",
      postcode: "10110",
      notes: "",
    },
    items: [{ id: "coffee-blossom-honey", quantity: 2 }],
  });
  let requestNumber = 0;
  const request = (body = makeBody(), key = randomUUID(), options = {}) =>
    new Request("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        host: "127.0.0.1:3000",
        origin: "http://127.0.0.1:3000",
        "idempotency-key": key,
        "x-forwarded-for": `192.0.2.${++requestNumber}`,
        ...options.headers,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  const oldEnabled = process.env.ORDER_ENQUIRIES_ENABLED;
  const oldUri = process.env.MONGODB_URI;
  try {
    delete process.env.ORDER_ENQUIRIES_ENABLED;
    delete process.env.MONGODB_URI;
    assert.equal((await POST(request())).status, 503);
    assert.equal(calls, 0);
    process.env.ORDER_ENQUIRIES_ENABLED = "true";
    process.env.MONGODB_URI = "mongodb://not-used.invalid/test";
    for (const quantity of [0, 21, 1.5, "2", -1, null]) {
      const body = makeBody();
      body.items[0].quantity = quantity;
      assert.equal((await POST(request(body))).status, 400);
    }
    for (const mutate of [
      (body) => {
        body.consent = false;
      },
      (body) => {
        body.locale = "invalid";
      },
      (body) => {
        body.items[0].id = "unknown";
      },
      (body) => {
        body.items.push(body.items[0]);
      },
      (body) => {
        body.customer.email = "invalid";
      },
      (body) => {
        body.customer.postcode = "000000";
      },
      (body) => {
        body.customer.notes = "x".repeat(1001);
      },
      (body) => {
        body.customer.name = " ";
      },
    ]) {
      const body = makeBody();
      mutate(body);
      assert.equal((await POST(request(body))).status, 400);
    }
    assert.equal((await POST(request(makeBody(), "invalid-key"))).status, 400);
    assert.equal(
      (
        await POST(
          request(makeBody(), randomUUID(), {
            headers: { origin: "https://other.example" },
          }),
        )
      ).status,
      400,
    );
    assert.equal((await POST(request("{invalid json"))).status, 400);
    assert.equal((await POST(request(" ".repeat(17000)))).status, 400);
    assert.equal(
      (
        await POST(
          request(makeBody(), randomUUID(), {
            headers: { "content-type": "text/plain" },
          }),
        )
      ).status,
      415,
    );
    assert.equal(calls, 0, "Invalid requests must never write to the database");
    const body = makeBody();
    const key = randomUUID();
    let response = await POST(request(body, key));
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.match(result.reference, /^VT-[0-9A-F]{12}$/);
    assert.equal(documents.get(key).subtotal, 960);
    assert.equal(documents.get(key).items[0].unitPrice, 480);
    assert.equal(documents.get(key).status, "enquiry");
    assert.equal(documents.get(key).paymentStatus, "not-requested");
    assert.equal(documents.get(key).fulfilmentStatus, "not-started");
    assert.equal(documents.get(key).outbox.length, 2);
    assert.ok(documents.get(key).outbox.every((notice) => notice.state === "provider-not-configured" && notice.attempts === 0));
    response = await POST(request(body, key));
    assert.equal(response.status, 201);
    assert.equal((await response.json()).reference, result.reference);
    assert.equal(documents.size, 1);
    publishedContent.products[0].price = 750;
    publishedContent.products[0].stock = 0;
    publishedContent.products[0].status = "archived";
    response = await POST(request(makeBody(), key));
    assert.equal(response.status, 201, "An existing retry must survive price, stock and publication changes");
    assert.equal((await response.json()).reference, result.reference);
    assert.equal(documents.get(key).subtotal, 960, "Historical order prices are preserved");
    assert.equal((await POST(request(makeBody(), randomUUID()))).status, 400, "Archived products cannot create new enquiries");
    const changedCustomer = makeBody(); changedCustomer.customer.email = "different@example.com";
    assert.equal((await POST(request(changedCustomer, key))).status, 409);
    publishedContent.products[0].status = "published"; publishedContent.products[0].stock = 1;
    assert.equal((await POST(request(makeBody(), randomUUID()))).status, 400, "New enquiries obey current stock limits");
    publishedContent = defaultContent();
    body.items[0].quantity = 3;
    assert.equal((await POST(request(body, key))).status, 409);
    assert.equal(documents.get(key).subtotal, 960);
    fail = true;
    const retryKey = randomUUID();
    assert.equal((await POST(request(makeBody(), retryKey))).status, 503);
    assert.equal(documents.has(retryKey), false);
    fail = false;
    assert.equal((await POST(request(makeBody(), retryKey))).status, 201);
    assert.equal(documents.size, 2);
    failRead = true;
    const uncertainKey = randomUUID();
    assert.equal((await POST(request(makeBody(), uncertainKey))).status, 503);
    assert.equal(documents.size, 3);
    failRead = false;
    publishedContent.products[0].price = 900; publishedContent.products[0].status = "archived";
    assert.equal((await POST(request(makeBody(), uncertainKey))).status, 201);
    assert.equal(
      documents.size,
      3,
      "Retry after an uncertain save must not duplicate the enquiry",
    );
    assert.equal(documents.get(uncertainKey).subtotal, 960);
    publishedContent = defaultContent();
    duplicateRace = true;
    const raceKey = randomUUID();
    assert.equal((await POST(request(makeBody(), raceKey))).status, 201);
    assert.equal(documents.size, 4);
    duplicateRace = false;
    const contact = load("src/app/api/contact/route.ts", { "@/lib/db": { getDb: async () => fakeDb }, "@/lib/cms/server": { getPublishedContent: async () => publishedContent } });
    const wholesale = { name: "Business buyer", email: "business@example.test", locale: "en", consent: true, subject: "wholesale", message: "Please confirm availability for our business.", submissionId: randomUUID(), wholesale: { productId: "coffee-blossom-honey", quantity: 150, business: "Cafe", destination: "Bangkok 10110", neededBy: "2026-12-12" } };
    for (const invalid of [{ quantity: 0 }, { productId: "unknown" }, { neededBy: "2026-02-30" }, { business: "" }]) assert.equal((await contact.POST(request({ ...wholesale, submissionId: randomUUID(), wholesale: { ...wholesale.wholesale, ...invalid } }))).status, 400);
    assert.equal((await contact.POST(request(wholesale))).status, 200);
    assert.equal(documents.get(wholesale.submissionId).wholesale.quantity, 150);
    assert.equal(documents.get(wholesale.submissionId).outbox.length, 2);
    publishedContent.products[0].status = "archived";
    assert.equal((await contact.POST(request(wholesale))).status, 200, "A wholesale retry remains valid after product archival");
    assert.equal((await contact.POST(request({ ...wholesale, wholesale: { ...wholesale.wholesale, quantity: 151 } }))).status, 409);
    assert.equal((await contact.POST(request({ ...wholesale, submissionId: randomUUID() }))).status, 400);
    publishedContent = defaultContent();
    for (let index = 0; index < 11; index++)
      assert.equal(
        (
          await POST(
            request({}, randomUUID(), {
              headers: { "x-forwarded-for": "198.51.100.10" },
            }),
          )
        ).status,
        index === 10 ? 429 : 400,
      );
    console.log(
      "PASS: cart schema validation, stock-aware add and undo, stable cart rows, quantity bounds, price formatting, API configuration gate, input/origin/body validation, server pricing, idempotency, conflict detection, DB failure and retry, uncertain save retry, concurrent upsert and rate limit. All DB calls were mocked.",
    );
  } finally {
    if (oldEnabled === undefined) delete process.env.ORDER_ENQUIRIES_ENABLED;
    else process.env.ORDER_ENQUIRIES_ENABLED = oldEnabled;
    if (oldUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = oldUri;
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

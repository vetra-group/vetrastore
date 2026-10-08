/* Run with node scripts/check-payment-pricing.mjs. No network or database writes. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
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
  const localRequire = (name) => {
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`, cache);
    if (name.startsWith(".")) return load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`)), cache);
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled)(localRequire, moduleRecord, moduleRecord.exports);
  return moduleRecord.exports;
}

const { honey, quoteProduct } = load("src/lib/catalog.ts");
const { quotePaymentOrder } = load("src/lib/payments/order-pricing.ts");

for (const [quantity, thai, international] of [
  [1, 380, 5000], [2, 700, 8000], [4, 1360, 11200], [6, 1980, 13200],
  [12, 3800, 21600], [24, 7200, 38400], [48, 13000, 67200],
  [96, 24000, 115200], [192, 46000, 192000],
]) {
  assert.equal(quoteProduct(honey, quantity, "TH").total, thai);
  assert.equal(quoteProduct(honey, quantity, "INTL").total, international);
  for (const locale of ["th", "en", "ar"]) {
    const quote = quotePaymentOrder([{ id: honey.id, quantity }], [honey], locale);
    assert.equal(quote.currency, "THB");
    assert.equal(quote.subtotalMinor, thai * 100, `Language does not change the Thai-delivery charge: ${locale}`);
    assert.equal(quote.display.currency, "THB");
    assert.equal(quote.display.approximate, false);
  }
}
assert.equal(quoteProduct(honey, 4, "INTL").total, 11200);
assert.equal(quoteProduct(honey, 4, "TH").total, 1360);
for (const quantity of [3, 5, 7, 13, 191]) assert.throws(() => quotePaymentOrder([{ id: honey.id, quantity }], [honey], "th"), /No TH bundle/);

const changed = structuredClone(honey);
changed.pricing.internationalTHB[0].total = 6000;
assert.equal(quotePaymentOrder([{ id: honey.id, quantity: 1 }], [changed], "en").subtotal, 380, "International price edits cannot change a domestic charge");
changed.pricing.THB[0].total = 380.25;
assert.equal(quotePaymentOrder([{ id: honey.id, quantity: 1 }], [changed], "en").subtotalMinor, 38025, "Thai tiers retain satang precision");

const second = { ...structuredClone(honey), id: "second-product", slug: "second-product" };
const twoLines = quotePaymentOrder([{ id: honey.id, quantity: 1, lineTotal: 1 }, { id: second.id, quantity: 2, lineTotal: 1 }], [honey, second], "th");
assert.equal(twoLines.subtotal, 1080, "Server product data overrides client amounts");
for (const invalid of [[], [{ id: "missing", quantity: 1 }], [{ id: honey.id, quantity: 0 }], [{ id: honey.id, quantity: 193 }], [{ id: honey.id, quantity: 1.5 }], [{ id: honey.id, quantity: 1 }, { id: honey.id, quantity: 1 }]]) {
  assert.throws(() => quotePaymentOrder(invalid, [honey], "en"));
}
assert.throws(() => quotePaymentOrder([{ id: honey.id, quantity: 1 }], [honey], "fr"));
console.log("PASS: exact THB bundles through 192, language-independent domestic charges, independent international prices, server-authoritative totals, satang, and invalid-quantity rejection.");

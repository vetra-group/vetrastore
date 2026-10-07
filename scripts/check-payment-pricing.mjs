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

const { honey } = load("src/lib/catalog.ts");
const { FOREIGN_THB_PER_USD, quotePaymentOrder } = load("src/lib/payments/order-pricing.ts");
assert.equal(FOREIGN_THB_PER_USD, 35);

for (const [quantity, thai, displayedUSD] of [
  [1, 380, 54.29], [2, 700, 100], [6, 1980, 282.86],
  [12, 3800, 542.86], [24, 7200, 1028.57], [48, 13000, 1857.14],
  [96, 24000, 3428.57],
]) {
  const bag = [{ id: honey.id, quantity }];
  const local = quotePaymentOrder(bag, [honey], "th");
  assert.equal(local.currency, "THB");
  assert.equal(local.subtotal, thai);
  assert.equal(local.subtotalMinor, thai * 100);
  assert.deepEqual(local.items, [{ id: honey.id, quantity, lineTotal: thai, lineTotalMinor: thai * 100 }]);
  assert.equal(local.display.currency, "THB");
  assert.equal(local.display.approximate, false);
  assert.equal(local.display.subtotal, thai);
  for (const locale of ["en", "ar"]) {
    const foreign = quotePaymentOrder(bag, [honey], locale);
    assert.equal(foreign.currency, "THB");
    assert.equal(foreign.subtotal, thai * 5, `${locale}: ${quantity} bottles charge five times the Thai tier`);
    assert.equal(foreign.subtotalMinor, thai * 500);
    assert.equal(foreign.items[0].lineTotalMinor, thai * 500);
    assert.equal(foreign.display.currency, "USD");
    assert.equal(foreign.display.approximate, true);
    assert.equal(foreign.display.subtotal, displayedUSD);
  }
}

const mixed = quotePaymentOrder([{ id: honey.id, quantity: 3 }], [honey], "en");
assert.equal(mixed.display.subtotal, 154.29, "An intermediate quantity uses the USD tier combination");
assert.equal(mixed.subtotal, 5400, "Its THB charge is rounded once for the complete line");

const customized = structuredClone(honey);
customized.pricing.USD[0].total = 60.01;
assert.equal(quotePaymentOrder([{ id: honey.id, quantity: 1 }], [customized], "en").subtotal, 2100);
assert.equal(quotePaymentOrder([{ id: honey.id, quantity: 1 }], [customized], "en").display.subtotal, 60.01);
assert.equal(quotePaymentOrder([{ id: honey.id, quantity: 1 }], [customized], "th").subtotal, 380, "Editing foreign tiers cannot alter Thai prices");

const withSatang = structuredClone(honey);
withSatang.pricing.THB[0].total = 380.25;
assert.equal(quotePaymentOrder([{ id: honey.id, quantity: 1 }], [withSatang], "th").subtotalMinor, 38025, "Thai tiers retain satang precision");

const second = { ...structuredClone(honey), id: "second-product", slug: "second-product" };
second.pricing.USD[0].total = 0.03;
const twoLines = quotePaymentOrder([{ id: honey.id, quantity: 1, lineTotal: 1 }, { id: second.id, quantity: 1, lineTotal: 1 }], [honey, second], "en");
assert.equal(twoLines.items[0].lineTotal, 1900, "Client amounts have no effect");
assert.equal(twoLines.items[1].lineTotal, 1, "Each line is rounded to a whole baht");
assert.equal(twoLines.subtotal, 1901);
assert.equal(twoLines.display.subtotal, 54.32);

const noForeignTier = { ...structuredClone(honey), pricing: { THB: honey.pricing.THB, USD: [] } };
assert.throws(() => quotePaymentOrder([{ id: honey.id, quantity: 1 }], [noForeignTier], "en"), /USD price unavailable/);
for (const invalid of [[], [{ id: "missing", quantity: 1 }], [{ id: honey.id, quantity: 0 }], [{ id: honey.id, quantity: 97 }], [{ id: honey.id, quantity: 1.5 }], [{ id: honey.id, quantity: 1 }, { id: honey.id, quantity: 1 }]]) {
  assert.throws(() => quotePaymentOrder(invalid, [honey], "en"));
}
assert.throws(() => quotePaymentOrder([{ id: honey.id, quantity: 1 }], [honey], "fr"));

console.log("PASS: authoritative THB payment quotes, five-times foreign tiers, approximate USD display, whole-baht conversion, independent CMS prices, multi-line totals, and malformed bag rejection.");

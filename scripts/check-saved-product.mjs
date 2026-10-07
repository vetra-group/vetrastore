import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), nativeRequire = createRequire(import.meta.url), cache = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const record = { exports: {} }; cache.set(filename, record);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const require = (name) => name.startsWith("@/") ? load(`src/${name.slice(2)}.ts`) : name.startsWith(".") ? load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`))) : nativeRequire(name);
  new Function("require", "module", "exports", code)(require, record, record.exports);
  return record.exports;
}
const { honey } = load("src/lib/catalog.ts"), { savedProductDetails } = load("src/lib/saved-product.ts"), { parseStoredCart } = load("src/lib/cart.ts"), { addCartItem } = load("src/lib/cart-actions.ts");
const legacy = { ...structuredClone(honey), id: "legacy-product", slug: "legacy-product", name: { ...honey.name, ar: "" }, description: { ...honey.description, ar: "" }, card: { ...honey.card, ar: { captionPrefix: "", imageAlt: "", cta: "" } }, price: 123 };
const before = structuredClone(legacy), fullRegistry = [honey, legacy];
const stored = { items: [{ id: legacy.id, quantity: 2 }], wishlist: [legacy.id] };
for (const locale of ["en", "ar", "th"]) {
  const details = savedProductDetails(legacy, locale), cart = parseStoredCart(structuredClone(stored), fullRegistry);
  assert.deepEqual(cart, stored, "Language changes preserve saved IDs and quantities when using the full published registry");
  assert.equal(cart.items.reduce((total, item) => total + fullRegistry.find((product) => product.id === item.id).price * item.quantity, 0), 246);
  assert.equal(details.locale, locale === "ar" ? "en" : locale);
  assert.equal(details.fallback, locale === "ar");
  assert.equal(details.href, locale === "th" ? "/th/products/legacy-product" : "/products/legacy-product");
  assert.ok(details.name && details.alt && details.ready);
  const changed = parseStoredCart({ ...cart, items: addCartItem(cart.items, honey.id, 1, 20) }, fullRegistry);
  assert.ok(changed.items.some((item) => item.id === legacy.id && item.quantity === 2), "A later cart update must not silently discard the untranslated item");
  assert.deepEqual(changed.wishlist, stored.wishlist);
}
assert.deepEqual(legacy, before, "Presentation does not manufacture or save a translation");
const thaiOnly = structuredClone(legacy); thaiOnly.name.en = "";
assert.equal(savedProductDetails(thaiOnly, "ar").href, "/th/products/legacy-product");
const incomplete = structuredClone(thaiOnly); incomplete.description.th = "";
assert.equal(savedProductDetails(incomplete, "ar").ready, false);
assert.equal(savedProductDetails(incomplete, "ar").href, "/ar/products", "Incomplete content must not link to an unavailable translated page");
assert.equal(savedProductDetails(honey, "ar").fallback, false);
assert.equal(savedProductDetails(honey, "ar").href, "/ar/coffee-blossom-honey");
console.log("PASS: saved products retain cart quantities, wishlist IDs and authoritative prices across all languages; incomplete Arabic uses an explicit available-language detail link without mutating content.");

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

process.env.NEXT_PUBLIC_SITE_URL = "https://vetra.example";
process.env.NEXT_PUBLIC_DEMO_MODE = "false";
process.env.SITE_NOINDEX = "false";
const nativeRequire = createRequire(import.meta.url), modules = new Map();
function load(relative) {
  const filename = path.resolve(relative);
  if (modules.has(filename)) return modules.get(filename).exports;
  const record = { exports: {} }; modules.set(filename, record);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const require = (name) => name.startsWith("@/") ? load(`src/${name.slice(2)}.ts`) : name.startsWith(".") ? load(path.resolve(path.dirname(filename), `${name}.ts`)) : nativeRequire(name);
  new Function("require", "module", "exports", code)(require, record, record.exports);
  return record.exports;
}

const { honey } = load("src/lib/catalog.ts");
const { organizationSchema, websiteSchema, pageSchema, breadcrumbSchema, productSchema, serializeSchema } = load("src/lib/structured-data.ts");
const { pageMetadata, withSocialImage } = load("src/lib/metadata.ts");
const settings = { storeName: "VETRA STORE", email: "", phone: "", address: { en: "", ar: "", th: "" }, currency: "THB" };
const product = { ...structuredClone(honey), stock: 12, gallery: [{ id: "current", src: "/api/cms-media/current.webp", alt: { en: "Current", ar: "الحالية", th: "ปัจจุบัน" } }] };

for (const locale of ["en", "ar", "th"]) {
  const organization = organizationSchema(settings, locale), website = websiteSchema(settings), page = pageSchema(locale, "/coffee-blossom-honey", honey.name[locale]);
  assert.equal(organization["@id"], "https://vetra.example/#organization");
  assert.equal(organization.logo.url, "https://vetra.example/vetra-store-logo.svg");
  for (const key of ["email", "telephone", "address", "sameAs", "areaServed", "aggregateRating"]) assert.equal(organization[key], undefined);
  assert.equal(website.publisher["@id"], organization["@id"]);
  assert.equal(page.isPartOf["@id"], website["@id"]);
  assert.equal(page.publisher["@id"], organization["@id"]);
  assert.equal(page.inLanguage, locale);
  const schema = productSchema(product, locale, settings, true);
  assert.equal(schema["@id"], "https://vetra.example/coffee-blossom-honey#product");
  assert.equal(schema.mainEntityOfPage["@id"], page["@id"]);
  assert.ok(schema.image.includes("https://vetra.example/api/cms-media/current.webp"));
  assert.ok(!schema.image.some((image) => image.includes("honey-front")), "Saved gallery must not inherit an old label image");
  if (locale === "th") {
    assert.equal(schema.offers.priceCurrency, "THB");
    assert.equal(schema.offers.price, honey.pricing.THB[0].total);
    assert.equal(schema.offers.seller["@id"], organization["@id"]);
  } else assert.equal(schema.offers, undefined, "Reference USD prices must not become exact purchase offers");
  assert.equal(productSchema(product, locale, settings, false).offers, undefined, "Demo or disabled payment must not advertise a purchasable offer");
  assert.equal(productSchema({ ...product, stock: null }, locale, settings, true).offers, undefined, "Unknown stock must not advertise a purchasable offer");
  const metadata = pageMetadata(locale, "/coffee-blossom-honey", "Title", "Description");
  assert.equal(metadata.openGraph.images[0].alt, honey.card[locale].imageAlt);
  const social = withSocialImage(metadata, "/api/cms-media/current.webp", "Current published product");
  assert.equal(social.twitter.card, "summary_large_image");
  assert.deepEqual(social.openGraph.images, social.twitter.images);
  assert.equal(social.openGraph.description, "Description");
  assert.equal(social.twitter.description, "Description");
  const breadcrumbs = breadcrumbSchema(locale, [{ name: "Home", path: "" }, { name: honey.name[locale], path: "/coffee-blossom-honey" }]);
  assert.equal(breadcrumbs.itemListElement.at(-1).item, page.url);
  assert.equal(breadcrumbs.itemListElement.at(-1).position, 2);
}
assert.equal(productSchema({ ...product, stock: 0 }, "th", settings, true).offers.availability, "https://schema.org/OutOfStock");
const custom = organizationSchema({ ...settings, storeName: "New store" }, "en");
assert.equal(custom.logo, undefined, "Original logo must not identify an unrelated renamed store");
const hostile = { headline: "</script><script>alert('test')</script>", description: "Coffee < honey & jars" };
const serialized = serializeSchema(hostile);
assert.ok(!serialized.includes("<"));
assert.deepEqual(JSON.parse(serialized), hostile);
console.log("PASS: stable multilingual identities, supplied logo, truthful THB offer gates, reference USD omission, current gallery, social image parity, breadcrumbs and safe JSON-LD serialization.");

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url), modules = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (modules.has(filename)) return modules.get(filename).exports;
  const record = { exports: {} }; modules.set(filename, record);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const require = (name) => name === "next/cache" ? { revalidatePath() {} } : name.startsWith("@/") ? load(`src/${name.slice(2)}.ts`) : name.startsWith(".") ? load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`))) : nativeRequire(name);
  new Function("require", "module", "exports", code)(require, record, record.exports);
  return record.exports;
}

const { locales, languageConfig, localeSettings, localizedPath, localizedContentHref } = load("src/lib/i18n.ts");
const { defaultState } = load("src/lib/cms/defaults.ts");
const { validateCmsState } = load("src/lib/cms/validation.ts");
const { productLocaleReady, articleLocaleReady, slideLocaleReady } = load("src/lib/cms/localization.ts");
const { pageMetadata } = load("src/lib/metadata.ts");
const { normalizeSearch } = load("src/lib/search-normalize.ts");
let checks = 0;
const pass = (message) => { checks++; console.log("PASS: " + message); };
assert.equal(languageConfig.defaultLocale, "en");
assert.deepEqual(locales, ["en", "ar", "th"]);
for (const [locale, prefix, dir] of [["en", "", "ltr"], ["ar", "/ar", "rtl"], ["th", "/th", "ltr"]]) {
  assert.equal(localizedPath(locale), prefix || "/");
  assert.equal(localizedPath(locale, "/blog?q=honey&page=2#articles"), prefix + "/blog?q=honey&page=2#articles");
  assert.equal(localeSettings(locale).direction, dir);
  assert.equal(localizedContentHref(locale, "/images/honey-front.jpg"), "/images/honey-front.jpg");
  assert.equal(localizedContentHref(locale, "/api/cms-media/example.webp"), "/api/cms-media/example.webp");
  assert.equal(localizedContentHref(locale, "https://example.com/reference"), "https://example.com/reference");
  assert.equal(localizedContentHref(locale, "/th/blog"), "/th/blog");
  const metadata = pageMetadata(locale, "/blog", "Title", "Description");
  assert.deepEqual(metadata.alternates.languages, { en: "/blog", ar: "/ar/blog", th: "/th/blog", "x-default": "/blog" });
  assert.equal(metadata.alternates.canonical, prefix + "/blog");
}
pass("English default, ordered three-language links, RTL, query strings and neutral media paths");
const partial = pageMetadata("en", "/products/custom", "Custom", "Description", "Store", ["en", "th"]);
assert.equal(partial.alternates.languages.ar, undefined);
pass("SEO alternates exclude unavailable translations");
assert.equal(normalizeSearch("أَزْهَار القَهْوَة"), normalizeSearch("ازهار القهوة"));
assert.equal(normalizeSearch("HONEY"), "honey");
assert.equal(normalizeSearch("น้ำผึ้ง"), "น้ำผึ้ง".normalize("NFKC"));
pass("Arabic search tolerates diacritics and alef variants without altering Thai");
const original = defaultState();
for (const locale of locales) {
  assert.ok(original.published.products.every(product => productLocaleReady(product, locale)));
  assert.ok(original.published.articles.filter(article => article.status === "published").every(article => articleLocaleReady(article, locale)));
  assert.ok(original.published.slides.every(slide => slideLocaleReady(slide, locale)));
}
function withoutArabic(value) {
  if (Array.isArray(value)) return value.map(withoutArabic);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "ar" && !key.includes(".ar.")).map(([key, item]) => [key, withoutArabic(item)]));
}
const legacy = withoutArabic(original), bytes = JSON.stringify(legacy);
const upgraded = validateCmsState(legacy);
assert.equal(JSON.stringify(legacy), bytes);
assert.deepEqual(withoutArabic(upgraded), legacy);
assert.ok(upgraded.published.products.every(product => productLocaleReady(product, "ar")));
assert.ok(upgraded.published.articles.every(article => articleLocaleReady(article, "ar")));
pass("unmodified bilingual seed records gain Arabic in memory while original fields and input stay intact");
const changed = withoutArabic(original);
changed.published.products[0].name.en = "An owner-edited name";
changed.published.articles[0].content.en.title = "An owner-edited article";
const migrated = validateCmsState(changed);
assert.equal(migrated.published.products[0].name.en, "An owner-edited name");
assert.equal(migrated.published.products[0].name.ar, "");
assert.equal(productLocaleReady(migrated.published.products[0], "ar"), false);
assert.equal(articleLocaleReady(migrated.published.articles[0], "ar"), false);
const edited = structuredClone(original); edited.published.products[0].name.ar = "ترجمة معتمدة";
assert.equal(validateCmsState(edited).published.products[0].name.ar, "ترجمة معتمدة");
pass("custom edits never inherit mismatched Arabic and existing Arabic translations are preserved");
if (process.argv.includes("--current")) {
  const file = path.join(root, ".local/cms/state.json"), before = fs.readFileSync(file, "utf8");
  const current = validateCmsState(JSON.parse(before));
  for (const locale of locales) {
    assert.ok(current.published.products.filter(product => product.status === "published").every(product => productLocaleReady(product, locale)), "Current product missing " + locale);
    assert.ok(current.published.articles.filter(article => article.status === "published").every(article => articleLocaleReady(article, locale)), "Current article missing " + locale);
    assert.ok(current.published.slides.filter(slide => slide.enabled).every(slide => slideLocaleReady(slide, locale)), "Current slide missing " + locale);
  }
  assert.equal(fs.readFileSync(file, "utf8"), before);
  pass("existing local published content is complete in all three languages without a storage write");
}
console.log(checks + " language checks passed.");

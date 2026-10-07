import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url), cache = new Map();
function load(relative, mocks = {}, moduleCache = cache) {
  const filename = path.resolve(root, relative);
  if (moduleCache.has(filename)) return moduleCache.get(filename).exports;
  const record = { exports: {} }; moduleCache.set(filename, record);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const require = (name) => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith("@/") ? load(`src/${name.slice(2)}.ts`, mocks, moduleCache) : name.startsWith(".") ? load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`)), mocks, moduleCache) : nativeRequire(name);
  new Function("require", "module", "exports", code)(require, record, record.exports);
  return record.exports;
}

const { defaultContent } = load("src/lib/cms/defaults.ts");
const { searchStore, searchGuidance, searchListing, searchListingPath, SEARCH_PAGE_SIZE } = load("src/lib/search.ts");
const { quickSearch } = load("src/lib/search-suggestions.ts");
const { blogListing, blogListingPath, BLOG_PAGE_SIZE } = load("src/lib/blog.ts");
const { listingQuery, requestedPage, paginate, pageLinks, pageNeedsRedirect } = load("src/lib/listing.ts");
const { localizedPath } = load("src/lib/i18n.ts");
const { createProductCaseStudy } = load("src/content/case-study-template.ts");
const { validateCmsContent } = load("src/lib/cms/validation.ts");
let checks = 0;
const pass = (message) => { checks++; console.log(`PASS: ${message}`); };

const content = defaultContent();
const privateArticle = structuredClone(content.articles[0]);
privateArticle.id = "private-search-check"; privateArticle.slug = "private-search-check";
privateArticle.status = "draft"; privateArticle.content.en.title = "PrivateNeedle"; privateArticle.content.en.category = "PrivateCategory";
const archivedProduct = structuredClone(content.products[0]); archivedProduct.id = "archived-search-check"; archivedProduct.slug = "archived-search-check"; archivedProduct.status = "archived"; archivedProduct.name.en = "ArchivedNeedle";
content.articles.push(privateArticle); content.products.push(archivedProduct);
content.articles[0].editorialNotes = "InternalEvidenceNeedle";
assert.equal(searchStore(content, "en", "PrivateNeedle").length, 0);
assert.equal(searchStore(content, "en", "ArchivedNeedle").length, 0);
assert.equal(searchStore(content, "en", "InternalEvidenceNeedle").length, 0);
const publicGuidance = searchGuidance(content, "en", "PrivateNeedl");
assert.ok(!JSON.stringify(publicGuidance).includes("PrivateNeedle") && !JSON.stringify(publicGuidance).includes("PrivateCategory") && !JSON.stringify(publicGuidance).includes("ArchivedNeedle"));
pass("search and suggestions exclude draft, archived and internal editorial content");

assert.equal(searchStore(content, "en", "hony").length, 0);
const typo = searchGuidance(content, "en", "hony");
assert.ok(typo.suggestions.some((query) => query.toLowerCase() === "honey"));
assert.ok(typo.nearby.length > 0 && typo.nearby.length <= 3);
assert.equal(searchStore(content, "en", "hony").length, 0);
pass("spelling alternatives are grounded in published content and do not change the exact-match count");

const partial = searchGuidance(content, "en", "honey unavailableword", "product");
assert.ok(partial.suggestions.includes("honey"));
assert.ok(partial.nearby.length > 0 && partial.nearby.every((result) => result.kind === "product"));
const filtered = searchGuidance(content, "en", "thoughtful purchase", "product");
const filteredContent = structuredClone(content); filteredContent.articles[0].content.en.title = "ExclusiveEditorialNeedle";
assert.equal(searchStore(filteredContent, "en", "ExclusiveEditorialNeedle", "product").length, 0);
assert.ok(searchGuidance(filteredContent, "en", "ExclusiveEditorialNeedle", "product").otherTypeCount > 0);
assert.ok(filtered.otherTypeCount >= 0);
pass("shorter-term recovery respects filters and clear-filter recovery discovers other content types");

for (const locale of ["en", "ar", "th"]) {
  const guidance = searchGuidance(content, locale, "");
  assert.ok(guidance.suggestions.length > 0 && guidance.suggestions.length <= 6);
  assert.equal(new Set(guidance.suggestions).size, guidance.suggestions.length);
  assert.ok(guidance.suggestions.every((query) => searchStore(content, locale, query).length > 0));
  assert.ok(searchGuidance(content, locale, "zzzzzzzzzzzzzz").suggestions.every((query) => searchStore(content, locale, query).length > 0));
}
pass("blank and unrelated searches offer useful trilingual published starting points without dead suggestions");

const rich = structuredClone(content);
rich.articles[0].content.en.sections[0].bullets = ["BulletSearchNeedle"];
rich.articles[0].content.en.sections[0].table = { headers: ["Detail", "Value"], rows: [["TableSearchNeedle", "Example"]] };
rich.articles[0].content.en.references = [{ label: "ReferenceSearchNeedle", href: "/products" }];
for (const needle of ["BulletSearchNeedle", "TableSearchNeedle", "ReferenceSearchNeedle"]) assert.ok(searchStore(rich, "en", needle, "article").some((result) => result.key === `article-${rich.articles[0].slug}`));
pass("published lists, comparison tables and reference labels are searchable");

const caseStudy = createProductCaseStudy(content.products[0], "case-study-search-check");
const draft = defaultContent(); draft.articles.push(caseStudy); validateCmsContent(draft);
assert.equal(caseStudy.status, "draft"); assert.equal(caseStudy.reviewRequired, true);
assert.equal(caseStudy.image, "/images/honey-front.jpg");
for (const locale of ["en", "ar", "th"]) assert.ok(caseStudy.content[locale].sections.some((section) => section.image?.src === "/images/honey-back.jpg"));
assert.match(caseStudy.editorialNotes, /photographed sample/);
assert.equal(searchStore(draft, "en", caseStudy.content.en.title).length, 0);
pass("case-study starter uses supplied photographs with sample limitations and stays private pending review");

const large = defaultContent();
const articleSource = structuredClone(large.articles[0]), productSource = structuredClone(large.products[0]);
large.articles = Array.from({ length: 105 }, (_, index) => {
  const article = structuredClone(articleSource);
  article.id = `listing-article-${index}`; article.slug = `listing-article-${index}`; article.status = "published";
  for (const locale of ["en", "ar", "th"]) {
    article.content[locale].title = `CatalogFixture ${{ th: "คู่มือ", ar: "دليل", en: "guide" }[locale]} ${index}`;
    article.content[locale].category = { th: index % 2 ? "การเลือกสินค้า" : "กาแฟและคุณภาพ", ar: index % 2 ? "اختيار المنتجات" : "القهوة والجودة", en: index % 2 ? "Product selection" : "Coffee & quality" }[locale];
  }
  return article;
});
large.products = Array.from({ length: 25 }, (_, index) => ({ ...structuredClone(productSource), id: `listing-product-${index}`, slug: `listing-product-${index}`, status: "published", name: { th: `CatalogFixture สินค้า ${index}`, en: `CatalogFixture product ${index}`, ar: `CatalogFixture منتج ${index}` } }));
for (const locale of ["en", "ar", "th"]) {
  assert.equal(searchStore(large, locale, "CatalogFixture").length, 130);
  const first = searchListing(large, locale, { q: "CatalogFixture" });
  assert.equal(first.total, 130); assert.equal(first.items.length, SEARCH_PAGE_SIZE); assert.equal(first.pageCount, 11);
  const keys = [];
  for (let page = 1; page <= first.pageCount; page++) {
    const slice = searchListing(large, locale, { q: "CatalogFixture", page: String(page) });
    assert.equal(slice.total, 130); assert.ok(slice.items.length <= SEARCH_PAGE_SIZE); keys.push(...slice.items.map((entry) => entry.key));
  }
  assert.equal(keys.length, 130); assert.equal(new Set(keys).size, 130);
  assert.equal(searchListing(large, locale, { q: "CatalogFixture", type: "products" }).total, 25);
  assert.equal(searchListing(large, locale, { q: "CatalogFixture", type: "articles" }).total, 105);
  const last = searchListing(large, locale, { q: "CatalogFixture", page: "999" });
  assert.deepEqual([last.page, last.start, last.end, last.items.length], [11, 121, 130, 10]);
}
pass("large trilingual searches retain complete totals beyond 60 and paginate every result exactly once");

for (const locale of ["en", "ar", "th"]) {
  const first = blogListing([...large.articles, privateArticle], locale, { q: "CatalogFixture", category: "Coffee & quality" });
  assert.equal(first.total, 53); assert.equal(first.items.length, BLOG_PAGE_SIZE); assert.equal(first.category, "coffee & quality");
  assert.equal(first.categories.length, 2);
  assert.deepEqual(first.categories.map((entry) => entry.count).sort((a, b) => a - b), [52, 53]);
  const seen = [];
  for (let page = 1; page <= first.pageCount; page++) seen.push(...blogListing(large.articles, locale, { q: "CatalogFixture", category: first.category, page: String(page) }).items.map((entry) => entry.id));
  assert.equal(seen.length, 53); assert.equal(new Set(seen).size, 53);
  assert.equal(blogListing(large.articles, locale, { category: "unavailable" }).total, 0);
  assert.equal(blogListing(large.articles, locale, { q: "PrivateNeedle" }).total, 0);
}
assert.equal(blogListing(large.articles, "en", { category: "กาแฟและคุณภาพ" }).category, "coffee & quality");
assert.deepEqual(blogListing(large.articles, "th", { category: "coffee & quality", page: "3" }).items.map((entry) => entry.id), blogListing(large.articles, "en", { category: "coffee & quality", page: "3" }).items.map((entry) => entry.id));
pass("blog categories and pages use published records, keep stable trilingual keys, and exclude unrelated results");

const base = "https://example.invalid", queryText = "honey & tea / น้ำผึ้ง / عسل", category = "coffee & quality";
for (const locale of ["en", "ar", "th"]) {
  const history = [1, 2, 7].map((page) => new URL(localizedPath(locale, blogListingPath(queryText, category, page)), base));
  for (const url of [history[2], history[1], history[0]]) {
    const input = Object.fromEntries(url.searchParams);
    assert.equal(input.q, queryText); assert.equal(input.category, category);
    assert.equal(url.pathname, locale === "en" ? "/blog" : `/${locale}/blog`);
    assert.equal(requestedPage(input.page), url === history[2] ? 7 : url === history[1] ? 2 : 1);
  }
  assert.ok(!new URL(localizedPath(locale, blogListingPath(queryText, "product selection")), base).searchParams.has("page"));
  const searchUrl = new URL(localizedPath(locale, searchListingPath(queryText, "article", 8)), base);
  assert.equal(searchUrl.searchParams.get("q"), queryText); assert.equal(searchUrl.searchParams.get("type"), "article"); assert.equal(searchUrl.searchParams.get("page"), "8");
}
pass("query URLs round-trip punctuation, Thai text, filters and pages for direct links and browser history");

for (const invalid of [undefined, "0", "-1", "1.5", "NaN", "1e3", "9007199254740992", ["2", "3"]]) assert.equal(requestedPage(invalid), 1);
assert.equal(listingQuery(["unexpected", "duplicate"]), ""); assert.equal(listingQuery("a".repeat(400)).length, 200);
assert.deepEqual(paginate([], 50), { items: [], total: 0, page: 1, pageCount: 1, pageSize: 12, start: 0, end: 0 });
assert.equal(pageNeedsRedirect("999", 11), true); assert.equal(pageNeedsRedirect("2", 2), false); assert.equal(pageNeedsRedirect(undefined, 1), false);
const boundedLinks = pageLinks(5000, 10000);
assert.ok(boundedLinks.length <= 7); assert.ok(boundedLinks.includes(1) && boundedLinks.includes(5000) && boundedLinks.includes(10000));
pass("malformed and unavailable pages recover safely and pagination controls remain bounded for very large libraries");

const quickPrivate = structuredClone(content);
const archivedArticle = structuredClone(privateArticle);
archivedArticle.id = "archived-quick-check"; archivedArticle.slug = "archived-quick-check";
archivedArticle.status = "archived"; archivedArticle.content.en.title = "ArchivedArticleNeedle";
const draftProduct = structuredClone(archivedProduct);
draftProduct.id = "draft-quick-check"; draftProduct.slug = "draft-quick-check";
draftProduct.status = "draft"; draftProduct.name.en = "DraftProductNeedle";
quickPrivate.articles.push(archivedArticle); quickPrivate.products.push(draftProduct);
for (const needle of ["PrivateNeedle", "ArchivedNeedle", "ArchivedArticleNeedle", "DraftProductNeedle", "InternalEvidenceNeedle"]) {
  const result = quickSearch(quickPrivate, "en", needle);
  assert.deepEqual(result.results, []); assert.equal(result.total, 0);
}
const blankQuick = quickSearch(quickPrivate, "en", "  ");
assert.equal(blankQuick.query, "");
assert.ok(!JSON.stringify(blankQuick).match(/PrivateNeedle|ArchivedNeedle|ArchivedArticleNeedle|DraftProductNeedle|InternalEvidenceNeedle/));
for (const result of [...blankQuick.results, ...quickSearch(quickPrivate, "en", "honey").results]) {
  assert.ok(Object.keys(result).every(key => ["key", "kind", "title", "image", "href", "price"].includes(key)), "Quick search serializes only its small public projection");
  assert.equal(Object.hasOwn(result, "price"), result.kind === "product");
}
pass("quick search excludes every non-public status and internal notes, and serializes only safe suggestion fields");

const initialOrder = large.articles.map(article => article.id);
large.articles[80].featured = true;
for (const locale of ["en", "ar", "th"]) {
  const queryResult = quickSearch(large, locale, "  CatalogFixture  ");
  assert.equal(queryResult.query, "CatalogFixture");
  assert.equal(queryResult.total, 130); assert.equal(queryResult.results.length, 6);
  assert.equal(new Set(queryResult.results.map(result => result.key)).size, 6);
  const blank = quickSearch(large, locale, "");
  assert.equal(blank.total, 130); assert.equal(blank.results.length, 6);
  assert.equal(blank.results.filter(result => result.kind === "product").length, 3);
  assert.equal(blank.results.find(result => result.kind === "article").key, "article-listing-article-80");
  assert.ok(blank.results.every(result => result.href === localizedPath(locale, result.kind === "product" ? `/products/${result.key.slice(8)}` : `/blog/${result.key.slice(8)}`)));
  assert.equal(quickSearch(large, locale, "x".repeat(300)).query.length, 120);
}
assert.deepEqual(large.articles.map(article => article.id), initialOrder, "Ranking suggestions does not reorder CMS content");
pass("quick suggestions cap visible results at six while retaining real totals and featuring articles without source mutation");

for (const locale of ["en", "ar", "th"]) {
  const result = quickSearch(content, locale, content.products[0].name[locale]);
  const honey = result.results.find(entry => entry.key === `product-${content.products[0].id}`);
  assert.equal(honey.href, localizedPath(locale, "/coffee-blossom-honey"));
  assert.equal(honey.price, content.products[0].price);
  assert.equal(honey.title, `${content.products[0].brand} ${content.products[0].name[locale]}`);
}
pass("quick product suggestions preserve trilingual names, current prices and the dedicated honey route");

let apiCalls = 0, apiFailure = false;
const { GET: searchApi } = load("src/app/api/search/route.ts", {
  "@/lib/cms/server": { getPublishedContent: async () => { apiCalls++; if (apiFailure) throw new Error("private-database-error-details"); return quickPrivate; } },
}, new Map());
const apiRequest = query => new Request(`http://localhost:3100/api/search${query}`);
assert.equal((await searchApi(apiRequest("?locale=unknown"))).status, 400);
assert.equal(apiCalls, 0, "Reject unknown languages before accessing content");
for (const locale of ["en", "ar", "th"]) {
  const response = await searchApi(apiRequest(`?locale=${locale}&q=${encodeURIComponent("InternalEvidenceNeedle")}`));
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual((await response.json()).results, []);
}
const defaultResponse = await searchApi(apiRequest(""));
assert.equal((await defaultResponse.json()).results.find(result => result.kind === "product").href, "/coffee-blossom-honey");
apiFailure = true;
const failedResponse = await searchApi(apiRequest("?locale=en&q=honey"));
assert.equal(failedResponse.status, 503);
assert.equal(failedResponse.headers.get("cache-control"), "no-store");
assert.deepEqual(await failedResponse.json(), { error: "Search is temporarily unavailable" });
pass("quick-search API validates language, defaults to English, avoids stale caching and returns a safe retryable failure");

console.log(`${checks} search and editorial checks passed. No CMS files or external services were changed.`);

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);
function load(relative, mocks = {}, cache = new Map()) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const record = { exports: {} }; cache.set(filename, record);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const require = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (!name.startsWith("@/") && !name.startsWith(".")) return nativeRequire(name);
    const base = name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : path.resolve(path.dirname(filename), name);
    const resolved = [base + ".ts", base + ".tsx"].find(fs.existsSync);
    assert.ok(resolved, `Resolve ${name}`);
    return load(path.relative(root, resolved), mocks, cache);
  };
  new Function("require", "module", "exports", code)(require, record, record.exports);
  return record.exports;
}

const origins = load("src/lib/site-origin.ts");
assert.equal(origins.normalizeSiteOrigin("https://VETRA.example/"), "https://vetra.example");
for (const value of ["https://vetra.example/store", "https://vetra.example/?campaign=x", "https://vetra.example/#top", "https://user:password@vetra.example", "ftp://vetra.example", "invalid"]) {
  assert.throws(() => origins.normalizeSiteOrigin(value));
  assert.equal(origins.isPublicHttpsOrigin(value), false);
}
for (const value of ["http://store.example.com", "https://localhost", "https://localhost.", "https://preview.localhost", "https://127.0.0.2", "https://[::1]", "https://[::ffff:127.0.0.1]", "https://10.0.0.1", "https://192.168.1.1", "https://0.0.0.0", "https://preview.local", "https://store.invalid", "https://store.test", "https://store.example", "https://bad_host.example.com"]) assert.equal(origins.isPublicHttpsOrigin(value), false);
assert.equal(origins.isPublicHttpsOrigin("https://store.example.com/"), true);

const metadata = load("src/lib/metadata.ts", { "./site-origin": { siteUrl: "https://store.example", preventIndexing: false } });
const productionRobots = load("src/app/robots.ts", { "@/lib/metadata": { siteUrl: "https://store.example", preventIndexing: false } }).default();
assert.deepEqual(productionRobots.rules.allow, ["/", "/api/cms-media/"]);
assert.deepEqual(productionRobots.rules.disallow, ["/api/"]);
const stagingRobots = load("src/app/robots.ts", { "@/lib/metadata": { siteUrl: "https://preview.example", preventIndexing: true } }).default();
assert.equal(stagingRobots.rules.disallow, "/");

const content = load("src/lib/cms/defaults.ts").defaultContent();
const mocks = {
  "@/lib/cms/server": { getPublishedContent: async () => content },
  "@/lib/metadata": metadata,
  "@/components/commerce/Catalog": { default: () => null },
  "@/components/blog/BlogContent": { default: () => null },
  "next/navigation": { notFound: () => { throw new Error("not found"); } },
};
const catalog = load("src/app/[locale]/products/page.tsx", mocks);
for (const locale of ["en", "ar", "th"]) {
  const base = await catalog.generateMetadata({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) });
  assert.equal(base.robots, undefined);
  for (const query of [{ search: "honey" }, { q: "honey" }, { q: "all" }, { category: "coffee" }]) {
    const filtered = await catalog.generateMetadata({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(query) });
    assert.deepEqual(filtered.robots, { index: false, follow: true });
    assert.equal(filtered.alternates.canonical, base.alternates.canonical);
  }
}
const blog = load("src/app/[locale]/blog/(listing)/page.tsx", mocks);
for (const article of content.articles.slice(3)) delete article.content.ar;
const pageTwo = await blog.generateMetadata({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({ page: "2" }) });
assert.equal(pageTwo.alternates.languages.ar, undefined, "No alternate for an Arabic page that would redirect to page one");
assert.ok(pageTwo.alternates.languages.en && pageTwo.alternates.languages.th);
console.log("PASS: origin validation, crawl rules, localized catalog variants and unequal-translation pagination metadata.");

const mediaBytes = new Uint8Array([1, 2, 3]);
for (const [published, blocked] of [[true, false], [false, false], [true, true]]) {
  const mediaRoute = load("src/app/api/cms-media/[filename]/route.ts", {
    "@/lib/cms/server": { readCmsMedia: async () => ({ bytes: mediaBytes, mime: "image/png", published }) },
    "@/lib/site-origin": { preventIndexing: blocked },
  });
  const response = await mediaRoute.GET(new Request("https://store.example/api/cms-media/image.png"), { params: Promise.resolve({ filename: "image.png" }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-robots-tag"), !published || blocked ? "noindex, nofollow" : null);
  assert.match(response.headers.get("cache-control"), /must-revalidate/, "Publication status must be rechecked rather than cached for a year");
}
console.log("PASS: published media is indexable only on public production; draft and staging media carry noindex.");

const argument = process.argv[2];
if (!argument) process.exit(0);
const origin = new URL(argument);
assert.ok(["http:", "https:"].includes(origin.protocol));
const decode = (text) => text.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
async function fetchPage(route) {
  const response = await fetch(new URL(route, origin), { redirect: "manual", signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, `${route}: HTTP 200`);
  return { response, html: await response.text() };
}
const { html: sitemap } = await fetchPage("/sitemap.xml");
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(([, value]) => new URL(decode(value)));
assert.ok(urls.length > 0);
assert.equal(new Set(urls.map(String)).size, urls.length);
const expectedArgument = process.argv.find((value) => value.startsWith("--expected-site-url="));
const expected = new URL(expectedArgument ? expectedArgument.slice("--expected-site-url=".length) : urls[0].origin);
const records = new Map(), seenTitles = new Set();
const meta = (html, attribute, key) => decode([...html.matchAll(/<meta\b([^>]+)>/g)].find(([, attrs]) => attrs.includes(`${attribute}="${key}"`))?.[1].match(/content="([^"]*)"/)?.[1] ?? "");
for (const url of urls) {
  assert.equal(url.origin, expected.origin, "Sitemap origin");
  const { html } = await fetchPage(url.pathname + url.search);
  const locale = url.pathname.split("/")[1] === "ar" ? "ar" : url.pathname.split("/")[1] === "th" ? "th" : "en";
  const title = decode(html.match(/<title>(.*?)<\/title>/s)?.[1] ?? "");
  const titleKey = `${locale}:${title}`;
  assert.ok(title && !seenTitles.has(titleKey), `${url.pathname}: unique nonempty title within its language`); seenTitles.add(titleKey);
  const description = meta(html, "name", "description");
  assert.ok(description.trim(), `${url.pathname}: description`);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1, `${url.pathname}: one h1`);
  const canonical = new URL(decode(html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? ""));
  assert.equal(canonical.href, url.href, `${url.pathname}: self canonical with configured origin`);
  const alternates = Object.fromEntries([...html.matchAll(/<link rel="alternate" hrefLang="([^"]+)" href="([^"]+)"/g)].map(([, lang, href]) => [lang, new URL(decode(href)).href]));
  assert.equal(alternates[locale], canonical.href, `${url.pathname}: self hreflang`);
  assert.ok(alternates["x-default"]);
  for (const href of Object.values(alternates)) assert.equal(new URL(href).origin, expected.origin);
  assert.ok(html.includes(`<html lang="${locale}"`));
  if (locale === "ar") assert.match(html, /dir="rtl"/);
  assert.equal(new URL(meta(html, "property", "og:url")).href, canonical.href);
  assert.equal(meta(html, "name", "twitter:card"), "summary_large_image");
  assert.equal(meta(html, "name", "twitter:image"), meta(html, "property", "og:image"), `${url.pathname}: social image parity`);
  assert.ok(meta(html, "property", "og:image:alt"), `${url.pathname}: social image description`);
  const schemas = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(([, value]) => JSON.parse(value));
  const organization = schemas.find((schema) => schema["@type"] === "Organization");
  assert.equal(organization?.["@id"], `${expected.origin}/#organization`);
  const website = schemas.find((schema) => schema["@type"] === "WebSite");
  assert.equal(website?.publisher?.["@id"], organization["@id"]);
  const product = schemas.find((schema) => schema["@type"] === "Product");
  if (product && locale !== "th") assert.equal(product.offers, undefined, "No approximate USD international Offer");
  records.set(url.href, { path: url.pathname, locale, title, description, canonical: canonical.href, alternates, robots: meta(html, "name", "robots"), schemaTypes: schemas.map((schema) => schema["@type"]) });
}
for (const [url, record] of records) for (const [language, href] of Object.entries(record.alternates)) {
  if (language === "x-default") continue;
  assert.equal(records.get(href)?.alternates[record.locale], url, `${record.path}: reciprocal hreflang`);
}
for (const locale of ["en", "ar", "th"]) {
  const prefix = locale === "en" ? "" : `/${locale}`;
  for (const route of ["/products?q=honey", "/products?category=coffee", "/search?q=honey", "/cart", "/checkout", "/account"]) {
    const { html } = await fetchPage(prefix + route);
    assert.match(meta(html, "name", "robots"), /noindex/, `${prefix + route}: noindex`);
  }
}
const report = { checkedAt: new Date().toISOString(), crawledOrigin: origin.origin, metadataOrigin: expected.origin, publicPages: records.size, pages: [...records.values()] };
const output = path.join(root, "output", "qa", "seo"); fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, origin.protocol === "https:" ? "live-crawl.json" : "crawl.json"), JSON.stringify(report, null, 2) + "\n");
console.log(`PASS: ${records.size} sitemap pages plus 18 localized query/private pages; canonical origins, reciprocal hreflang, headings, social previews, shared entities and noindex.`);

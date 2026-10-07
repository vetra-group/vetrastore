import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origin = new URL(process.argv[2]);
assert.ok(process.argv.includes("--isolated") && ["localhost", "127.0.0.1"].includes(origin.hostname), "Run release checks through the disposable local CMS runner.");
const relative = path.relative(path.join(root, "output"), path.resolve(process.env.CMS_LOCAL_DATA_DIR || root));
assert.match(relative, /^cms-live-[\w-]+$/, "Release checks must use the owner's temporary CMS folder.");
assert.equal(process.env.CMS_STORAGE, "", "A release rehearsal must not use remote storage.");
assert.equal(process.env.MONGODB_URI, "", "A release rehearsal must not connect to an application database.");
assert.equal(process.env.CLOUDINARY_API_SECRET, "", "A release rehearsal must not receive media credentials.");
const expectedArgument = process.argv.find((value) => value.startsWith("--expected-site-url="));
assert.ok(expectedArgument, "Specify the public site URL used when this build was created.");
const expected = new URL(expectedArgument.slice("--expected-site-url=".length));
assert.ok(["http:", "https:"].includes(expected.protocol) && expected.pathname === "/" && !expected.search && !expected.hash && !expected.username && !expected.password, "The expected site URL must be an HTTP(S) origin.");

let count = 0;
const check = (condition, message) => { assert.ok(condition, message); count++; };
async function response(route) { return fetch(new URL(route, origin), { redirect: "manual", signal: AbortSignal.timeout(15000) }); }
const health = await response("/api/health");
check(health.status === 200, "The isolated application's health endpoint must be healthy.");
assert.deepEqual(await health.json(), { status: "ok" }, "Public health must not expose credentials, paths, or storage details."); count++;
check(health.headers.get("cache-control")?.includes("no-store"), "Health status must not be stored in an intermediary cache.");
for (const endpoint of ["/api/cms", "/api/cms/publishing", "/api/cms/backup", "/api/cms/readiness"]) {
  const denied = await response(endpoint);
  check(denied.status === 401, `${endpoint}: private administrative data requires a session.`);
}

const locales = ["en", "ar", "th"];
const localizedPath = (locale, route = "") => `${locale === "en" ? "" : `/${locale}`}${route}` || "/";
const sitemapResponse = await response("/sitemap.xml"), sitemap = await sitemapResponse.text();
check(sitemapResponse.status === 200, "Sitemap responds.");
const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(([, url]) => new URL(url));
check(locations.length > 0, "Sitemap contains public destinations.");
const articleRoutes = locations.map((location) => location.pathname).filter((pathname) => pathname.startsWith("/blog/"));
check(articleRoutes.length > 0, "The rehearsal includes published articles for localized metadata checks.");
const publicRoutes = ["", "/products", "/coffee-blossom-honey", "/about", "/blog", ...articleRoutes, "/contact", "/help"];
for (const locale of locales) {
  const prefix = locale === "en" ? "" : `/${locale}`;
  for (const route of publicRoutes) {
    const pathname = `${prefix}${route}` || "/", page = await response(pathname);
    check(page.status === 200, `${pathname}: public staging route responds.`);
    const html = await page.text();
    check(new RegExp(`<html[^>]*lang="${locale}"`).test(html), `${pathname}: document language is correct.`);
    check(new RegExp(`<html[^>]*dir="${locale === "ar" ? "rtl" : "ltr"}"`).test(html), `${pathname}: document direction is correct.`);
    check(/<meta name="robots" content="[^"]*noindex/.test(html), `${pathname}: the rehearsal build must block indexing.`);
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/);
    check(!!canonical, `${pathname}: canonical is present.`);
    assert.equal(new URL(canonical[1]).origin, expected.origin, `${pathname}: canonical domain does not match the build's intended site URL; pass --expected-site-url=<build origin> or rebuild with the intended NEXT_PUBLIC_SITE_URL.`); count++;
    assert.equal(new URL(canonical[1]).pathname, pathname, `${pathname}: canonical references this localized page.`); count++;
    for (const language of [...locales, "x-default"]) {
      const alternate = html.match(new RegExp(`<link rel="alternate" hrefLang="${language}" href="([^"]+)"`));
      check(!!alternate, `${pathname}: ${language} language alternative is present.`);
      const destination = new URL(alternate[1]);
      assert.equal(destination.origin, expected.origin, `${pathname}: language alternatives must use the same intended domain.`); count++;
      assert.equal(destination.pathname, localizedPath(language === "x-default" ? "en" : language, route), `${pathname}: ${language} alternate preserves the equivalent page.`); count++;
    }
    const navigation = html.match(/<nav\b[^>]*aria-label="(?:เมนูหลัก|Main navigation|التنقل الرئيسي)"[^>]*>([\s\S]*?)<\/nav>/);
    check(!!navigation, `${pathname}: localized main navigation is present.`);
    for (const target of ["/products", "/about", "/blog"]) {
      check(navigation[1].includes(`href="${localizedPath(locale, target)}"`), `${pathname}: ${target} navigation preserves the language.`);
    }
    if (route.startsWith("/blog/")) {
      const schemas = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(([, json]) => JSON.parse(json));
      const article = schemas.find((schema) => schema["@type"] === "BlogPosting");
      check(!!article && !!article.headline && !!article.description, `${pathname}: complete BlogPosting metadata is present.`);
      assert.equal(article.inLanguage, locale, `${pathname}: article schema uses its page language.`); count++;
      assert.equal(new URL(article.mainEntityOfPage).href, new URL(pathname, expected).href, `${pathname}: article schema references its canonical page.`); count++;
      check(/<meta property="og:type" content="article"/.test(html), `${pathname}: article Open Graph type is present.`);
      if (locale === "ar") {
        check(/[\u0600-\u06ff]/.test(article.headline) && /[\u0600-\u06ff]/.test(article.description), `${pathname}: article metadata is in Arabic.`);
      }
    }
  }
  for (const route of ["/cms", "/cart", "/checkout", "/account", "/search?q=honey"]) {
    const page = await response(`${prefix}${route}`), html = await page.text();
    check(page.status === 200 && /<meta name="robots" content="[^"]*noindex/.test(html), `${prefix}${route}: private/search page stays out of indexing.`);
  }
  const preview = await response(`${prefix}/cms/preview?type=article&key=how-vetra-selects-products`);
  check([303, 307, 308].includes(preview.status), "An anonymous draft-preview request must redirect to CMS sign-in.");
  check(new URL(preview.headers.get("location"), origin).pathname === `${prefix}/cms`, "Draft preview redirects to the equivalent localized CMS.");
  check(preview.headers.get("x-robots-tag")?.includes("noindex"), "Draft-preview redirects carry an indexing exclusion.");
  check(preview.headers.get("cache-control")?.includes("no-store"), "Draft previews must not be cached publicly.");
}

for (const route of publicRoutes) {
  const page = await response(`/en${route}?source=legacy&campaign=locale`);
  check(page.status === 308, `/en${route}: legacy English URL redirects permanently.`);
  const target = new URL(page.headers.get("location"), origin);
  assert.equal(`${target.pathname}${target.search}`, `${route || "/"}?source=legacy&campaign=locale`, `/en${route}: legacy redirect preserves the page and query.`); count++;
}
const sitemapPaths = new Set(locations.map((location) => location.pathname));
check(sitemapPaths.size === locations.length, "Sitemap contains no duplicate destinations.");
for (const location of locations) {
  assert.equal(location.origin, expected.origin, "Every sitemap URL uses the intended public domain."); count++;
  check(!/^\/(?:(?:en|ar|th)\/)?(?:cms|staff|cart|checkout|account|search)(?:\/|$)/.test(location.pathname), "Sitemap excludes private and internal-search routes.");
  check(!/^\/en(?:\/|$)/.test(location.pathname), "Sitemap excludes legacy English-prefixed routes.");
  const route = location.pathname.replace(/^\/(?:ar|th)(?=\/|$)/, "").replace(/^\/$/, "");
  for (const locale of locales) check(sitemapPaths.has(localizedPath(locale, route)), `${location.pathname}: sitemap contains its ${locale} equivalent.`);
}
const robotsResponse = await response("/robots.txt"), robots = await robotsResponse.text();
check(robotsResponse.status === 200 && /Disallow: \/\s/.test(robots), "The rehearsal blocks crawling globally.");
const sitemapUrl = robots.match(/^Sitemap:\s*(\S+)/m)?.[1];
check(!!sitemapUrl && new URL(sitemapUrl).origin === expected.origin, "robots.txt advertises the intended domain's sitemap.");
console.log(`PASS: ${count} isolated release checks for three-language routes and ${articleRoutes.length} articles per language, metadata domains, English legacy redirects, staging/private indexing, authentication and public health. No provider or deployment requests.`);

import assert from "node:assert/strict";

const base = process.argv[2] || "http://127.0.0.1:3000";
const locales = ["en", "ar", "th"];
const navigationLabels = { en: { about: "About us", blog: "Blog" }, ar: { about: "من نحن", blog: "المقالات" }, th: { about: "เกี่ยวกับเรา", blog: "บทความ" } };
const sitemapResponse = await fetch(`${base}/sitemap.xml`);
assert.equal(sitemapResponse.status, 200, "Sitemap: HTTP status");
const sitemap = await sitemapResponse.text();
const sitemapPaths = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(
  ([, url]) => new URL(url).pathname,
);
const articlePaths = sitemapPaths.filter((path) => path.startsWith("/blog/"));
assert.ok(articlePaths.length > 0, "Sitemap includes published blog articles");
const paths = [
  "",
  "/products",
  "/coffee-blossom-honey",
  "/cart",
  "/checkout",
  "/account",
  "/about",
  "/blog",
  ...articlePaths,
  "/contact",
  "/help",
];
let checked = 0;
let demoMode = false;
let indexingBlocked = false;
const localizedPath = (locale, path) =>
  `${locale === "en" ? "" : `/${locale}`}${path}` || "/";
for (const locale of locales) {
  let homeFooter;
  for (const path of paths) {
    const expectedPath = localizedPath(locale, path);
    const url = `${base}${expectedPath}`;
    const response = await fetch(url);
    assert.equal(response.status, 200, `${url}: HTTP status`);
    const html = await response.text();
    if (path === "" && locale === "en") {
      demoMode = html.includes('data-demo-mode="true"');
      indexingBlocked = /<meta name="robots" content="noindex/.test(html);
    }
    if (indexingBlocked) assert.match(html, /<meta name="robots" content="noindex/, `${url}: demo/staging noindex`);
    assert.match(
      html,
      new RegExp(`<html[^>]*lang="${locale}"`),
      `${url}: document language`,
    );
    assert.match(html, new RegExp(`<html[^>]*dir="${locale === "ar" ? "rtl" : "ltr"}"`), `${url}: document direction`);
    assert.equal(
      (html.match(/<main(?:\s|>)/g) || []).length,
      1,
      `${url}: single main landmark`,
    );
    assert.equal(
      (html.match(/<h1(?:\s|>)/g) || []).length,
      1,
      `${url}: single page heading`,
    );
    const footers = html.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/g) || [];
    assert.equal(footers.length, 1, `${url}: single store footer`);
    assert.match(footers[0], /id="store-footer"/, `${url}: shared store footer`);
    if (path === "") homeFooter = footers[0];
    else assert.equal(footers[0], homeFooter, `${url}: same footer as home`);
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/);
    assert.ok(canonical, `${url}: canonical URL`);
    assert.equal(new URL(canonical[1]).pathname, expectedPath);
    assert.match(html, /hrefLang="th"/);
    assert.match(html, /hrefLang="en"/);
    assert.match(html, /hrefLang="ar"/);
    for (const language of [...locales, "x-default"]) {
      const alternate = html.match(new RegExp(`<link rel="alternate" hrefLang="${language}" href="([^"]+)"`));
      assert.ok(alternate, `${url}: ${language} alternate`);
      assert.equal(new URL(alternate[1]).pathname, localizedPath(language === "x-default" ? "en" : language, path), `${url}: ${language} equivalent alternate`);
    }
    for (const otherLocale of locales.filter((language) => language !== locale)) {
      assert.ok([...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].some(([, href]) => new URL(href.replaceAll("&amp;", "&"), base).pathname === localizedPath(otherLocale, path)), `${url}: equivalent ${otherLocale} language link`);
    }
    if (path === "/about") {
      const schemas = [...html.matchAll(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
      )].map(([, json]) => JSON.parse(json));
      const about = schemas.find((schema) => schema["@type"] === "AboutPage");
      assert.ok(about, `${url}: AboutPage structured data`);
      assert.equal(new URL(about.url).pathname, expectedPath, `${url}: AboutPage URL`);
      assert.equal(about.inLanguage, locale, `${url}: AboutPage language`);
      const navigation = html.match(/<nav\b[^>]*aria-label="(?:เมนูหลัก|Main navigation|التنقل الرئيسي)"[^>]*>([\s\S]*?)<\/nav>/);
      assert.ok(navigation, `${url}: main navigation`);
      const aboutLink = [...navigation[1].matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].find(
        ([, attributes]) => attributes.match(/\bhref="([^"]+)"/)?.[1] === expectedPath,
      );
      assert.ok(aboutLink, `${url}: about navigation destination`);
      assert.match(aboutLink[1], /\baria-current="page"/, `${url}: active about navigation`);
      assert.equal(aboutLink[2], navigationLabels[locale].about, `${url}: localized about navigation label`);
      for (const language of [...locales, "x-default"]) {
        const alternate = html.match(
          new RegExp(`<link rel="alternate" hrefLang="${language}" href="([^"]+)"`),
        );
        assert.ok(alternate, `${url}: ${language} about alternate`);
        assert.equal(
          new URL(alternate[1]).pathname,
          localizedPath(language === "x-default" ? "en" : language, path),
          `${url}: ${language} equivalent about alternate`,
        );
      }
    }
    if (path === "/blog" || path.startsWith("/blog/")) {
      const schemas = [...html.matchAll(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
      )].map(([, json]) => JSON.parse(json));
      const navigation = html.match(/<nav\b[^>]*aria-label="(?:เมนูหลัก|Main navigation|التنقل الرئيسي)"[^>]*>([\s\S]*?)<\/nav>/);
      assert.ok(navigation, `${url}: main navigation`);
      const blogLink = [...navigation[1].matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].find(
        ([, attributes]) => attributes.match(/\bhref="([^"]+)"/)?.[1] === localizedPath(locale, "/blog"),
      );
      assert.ok(blogLink, `${url}: blog navigation destination`);
      assert.match(blogLink[1], new RegExp(`\\baria-current="${path === "/blog" ? "page" : "location"}"`), `${url}: active blog navigation`);
      assert.equal(blogLink[2], navigationLabels[locale].blog, `${url}: localized blog navigation label`);
      for (const language of [...locales, "x-default"]) {
        const alternate = html.match(
          new RegExp(`<link rel="alternate" hrefLang="${language}" href="([^"]+)"`),
        );
        assert.ok(alternate, `${url}: ${language} blog alternate`);
        assert.equal(new URL(alternate[1]).pathname, localizedPath(language === "x-default" ? "en" : language, path));
      }
      if (path === "/blog") {
        const blog = schemas.find((schema) => schema["@type"] === "Blog");
        assert.ok(blog, `${url}: Blog structured data`);
        assert.equal(new URL(blog.url).pathname, expectedPath, `${url}: Blog URL`);
        assert.equal(blog.inLanguage, locale, `${url}: Blog language`);
        assert.ok(blog.name && blog.description, `${url}: Blog name and description`);
        const linkedArticles = (pageHtml) => [...new Set([...pageHtml.matchAll(/<a\b[^>]*href="([^"]+)"/g)]
          .map(([, href]) => new URL(href.replaceAll("&amp;", "&"), base).pathname)
          .filter((href) => href.startsWith(`${expectedPath}/`)))].sort();
        const articleLinks = linkedArticles(html), discovered = new Set(articleLinks);
        const expectedArticles = articlePaths.map((articlePath) => localizedPath(locale, articlePath)).sort();
        assert.ok(articleLinks.length <= 7, `${url}: first page has at most six cards plus one featured article`);
        assert.deepEqual(blog.blogPost.map((article) => new URL(article.url).pathname).sort(), articleLinks, `${url}: Blog schema matches visible articles`);
        assert.ok(blog.blogPost.every((article) => article["@type"] === "BlogPosting" && article.headline), `${url}: Blog article headlines`);
        let pageHtml = html, pageNumber = 1;
        while (true) {
          const nextAnchor = [...pageHtml.matchAll(/<a\b([^>]*)>/g)].find(([, attributes]) => /\brel="next"/.test(attributes));
          if (!nextAnchor) break;
          const href = nextAnchor[1].match(/\bhref="([^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
          assert.ok(href, `${url}: next page has a real URL`);
          const destination = new URL(href, base); pageNumber++;
          assert.equal(destination.pathname, expectedPath, `${url}: pagination keeps locale`);
          assert.equal(destination.searchParams.get("page"), String(pageNumber), `${url}: sequential next-page link`);
          assert.ok(pageNumber <= expectedArticles.length, `${url}: pagination terminates`);
          const pageResponse = await fetch(destination);
          assert.equal(pageResponse.status, 200, `${destination}: HTTP status`); pageHtml = await pageResponse.text();
          const pageLinks = linkedArticles(pageHtml);
          assert.ok(pageLinks.length > 0 && pageLinks.length <= 6, `${destination}: bounded article page`);
          for (const article of pageLinks) discovered.add(article);
          const pageSchema = [...pageHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(([, json]) => JSON.parse(json)).find((schema) => schema["@type"] === "Blog");
          assert.deepEqual(pageSchema.blogPost.map((article) => new URL(article.url).pathname).sort(), pageLinks, `${destination}: schema matches visible articles`);
          const canonical = new URL(pageHtml.match(/<link rel="canonical" href="([^"]+)"/)?.[1]?.replaceAll("&amp;", "&"));
          assert.equal(canonical.pathname, expectedPath); assert.equal(canonical.searchParams.get("page"), String(pageNumber));
        }
        assert.deepEqual([...discovered].sort(), expectedArticles, `${url}: paginated crawlable links match published sitemap articles`);
      } else {
        const article = schemas.find((schema) => schema["@type"] === "BlogPosting");
        assert.ok(article, `${url}: BlogPosting structured data`);
        assert.equal(new URL(article.mainEntityOfPage).pathname, expectedPath, `${url}: article canonical entity`);
        assert.equal(article.inLanguage, locale, `${url}: article language`);
        assert.ok(article.headline && article.description && article.image, `${url}: article metadata`);
        if (locale === "ar") {
          assert.match(article.headline, /[\u0600-\u06ff]/, `${url}: Arabic article headline`);
          assert.match(article.description, /[\u0600-\u06ff]/, `${url}: Arabic article description`);
          for (const [, section] of html.matchAll(/<section\b[^>]*id="section-\d+"[^>]*>([\s\S]*?)<\/section>/g)) {
            assert.match(section, /<h2\b[^>]*>[^<]*[\u0600-\u06ff]/, `${url}: Arabic section heading`);
            assert.match(section, /<p\b[^>]*>[^<]*[\u0600-\u06ff]/, `${url}: Arabic section body`);
          }
        }
        assert.match(html, /<meta property="og:type" content="article"/, `${url}: article Open Graph type`);
        const socialImage = html.match(/<meta property="og:image" content="([^"]+)"/);
        assert.ok(socialImage, `${url}: article Open Graph image`);
        assert.equal(html.match(/<meta name="twitter:image" content="([^"]+)"/)?.[1], socialImage[1], `${url}: article OG and Twitter image parity`);
        assert.ok(new URL(socialImage[1]).protocol.startsWith("http"), `${url}: absolute share image URL`);
        assert.equal(article.author["@type"], "Organization", `${url}: organization author`);
        assert.equal(article.publisher["@type"], "Organization", `${url}: organization publisher`);
        const breadcrumbs = schemas.find((schema) => schema["@type"] === "BreadcrumbList");
        assert.ok(breadcrumbs, `${url}: breadcrumb structured data`);
        assert.equal(new URL(breadcrumbs.itemListElement.at(-1).item).pathname, expectedPath, `${url}: current breadcrumb URL`);
        const sectionAnchors = [...html.matchAll(/href="#(section-\d+)"/g)].map(([, id]) => id);
        const articleSections = [...html.matchAll(/<section\b[^>]*id="(section-\d+)"/g)].map(([, id]) => id);
        assert.deepEqual(sectionAnchors, articleSections, `${url}: table of contents matches article sections in order`);
        assert.equal(new Set(articleSections).size, articleSections.length, `${url}: unique article section IDs`);
      }
    }
    if (path === "/coffee-blossom-honey") {
      for (const tag of ["header", "footer"]) {
        assert.equal(
          (html.match(new RegExp(`<${tag}(?:\\s|>)`, "g")) || []).length,
          1,
          `${url}: single ${tag}`,
        );
      }
      assert.ok(html.includes('id="search-heading"'), `${url}: shared store navigation`);
      assert.ok(
        html.includes(`href="${localizedPath(locale, "/about")}"`),
        `${url}: shared store navigation destinations`,
      );
      for (const language of [...locales, "x-default"]) {
        const alternate = html.match(
          new RegExp(`<link rel="alternate" hrefLang="${language}" href="([^"]+)"`),
        );
        assert.ok(alternate, `${url}: ${language} alternate`);
        assert.equal(
          new URL(alternate[1]).pathname,
          localizedPath(language === "x-default" ? "en" : language, path),
          `${url}: ${language} equivalent alternate`,
        );
      }
      const schemas = [...html.matchAll(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
      )].map(([, json]) => JSON.parse(json));
      const product = schemas.find((schema) => schema["@type"] === "Product");
      assert.ok(product, `${url}: Product structured data`);
      assert.equal(product.brand.name, "ESHAN");
      assert.equal(product.weight.value, 380);
      assert.equal(product.weight.unitCode, "GRM");
      if (product.offers) {
        assert.equal(locale, "th", `${url}: reference USD prices must not advertise international purchase offers`);
        assert.equal(product.offers.price, 380);
        assert.equal(product.offers.priceCurrency, "THB");
        assert.equal(new URL(product.offers.url).pathname, expectedPath);
      }
      assert.ok(html.includes(product.name), `${url}: visible localized product name`);
    }
    if (["", "/products"].includes(path)) {
      assert.ok(
        html.includes(`href="${localizedPath(locale, "/coffee-blossom-honey")}"`),
        `${url}: product experience discovery link`,
      );
    }
    if (["", "/products", "/about", "/blog"].includes(path)) {
      assert.match(html, /aria-current="page"/, `${url}: active navigation`);
    }
    assert.ok(
      !html.includes("Internal Server Error"),
      `${url}: no server error`,
    );
    checked++;
  }
}
for (const [oldPath, newPath] of [
  ["/en", "/"],
  ["/en/products?category=coffee", "/products?category=coffee"],
  ["/en/coffee-blossom-honey?source=legacy", "/coffee-blossom-honey?source=legacy"],
  ["/en/blog/a-taste-of-coffee-blossom", "/blog/a-taste-of-coffee-blossom"],
  ["/products/coffee-blossom-honey?source=legacy", "/coffee-blossom-honey?source=legacy"],
  ["/th/products/coffee-blossom-honey?source=legacy", "/th/coffee-blossom-honey?source=legacy"],
  ["/ar/products/coffee-blossom-honey?source=legacy", "/ar/coffee-blossom-honey?source=legacy"],
  ["/en/products/coffee-blossom-honey?source=legacy", "/coffee-blossom-honey?source=legacy"],
  ["/our-story?source=legacy&campaign=store", "/about?source=legacy&campaign=store"],
  ["/th/our-story?source=legacy", "/th/about?source=legacy"],
  ["/ar/our-story?source=legacy", "/ar/about?source=legacy"],
  ["/en/our-story?source=legacy", "/about?source=legacy"],
  ["/en/about?source=legacy", "/about?source=legacy"],
  ...["", "/ar", "/th", "/en"].flatMap((prefix) => [
    [`${prefix}/journal?source=legacy&campaign=store`, `${prefix === "/en" ? "" : prefix}/blog?source=legacy&campaign=store`],
    [`${prefix}/journal/a-taste-of-coffee-blossom?source=legacy`, `${prefix === "/en" ? "" : prefix}/blog/a-taste-of-coffee-blossom?source=legacy`],
  ]),
]) {
  const response = await fetch(`${base}${oldPath}`, { redirect: "manual" });
  assert.equal(response.status, 308, `${oldPath}: permanent redirect`);
  const target = new URL(response.headers.get("location"), base);
  assert.equal(`${target.pathname}${target.search}`, newPath);
}
for (const [oldPath, newPath] of [
  ["/our-story/?source=legacy", "/about?source=legacy"],
  ["/th/our-story/?source=legacy", "/th/about?source=legacy"],
  ["/ar/our-story/?source=legacy", "/ar/about?source=legacy"],
  ["/en/our-story/?source=legacy", "/about?source=legacy"],
  ...["", "/ar", "/th", "/en"].flatMap((prefix) => [
    [`${prefix}/journal/?source=legacy`, `${prefix === "/en" ? "" : prefix}/blog?source=legacy`],
    [`${prefix}/journal/a-taste-of-coffee-blossom/?source=legacy`, `${prefix === "/en" ? "" : prefix}/blog/a-taste-of-coffee-blossom?source=legacy`],
  ]),
]) {
  let target = new URL(oldPath, base);
  let reachedDestination = false;
  for (let redirect = 0; redirect < 3; redirect++) {
    const response = await fetch(target, { redirect: "manual" });
    assert.equal(response.status, 308, `${oldPath}: permanent trailing-slash redirect`);
    target = new URL(response.headers.get("location"), target);
    assert.equal(target.search, "?source=legacy", `${oldPath}: preserved query`);
    if (`${target.pathname}${target.search}` === newPath) {
      reachedDestination = true;
      break;
    }
  }
  assert.ok(reachedDestination, `${oldPath}: reaches the localized destination`);
}
for (const path of [
  "/fr/products",
  "/en/missing",
  "/en/products/missing",
  "/ar/missing",
  "/ar/products/missing",
  "/th/journal/missing",
  "/blog/missing",
  "/en/blog/missing",
  "/ar/blog/missing",
  "/th/blog/missing",
]) {
  const response = await fetch(`${base}${path}`);
  assert.equal(response.status, 404, `${path}: invalid route`);
}
for (const path of ["/journalism", "/ar/journalism", "/th/journalism", "/journal-old/a-taste-of-coffee-blossom"]) {
  const response = await fetch(`${base}${path}`, { redirect: "manual" });
  assert.equal(response.status, 404, `${path}: near-match paths are not redirected`);
}
assert.equal(
  new Set(sitemapPaths).size,
  sitemapPaths.length,
  "Sitemap does not contain duplicate URLs",
);
const englishSitemapPaths = sitemapPaths.filter((path) => !/^\/(?:ar|th)(?:\/|$)/.test(path));
assert.equal(sitemapPaths.length, englishSitemapPaths.length * locales.length, "Sitemap contains all three locales for every public route");
for (const path of englishSitemapPaths) {
  for (const locale of locales) assert.ok(sitemapPaths.includes(localizedPath(locale, path === "/" ? "" : path)), `${path}: ${locale} sitemap equivalent`);
}
for (const locale of locales) {
  assert.ok(
    [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].some(
      ([, url]) => new URL(url).pathname === localizedPath(locale, "/coffee-blossom-honey"),
    ),
    `Sitemap contains the ${locale} product experience`,
  );
  assert.ok(
    [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].some(
      ([, url]) => new URL(url).pathname === localizedPath(locale, "/about"),
    ),
    `Sitemap contains the ${locale} about page`,
  );
  assert.ok(sitemapPaths.includes(localizedPath(locale, "/blog")), `Sitemap contains the ${locale} blog page`);
  for (const path of articlePaths) {
    assert.ok(sitemapPaths.includes(localizedPath(locale, path)), `Sitemap contains the ${locale} article ${path}`);
  }
}
assert.ok(sitemapPaths.every((path) => !/^\/en(?:\/|$)/.test(path)), "Sitemap excludes legacy English-prefixed URLs");
for (const privatePath of ["/cart", "/checkout", "/account", "/staff", "/cms", "/products/coffee-blossom-honey", "/our-story", "/journal"])
  assert.ok(!sitemap.includes(privatePath));
for (const locale of locales) {
  const path = localizedPath(locale, "/staff");
  const response = await fetch(`${base}${path}`);
  assert.equal(response.status, demoMode ? 200 : 404, `${path}: demo-only staff route`);
  if (demoMode) {
    const html = await response.text();
    assert.match(html, /<meta name="robots" content="noindex, nofollow"/);
    assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1);
  }
}
for (const locale of locales) {
  const path = localizedPath(locale, "/cms");
  const response = await fetch(`${base}${path}`);
  assert.equal(response.status, 200, `${path}: CMS entry route`);
  const html = await response.text();
  assert.match(html, /<meta name="robots" content="noindex, nofollow"/);
  assert.equal((html.match(/<main(?:\s|>)/g) || []).length, 1, `${path}: single main landmark`);
  assert.ok(!html.includes('id="search-heading"'), `${path}: CMS owns its navigation`);
}
const robots = await (await fetch(`${base}/robots.txt`)).text();
if (indexingBlocked) assert.match(robots, /Disallow: \/\s/);
else {
  assert.match(robots, /Allow: \/api\/cms-media\//);
  assert.match(robots, /Disallow: \/api\//);
  for (const locale of locales) assert.ok(!robots.includes(`Disallow: ${localizedPath(locale, "/cart")}`), "Crawlers can read page noindex directives");
}
console.log(
  `PASS: ${checked} localized routes (${articlePaths.length} published articles per locale), metadata, headings, shared navigation, honey/blog schemas, discovery, missing routes, permanent legacy redirects with queries and trailing slashes, sitemap, robots, CMS entry routes, and ${demoMode ? "demo" : "disabled"} staff routes.`,
);

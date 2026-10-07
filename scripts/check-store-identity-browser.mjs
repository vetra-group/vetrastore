import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./lib/browser.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origin = process.argv[2];
if (!origin || !process.argv.includes("--isolated") || !/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(origin)) throw new Error("Run against disposable data: check-cms-live.mjs --identity-only");
const output = path.join(root, "output", "qa", "store-identity");
await mkdir(output, { recursive: true });
const browser = await launchBrowser(output);
const checks = [], layouts = [], homeMetadata = new Map();
const pass = (name) => { checks.push(name); console.log(`PASS: ${name}`); };
const content = (name) => `document.querySelector('meta[name="${name}"]')?.content`;
const snapshot = () => browser.evaluate(`({title:document.title,description:${content("description")},og:document.querySelector('meta[property="og:title"]')?.content,image:document.querySelector('meta[property="og:image"]')?.content})`);
async function layout(label) {
  const dimensions = await browser.evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth})");
  layouts.push({ label, ...dimensions });
  assert.ok(dimensions.scroll <= dimensions.width + 1, `${label}: horizontal overflow`);
}
async function ready() {
  await browser.wait("Boolean(document.querySelector('h1')) && !document.querySelector('[data-loading]')");
  await browser.evaluate("document.fonts.ready");
}
async function header(shopActive) {
  assert.equal(await browser.evaluate("document.querySelectorAll('header a[aria-label=\"VETRA STORE\"]').length"), 1);
  const active = await browser.evaluate("Array.from(document.querySelectorAll('header nav:not(#store-languages) a')).filter(a=>/\\/products$/.test(new URL(a.href).pathname)).map(a=>a.getAttribute('aria-current'))");
  assert.equal(active.length, 2, "Desktop and mobile retain the shared Shop link");
  const onCatalog = await browser.evaluate("/\\/products$/.test(location.pathname)");
  assert.ok(active.every(value => value === (shopActive ? onCatalog ? "page" : "location" : null)));
}
async function saveCard(locale, route) {
  const response = await fetch(`${origin}/og/${locale}/${route}.png`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^image\/png/);
  await writeFile(path.join(output, `${locale}-${route.replaceAll("/", "-")}.png`), Buffer.from(await response.arrayBuffer()));
}
try {
  for (const [locale, prefix] of [["en", ""], ["ar", "/ar"], ["th", "/th"]]) {
    for (const width of [390, 768, 1440, 2560]) {
      await browser.viewport(width, 1000);
      await browser.goto(`${origin}${prefix || "/"}`);
      await ready();
      const meta = await snapshot();
      assert.ok(meta.title.startsWith("VETRA STORE | "));
      assert.ok(!meta.title.includes("ESHAN") && !meta.description.includes("ESHAN"));
      assert.equal(meta.og, meta.title);
      homeMetadata.set(locale, meta);
      await header(false); await layout(`${locale} retailer home ${width}`);
      if (width === 390 || width === 1440) await browser.screenshot(path.join(output, `${locale}-home-${width}.png`));
    }
    for (const route of ["/products", "/coffee-blossom-honey", "/help"]) {
      await browser.goto(`${origin}${prefix}${route}`); await ready();
      await header(route !== "/help"); await layout(`${locale} ${route}`);
      if (route === "/coffee-blossom-honey") assert.ok((await snapshot()).title.includes("ESHAN"));
      if (route === "/help") {
        assert.equal(await browser.evaluate("document.querySelector('#faq a').getAttribute('href')"), `${prefix}/products`);
        assert.ok((await browser.evaluate("document.querySelector('#faq details:first-of-type p').textContent")).trim(), "Current-product answer lists the published selection");
        await browser.click("#faq details:nth-of-type(2) summary");
        await browser.screenshot(path.join(output, `${locale}-help.png`));
      }
    }
    await saveCard(locale, "home"); await saveCard(locale, "products");
    if (locale === "ar") await saveCard(locale, "coffee-blossom-honey");
    pass(`${locale}: retailer titles, shared header, care guidance, responsive layouts and share images`);
  }

  // This runner provides a separate empty data directory and disables remote
  // providers. The fixture exercises real CMS publication and public routing.
  await browser.goto(`${origin}/cms`);
  await browser.clickText("Enter local workspace");
  await browser.wait("Boolean(document.querySelector('button[aria-controls=cms-navigation]'))");
  const published = await browser.evaluate(`(async () => {
    const response=await fetch('/api/cms'); if(!response.ok) throw new Error('Fixture CMS read failed');
    const state=(await response.json()).state;
    const fixture=structuredClone(state.draft.products[0]);
    Object.assign(fixture,{id:'audit-second-brand',slug:'audit-second-brand-product',brand:'Audit Second Brand',stock:3,status:'published',featured:true});
    fixture.name={en:'Second brand test product',ar:'منتج تجريبي لعلامة ثانية',th:'สินค้าทดสอบแบรนด์ที่สอง'};
    fixture.description={en:'Disposable browser fixture.',ar:'منتج تجريبي مؤقت للاختبار.',th:'สินค้าจำลองชั่วคราวสำหรับทดสอบ'};
    delete fixture.previousSlugs;
    state.draft.products.forEach(p=>p.featured=false);
    state.draft.products.unshift(fixture);
    const saved=await fetch('/api/cms',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'publish',revision:state.revision,content:state.draft})});
    return {status:saved.status,body:await saved.json(),productNames:state.draft.products.map(product=>product.name)};
  })()`);
  assert.equal(published.status, 200, JSON.stringify(published.body));
  for (const [locale, prefix] of [["en", ""], ["ar", "/ar"], ["th", "/th"]]) {
    await browser.goto(`${origin}${prefix || "/"}`); await ready();
    assert.deepEqual(await snapshot(), homeMetadata.get(locale), "A new featured brand must not rename the store homepage or change its share URL");
    await browser.goto(`${origin}${prefix}/help`); await ready();
    const availableProducts = await browser.evaluate("document.querySelector('#faq details:first-of-type p').textContent");
    assert.ok(published.productNames.every(name => availableProducts.includes(name[locale])), "Help lists both published products after adding another brand");
    await browser.goto(`${origin}${prefix}/products/audit-second-brand-product`); await ready();
    assert.ok((await snapshot()).title.startsWith("Audit Second Brand "));
    await header(true); await layout(`${locale} second brand product header`);
    const entities = await browser.evaluate("Array.from(document.querySelectorAll('script[type=\"application/ld+json\"]')).map(s=>JSON.parse(s.textContent))");
    assert.equal(entities.find(item=>item['@type']==='Organization').name, "VETRA STORE");
    assert.equal(entities.find(item=>item['@type']==='WebSite').name, "VETRA STORE");
    assert.equal(entities.find(item=>item['@type']==='Product').brand.name, "Audit Second Brand");
    await browser.viewport(390, 844);
    await browser.click('button[aria-controls="mobile-navigation"]');
    await browser.click(`#mobile-navigation a[href="${prefix}/products"]`);
    await browser.wait(`location.pathname === ${JSON.stringify(`${prefix}/products`)} && !document.querySelector('[data-loading]')`);
    await header(true);
  }
  pass("publishing a second featured brand preserves retailer SEO and both brands share the working Shop header");
  assert.deepEqual(browser.errors, []);
  pass("no uncaught browser exceptions");
} finally {
  await writeFile(path.join(output, "report.json"), JSON.stringify({ checks, layouts, errors: browser.errors }, null, 2));
  await browser.close();
}

import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./lib/browser.mjs";
import { switchStoreLanguage } from "./lib/store-language.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origin = process.argv[2];
if (!origin || !process.argv.includes("--isolated") || !/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(origin)) throw new Error("Run with an isolated loopback preview: check-storefront-browser.mjs <origin> --isolated");
const output = path.join(root, "output", "qa", "storefront-polish");
await mkdir(output, { recursive: true });
const browser = await launchBrowser(output);
const checks = [], layouts = [], started = new Date().toISOString();
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pass = (name) => { checks.push(name); console.log(`PASS: ${name}`); };
const qs = (selector) => `document.querySelector(${JSON.stringify(selector)})`;
const gallery = '[data-gallery="product"]';
const mainImage = `${gallery} > button[aria-haspopup="dialog"]`;
const thumbs = `${gallery} [role="group"] button[aria-pressed]`;
const activeIndex = `Array.from(document.querySelectorAll(${JSON.stringify(thumbs)})).findIndex(e=>e.getAttribute('aria-pressed')==='true')`;
const content = {
  ar: { prefix: "/ar", width: 390, query: "عسل", increase: "زيادة الكمية", remove: "إزالة", undo: "تراجع", empty: "سلتك فارغة", noResults: "لا توجد نتائج بعد", next: "الصورة التالية", zoom: "تقريب", zoomOut: "إبعاد" },
  en: { prefix: "", width: 1440, query: "honey", increase: "Increase quantity", remove: "Remove", undo: "Undo", empty: "Your bag is empty", noResults: "No matches yet", next: "Next image", zoom: "Zoom in", zoomOut: "Zoom out" },
  th: { prefix: "/th", width: 390, query: "น้ำผึ้ง", increase: "เพิ่มจำนวน", remove: "นำออก", undo: "เลิกทำ", empty: "ยังไม่มีสินค้าในตะกร้า", noResults: "ยังไม่พบรายการที่ตรงกัน", next: "ภาพถัดไป", zoom: "ซูมเข้า", zoomOut: "ซูมออก" },
};
async function key(name) {
  const keyCode = { Escape: 27, Tab: 9, Enter: 13, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Home: 36, End: 35 }[name];
  // Enter needs its carriage-return text for Chromium's native button
  // activation, in addition to keydown handlers such as live search.
  await browser.command("Input.dispatchKeyEvent", { type: "keyDown", key: name, code: name, windowsVirtualKeyCode: keyCode, ...(name === "Enter" ? { text: "\r", unmodifiedText: "\r" } : {}) });
  await browser.command("Input.dispatchKeyEvent", { type: "keyUp", key: name, code: name, windowsVirtualKeyCode: keyCode });
}
async function layout(label) {
  const size = await browser.evaluate(`({ width:innerWidth, scroll:document.documentElement.scrollWidth, dialog:Array.from(document.querySelectorAll('dialog[open]')).map(e=>({width:e.clientWidth,scroll:e.scrollWidth})) })`);
  layouts.push({ label, ...size });
  assert.ok(size.scroll <= size.width + 1, `${label} overflows the page: ${JSON.stringify(size)}`);
  for (const dialog of size.dialog) assert.ok(dialog.scroll <= dialog.width + 1, `${label} overflows its dialog: ${JSON.stringify(size)}`);
}
async function readyGallery() {
  await browser.wait(`Boolean(${qs(mainImage)})`);
  await browser.evaluate(`${qs(mainImage)}.scrollIntoView({block:'center',behavior:'instant'})`);
  // Becoming enabled requires the gallery's real React image-load/decode
  // state update. This also avoids racing hydration before cart interactions.
  await browser.wait(`${qs(mainImage)}?.disabled === false && ${qs(mainImage)}?.getAttribute('aria-busy') === 'false'`, 40000);
  await browser.evaluate("document.fonts.ready.then(()=>true)");
}
async function assertClosed(id) { await browser.wait(`!${qs(`#${id}`)}?.open`); }
async function openSearch() {
  const mobile = await browser.evaluate(`Boolean(${qs('button[aria-controls="mobile-navigation"]')}?.getClientRects().length)`);
  if (mobile) {
    await browser.click('button[aria-controls="mobile-navigation"]');
    await browser.wait(`${qs('#mobile-navigation')}?.open`);
    await browser.click('#mobile-navigation button[aria-controls="store-search"]');
  } else await browser.click('header button[aria-controls="store-search"]');
  await browser.wait(`${qs('#store-search')}?.open && document.activeElement === ${qs('#quick-search-input')}`);
  return mobile ? 'button[aria-controls="mobile-navigation"]' : 'header button[aria-controls="store-search"]';
}
async function checkCarousel(locale, prefix) {
  const rotation = '[data-carousel-rotation]';
  const currentSlide = 'document.querySelector("[aria-roledescription] [role=group][aria-hidden=false]")?.getAttribute("aria-label")';
  await browser.goto(`${origin}${prefix || '/'}`);
  await browser.wait(`document.querySelectorAll('[aria-roledescription] img').length >= 3 && Array.from(document.querySelectorAll('[aria-roledescription] img')).every(image => image.complete && image.naturalWidth > 0)`, 40000);
  await browser.wait(`${qs(rotation)}?.dataset.rotation === 'playing'`);
  assert.equal(await browser.evaluate(`${qs(rotation)}.parentElement.querySelector('button:not([disabled]),a[href]') === ${qs(rotation)}`), true, 'The rotation control is first in the carousel tab sequence.');
  const pauseLabel = await browser.evaluate(`${qs(rotation)}.getAttribute('aria-label')`);
  assert.match(pauseLabel, locale === 'ar' ? /[\u0600-\u06ff]/ : locale === 'th' ? /[\u0e00-\u0e7f]/ : /Pause/);

  // A real pointer click focuses Pause before it clicks. That must stop
  // rotation, rather than accidentally toggle straight back to Play.
  await browser.click(rotation);
  await browser.wait(`${qs(rotation)}.dataset.rotation === 'paused'`);
  await browser.command('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 });
  await browser.evaluate('document.querySelector("button[aria-controls=store-search]").focus()');
  let stoppedSlide = await browser.evaluate(currentSlide);
  await pause(3300);
  assert.equal(await browser.evaluate(currentSlide), stoppedSlide, 'Pause remains effective after focus and pointer leave the carousel.');

  await browser.evaluate(`${qs(rotation)}.focus()`);
  await key('Enter');
  await browser.wait(`${qs(rotation)}.dataset.rotation === 'playing'`);
  await browser.wait(`${currentSlide} !== ${JSON.stringify(stoppedSlide)}`, 10000);
  await browser.wait(`document.querySelector('[aria-roledescription] [aria-busy]')?.getAttribute('aria-busy') === 'false'`);
  assert.equal(await browser.evaluate('(() => { const link = document.querySelector("[role=group][aria-hidden=false] a"); link.focus(); return document.activeElement === link; })()'), true, 'The active slide link receives focus.');
  await browser.wait(`${qs(rotation)}.dataset.rotation === 'paused'`);
  await browser.evaluate('document.querySelector("button[aria-controls=store-search]").focus()');
  stoppedSlide = await browser.evaluate(currentSlide);
  await pause(3300);
  assert.equal(await browser.evaluate(currentSlide), stoppedSlide, 'Any carousel focus pauses rotation until an explicit restart, including after focus leaves.');

  await browser.evaluate(`${qs(rotation)}.focus()`);
  await key('Enter');
  await browser.wait(`${qs(rotation)}.dataset.rotation === 'playing'`);
  await browser.command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  try {
    await browser.wait(`${qs(rotation)}.disabled && ${qs(rotation)}.dataset.rotation === 'paused'`);
    stoppedSlide = await browser.evaluate(currentSlide);
    await pause(3300);
    assert.equal(await browser.evaluate(currentSlide), stoppedSlide, 'Reduced motion disables automatic rotation after an explicit restart.');
    await layout(`${locale}: localized carousel rotation controls`);
  } finally {
    await browser.command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  }
  pass(`${locale}: pointer Pause, persistent focus pause, keyboard restart and reduced-motion carousel controls`);
}
async function swipeImage(locale) {
  await browser.evaluate(`${qs(mainImage)}.scrollIntoView({block:'center',behavior:'instant'})`);
  const box = await browser.evaluate(`(() => { const r=${qs(mainImage)}.getBoundingClientRect(); return {left:r.left,width:r.width,y:Math.max(180,Math.min(innerHeight-120,r.top+r.width*.45))}; })()`);
  await browser.command("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  try {
    const from = box.left + box.width * (locale === "ar" ? 0.22 : 0.78), to = box.left + box.width * (locale === "ar" ? 0.78 : 0.22);
    const point = (x) => [{ x, y: box.y, id: 1, radiusX: 2, radiusY: 2, force: 1 }];
    await browser.command("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(from) });
    for (let step = 1; step <= 5; step++) {
      await pause(30);
      await browser.command("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point(from + (to - from) * step / 5) });
    }
    await browser.command("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } finally { await browser.command("Emulation.setTouchEmulationEnabled", { enabled: false }); }
}
try {
  await browser.command("Network.enable");
  for (const [locale, t] of Object.entries(content)) {
    await browser.viewport(t.width, 960);
    await checkCarousel(locale, t.prefix);
    if (process.argv.includes('--carousel-only')) continue;
    if (locale === "ar") {
      for (const width of [390, 1440]) for (const route of ["", "/products"]) {
        await browser.viewport(width, 1000);
        await browser.goto(`${origin}/ar${route}`);
        await browser.wait("document.fonts.status === 'loaded'");
        await layout(`Arabic ${route || "home"} visual review at ${width}px`);
        await browser.screenshot(path.join(output, `arabic-${route ? "collection" : "home"}-${width}.png`));
      }
    }
    await browser.viewport(t.width, 960);
    await browser.goto(`${origin}${t.prefix}/coffee-blossom-honey`);
    await readyGallery();
    assert.equal(await browser.evaluate("document.documentElement.lang"), locale);
    assert.equal(await browser.evaluate("document.documentElement.dir"), locale === "ar" ? "rtl" : "ltr");
    await layout(`${locale} product page at ${t.width}px`);

    const add = '#honey-purchase-controls > button:not([aria-pressed])';
    await browser.wait(`${qs(add)}?.disabled === false`);
    await browser.click(add);
    await browser.wait(`${qs('#mini-cart')}?.open && ${qs('#mini-cart select')}?.value === '1'`);
    const subtotal = await browser.evaluate(`${qs('#mini-cart dd')}.textContent`);
    await browser.evaluate(`(() => { const select = ${qs('#mini-cart select')}; select.value = '2'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await browser.wait(`${qs('#mini-cart select')}?.value === '2'`);
    assert.notEqual(await browser.evaluate(`${qs('#mini-cart dd')}.textContent`), subtotal);
    await layout(`${locale} mini-cart at ${t.width}px`);
    await browser.screenshot(path.join(output, `mini-cart-${locale}.png`));
    await browser.click(`#mini-cart button[aria-label^=${JSON.stringify(`${t.remove}:`)}]`);
    await browser.wait(`${qs('#mini-cart')}.textContent.includes(${JSON.stringify(t.empty)})`);
    await browser.clickText(t.undo, qs('#mini-cart'));
    await browser.wait(`${qs('#mini-cart select')}?.value === '2'`);
    await browser.command('Input.dispatchKeyEvent', { type:'keyDown', key:'Tab', code:'Tab', windowsVirtualKeyCode:9, modifiers:8 });
    await browser.command('Input.dispatchKeyEvent', { type:'keyUp', key:'Tab', code:'Tab', modifiers:8 });
    assert.equal(await browser.evaluate('Boolean(document.activeElement.closest("#mini-cart"))'), true, 'Reverse Tab after Undo stays inside the drawer');
    await key("Escape"); await assertClosed("mini-cart");
    assert.equal(await browser.evaluate(`document.activeElement === ${qs(add)}`), true, "Closing the bag returns focus to Add");
    pass(`${locale}: add, quantity/subtotal, remove, Undo and Escape focus work in the mini-cart`);

    await browser.command("Page.reload");
    await readyGallery();
    assert.equal(await browser.evaluate(`${qs('#mini-cart')}.open`), false, "Reload must not reopen the bag");
    await browser.wait(`${qs('[data-cart-trigger]')}?.getAttribute('aria-label').includes('(2)')`);
    await browser.click("[data-cart-trigger]");
    await browser.wait(`${qs('#mini-cart')}?.open && ${qs('#mini-cart select')}?.value === '2'`);
    pass(`${locale}: bag quantities persist across reload without reopening the drawer`);
    // Leave a clean bag for the next locale using the real customer controls.
    await browser.click(`#mini-cart button[aria-label^=${JSON.stringify(`${t.remove}:`)}]`);
    await key("Escape"); await assertClosed("mini-cart");

    await openSearch();
    await browser.fill("#quick-search-input", t.query);
    await browser.wait(`${qs('#quick-search-results')}?.getAttribute('aria-busy') === 'false' && document.querySelectorAll('#quick-search-results [role="option"]').length > 0`);
    const options = await browser.evaluate(`Array.from(document.querySelectorAll('#quick-search-results [role="option"]')).map(e=>({href:e.getAttribute('href'),kind:e.dataset.kind,title:e.textContent}))`);
    assert.ok(options.some((option) => option.kind === "product"), "Search shows a matching product");
    assert.ok(options.some((option) => option.kind === "article"), "Search shows matching articles");
    for (const option of options) {
      assert.equal(/^\/(ar|th)\//.exec(option.href)?.[1] ?? "en", locale, "Suggestions keep their language");
      assert.ok(!option.href.startsWith("/en/"), "English suggestions use the default unprefixed URL");
    }
    await layout(`${locale} live search at ${t.width}px`);
    await browser.screenshot(path.join(output, `search-${locale}.png`));
    await key("ArrowDown");
    await browser.wait(`${qs('#quick-search-input')}.getAttribute('aria-activedescendant') === 'quick-result-0'`);
    const destination = await browser.evaluate(`${qs('#quick-result-0')}.href`);
    await key("Enter");
    await browser.wait(`location.href === ${JSON.stringify(destination)} && !${qs('#store-search')}?.open`);
    assert.equal(await browser.evaluate("document.documentElement.lang"), locale);
    pass(`${locale}: live search focuses its input, renders products/articles and opens a localized result with the keyboard`);

    const searchReturn = await openSearch();
    await browser.fill("#quick-search-input", "vetra-no-match-qa-20431");
    await browser.wait(`${qs('#quick-search-results')}?.getAttribute('aria-busy') === 'false' && ${qs('#store-search')}.textContent.includes(${JSON.stringify(t.noResults)})`);
    assert.equal(await browser.evaluate("document.querySelectorAll('#quick-search-results [role=option]').length"), 0);
    await key("Escape"); await assertClosed("store-search");
    assert.equal(await browser.evaluate(`document.activeElement === ${qs(searchReturn)}`), true);
    pass(`${locale}: an unmatched query clears old suggestions; Escape returns focus to Search`);

    // Navigate freshly so image 3 has not been prepared at main-image size.
    await browser.goto(`${origin}${t.prefix}/coffee-blossom-honey`);
    await readyGallery();
    const count = await browser.evaluate(`document.querySelectorAll(${JSON.stringify(thumbs)}).length`);
    assert.ok(count >= 4, "The isolated default honey gallery should contain at least four images");
    assert.equal(await browser.evaluate(activeIndex), 0);
    await browser.command("Network.setCacheDisabled", { cacheDisabled: true });
    await browser.command("Network.emulateNetworkConditions", { offline: false, latency: 800, downloadThroughput: 1024 * 1024, uploadThroughput: 1024 * 1024 });
    try {
      await browser.clickExpression(`document.querySelectorAll(${JSON.stringify(thumbs)})[2]`);
      assert.equal(await browser.evaluate(`${qs(mainImage)}.getAttribute('aria-busy')`), "true");
      assert.equal(await browser.evaluate(activeIndex), 0, "The existing photo stays selected while the requested image loads");
      assert.equal(await browser.evaluate(`${qs(`${mainImage} [aria-hidden="false"] img`)}?.naturalWidth > 0`), true);
      await browser.wait(`${activeIndex} === 2 && ${qs(mainImage)}.getAttribute('aria-busy') === 'false'`, 40000);
      assert.equal(await browser.evaluate(`${qs(`${mainImage} [aria-hidden="false"] img`)}?.complete && ${qs(`${mainImage} [aria-hidden="false"] img`)}?.naturalWidth > 0`), true);
    } finally {
      await browser.command("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      await browser.command("Network.setCacheDisabled", { cacheDisabled: false });
    }
    pass(`${locale}: a delayed gallery image preserves the current photograph until the replacement decodes`);
    await browser.click(`${gallery} > div button[aria-label=${JSON.stringify(t.next)}]`);
    await browser.wait(`${activeIndex} === 3 && ${qs(mainImage)}.getAttribute('aria-busy') === 'false'`);
    await swipeImage(locale);
    await browser.wait(`${activeIndex} === ${4 % count} && ${qs(mainImage)}.getAttribute('aria-busy') === 'false'`);
    assert.equal(await browser.evaluate("Boolean(document.querySelector('dialog[open]'))"), false, "Swiping does not open the lightbox");
    await browser.evaluate(`${qs(`${thumbs}[aria-pressed="true"]`)}.focus()`);
    const beforeArrow = await browser.evaluate(activeIndex);
    await key(locale === "ar" ? "ArrowLeft" : "ArrowRight");
    await browser.wait(`${activeIndex} === ${(beforeArrow + 1) % count} && ${qs(mainImage)}.getAttribute('aria-busy') === 'false'`);
    await key(locale === "ar" ? "ArrowRight" : "ArrowLeft");
    await browser.wait(`${activeIndex} === ${beforeArrow} && ${qs(mainImage)}.getAttribute('aria-busy') === 'false'`);
    await key("End");
    await browser.wait(`${activeIndex} === ${count - 1} && ${qs(mainImage)}.getAttribute('aria-busy') === 'false'`);
    await browser.wait(`(() => { const item=${qs(`${thumbs}[aria-pressed="true"]`)};const rail=item.parentElement;const r=rail.getBoundingClientRect(),b=item.getBoundingClientRect();return b.left>=r.left-1 && b.right<=r.right+1; })()`);
    await layout(`${locale} gallery thumbnail rail at ${t.width}px`);
    await browser.evaluate(`${qs(mainImage)}.scrollIntoView({block:'center',behavior:'instant'})`);
    await browser.wait(`${qs(gallery)}.getAnimations({subtree:true}).every(animation => animation.playState !== 'running' || animation.effect?.getTiming().iterations === Infinity)`);
    await browser.screenshot(path.join(output, `gallery-${locale}.png`));
    pass(`${locale}: gallery arrows follow reading direction, touch swipe and End-key navigation keep the active thumbnail visible`);
    await browser.click(mainImage);
    await browser.wait(`Boolean(document.querySelector('${gallery} dialog[open]'))`);
    for (let index = 0; index < 8; index++) {
      await key("Tab");
      assert.equal(await browser.evaluate(`Boolean(document.activeElement.closest('${gallery} dialog[open]'))`), true);
    }
    await browser.click(`${gallery} dialog[open] button[aria-label=${JSON.stringify(t.zoom)}]`);
    await browser.wait(`Boolean(document.querySelector('${gallery} dialog[open] [role="region"][data-zoomed="true"]'))`);
    await layout(`${locale} zoomed gallery at ${t.width}px`);
    await browser.screenshot(path.join(output, `gallery-zoom-${locale}.png`));
    await key("Escape");
    await browser.wait(`!document.querySelector('${gallery} dialog[open]')`);
    assert.equal(await browser.evaluate(`document.activeElement === ${qs(mainImage)}`), true);
    pass(`${locale}: image zoom contains keyboard focus and Escape restores focus to the image`);
  }
  if (!process.argv.includes('--carousel-only')) {
  await browser.goto(`${origin}/products?category=honey&q=ESHAN#main-content`);
  for (const [locale, pathname] of [["ar", "/ar/products"], ["th", "/th/products"], ["en", "/products"]]) {
    await switchStoreLanguage(browser, locale, pathname);
    assert.equal(await browser.evaluate("location.search"), "?category=honey&q=ESHAN");
    assert.equal(await browser.evaluate("location.hash"), "#main-content");
    await layout(`${locale}: language chooser and equivalent catalog page`);
  }
  pass("Language chooser orders English, Arabic, Thai and preserves the equivalent page, query and fragment");
  }
  assert.deepEqual(browser.errors, [], "No uncaught browser exceptions");
  pass("no uncaught exceptions during the storefront journeys");
} catch (error) {
  await browser.screenshot(path.join(output, "failure.png")).catch(() => undefined);
  await writeFile(path.join(output, "failure.txt"), `${error.stack}\n\n${await browser.evaluate("document.body.innerText").catch(() => "Page unavailable")}`);
  throw error;
} finally {
  await writeFile(path.join(output, "report.json"), JSON.stringify({ started, completed: new Date().toISOString(), checks, layouts, errors: browser.errors, limitation: "Headless Chromium with actual mouse, keyboard and emulated touch input. CSS viewport checks do not verify physical devices or OS scaling. Slow gallery loading uses a simulated network; no CMS content is modified and no customer enquiry is submitted." }, null, 2));
  await browser.close();
}

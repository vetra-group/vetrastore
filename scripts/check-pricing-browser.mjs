/* Run against an isolated built storefront: node scripts/check-pricing-browser.mjs http://127.0.0.1:3101 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./lib/browser.mjs";
import { switchStoreLanguage } from "./lib/store-language.mjs";

const origin = process.argv[2];
if (!origin || !/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(origin)) throw new Error("Pass an isolated local preview URL.");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "output", "qa", "pricing");
await mkdir(output, { recursive: true });
const browser = await launchBrowser(output);
// Currency selection must be deterministic in CI and must not request live
// exchange-rate providers. Only the browser's same-origin display-rate fetch
// is replaced; checkout still uses the built storefront's THB prices.
await browser.command("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
  const originalFetch = window.fetch.bind(window);
  const sampleRates = { AED: 0.11, SAR: 0.112, KWD: 0.009, QAR: 0.11, MYR: 0.13, BND: 0.04, SGD: 0.04, CAD: 0.041, AUD: 0.045, GBP: 0.022, EUR: 0.026, USD: 0.03, THB: 1 };
  window.fetch = (input, init) => {
    const url = new URL(typeof input === "string" ? input : input.url, location.href);
    if (url.origin === location.origin && url.pathname === "/api/exchange-rates") {
      const date = new Date().toISOString().slice(0, 10);
      const rates = Object.fromEntries(Object.entries(sampleRates).map(([currency, rate]) => [currency, { rate, date, source: "ECB" }]));
      return Promise.resolve(new Response(JSON.stringify({ rates }), { status: 200, headers: { "Content-Type": "application/json" } }));
    }
    return originalFetch(input, init);
  };
})()` });
const quantity = 'input[name="quantity-coffee-blossom-honey"]';
const currencyTrigger = '[...document.querySelectorAll(\'button[aria-controls="store-currencies"]\')].find(e=>e.getClientRects().length)';
const languageTrigger = 'button[aria-controls="store-languages"]';
const chooseCurrency = async (currency) => {
  if (!await browser.evaluate(`document.querySelector('#store-currencies')?.open`)) await browser.clickExpression(currencyTrigger);
  await browser.wait(`document.querySelector('#store-currencies')?.open`);
  await browser.click(`#store-currencies button[data-currency="${currency}"]`);
  await browser.wait(`document.querySelector('#store-currencies')?.open === false`);
  assert.equal(await browser.evaluate(`document.activeElement?.getAttribute('aria-controls')`), "store-currencies", "Currency choice closes the dialog and restores trigger focus");
};
try {
  for (const [locale, prefix] of [["en", ""], ["th", "/th"], ["ar", "/ar"]]) {
    for (const width of [320, 390, 768, 1440, 1920]) {
      await browser.viewport(width, 900);
      await browser.goto(`${origin}${prefix}/coffee-blossom-honey`);
      await browser.wait(`document.querySelectorAll(${JSON.stringify(quantity)}).length === 9`);
      await browser.evaluate("document.fonts.ready.then(()=>true)");
      await browser.wait(`document.querySelector('header img')?.complete && document.querySelector('header img')?.naturalWidth>0`);
      const expectedPrice = locale === "th" ? "1,360" : "11,200";
      const bundle = await browser.evaluate(`({ quantities:[...document.querySelectorAll(${JSON.stringify(quantity)})].map(e=>Number(e.value)), four:document.querySelector('input[name="quantity-coffee-blossom-honey"][value="4"]')?.closest('label')?.innerText, overflow:document.documentElement.scrollWidth-innerWidth, marketBar:Boolean(document.querySelector('[class*="MarketSelector_"]')) })`);
      assert.equal(bundle.marketBar, false, "Market selector bar is removed");
      assert.deepEqual(bundle.quantities, [1, 2, 4, 6, 12, 24, 48, 96, 192]);
      assert.ok(bundle.four.includes(expectedPrice), `${locale} shows its language's initial price`);
      assert.equal(bundle.four.includes({ en: "per jar", th: "ต่อขวด", ar: "للعبوة الواحدة" }[locale]), false, "Price options show bundle totals without per-jar prices");
      assert.ok(await browser.evaluate(`parseFloat(getComputedStyle(document.querySelector('input[name="quantity-coffee-blossom-honey"][value="4"]').closest('label').querySelector('span')).fontSize) >= 20`), `${locale} ${width}px quantity label uses the larger text size`);
      assert.ok(bundle.overflow <= 1, `${locale} ${width}px overflows by ${bundle.overflow}px`);
      if (width === 390) {
        await browser.evaluate(`document.querySelector(${JSON.stringify(quantity)})?.closest('fieldset')?.scrollIntoView({block:'start',behavior:'instant'})`);
        await browser.evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
        await browser.screenshot(path.join(output, `${locale}-${width}-default-bundles.png`));
      }
      const position = await browser.evaluate(`(() => { const trigger=${currencyTrigger}; const logo=document.querySelector('header a[aria-label]'); return { select:trigger?.getBoundingClientRect().x, logo:logo?.getBoundingClientRect().x, count:[...document.querySelectorAll('button[aria-controls="store-currencies"]')].filter(e=>e.getClientRects().length).length }; })()`);
      assert.equal(position.count, 1, `${locale} ${width}px has one visible currency trigger`);
      assert.deepEqual(await browser.evaluate(`(() => { const currency=${currencyTrigger}; const language=document.querySelector(${JSON.stringify(languageTrigger)}); const box=currency.getBoundingClientRect(); const radius=parseFloat(getComputedStyle(currency).borderTopLeftRadius); return { currency:currency?.textContent.trim(), language:language?.textContent.trim(), currencySquare:Math.abs(box.width-box.height)<1, currencyRounded:radius>0 && radius<box.width/2, currencyNoWrap:getComputedStyle(currency).whiteSpace==='nowrap', languageCircle:getComputedStyle(language).borderTopLeftRadius }; })()`), { currency: locale === "th" ? "THB" : "USD", language: locale.toUpperCase(), currencySquare: true, currencyRounded: true, currencyNoWrap: true, languageCircle: "50%" }, `${locale} ${width}px has a rounded square currency button and circular language button`);
      const selectorIsRightOfLogo = (locale === "ar") === (width <= 768);
      assert.equal(position.select > position.logo, selectorIsRightOfLogo, `${locale} ${width}px currency selector sits on the intended side of the logo`);
      if (width === 320) {
        const headerSpacing = await browser.evaluate(`(() => { const logo=document.querySelector('header img').getBoundingClientRect(); const currency=(${currencyTrigger}).getBoundingClientRect(); return { logoWidth:logo.width, overlap:Math.max(0,Math.min(logo.right,currency.right)-Math.max(logo.left,currency.left)) }; })()`);
        assert.ok(headerSpacing.logoWidth >= 80 && headerSpacing.overlap < 1, `${locale} 320px header logo remains legible (${JSON.stringify(headerSpacing)})`);
      }
      if (width === 320 || width === 390 || width === 1440) {
        await browser.screenshot(path.join(output, `${locale}-${width}-default.png`));
        if (width !== 390) {
          await browser.clickExpression(currencyTrigger);
          await browser.wait(`document.querySelector('#store-currencies')?.open`);
          assert.equal(await browser.evaluate(`document.querySelector('#store-currencies').scrollWidth <= document.querySelector('#store-currencies').clientWidth + 1`), true, `${locale} ${width}px currency dialog has no horizontal overflow`);
          assert.equal(await browser.evaluate(`document.querySelector('#store-currencies h2')?.textContent`), { en: "Select currency", th: "เลือกสกุลเงิน", ar: "اختر العملة" }[locale]);
          assert.equal(await browser.evaluate(`document.querySelector('#store-currencies p')===null`), true, "Currency dialog has no note");
          assert.equal(await browser.evaluate(`getComputedStyle(document.querySelector('#store-currencies [role="group"]')).gridTemplateColumns.split(' ').length`), 1, "Currencies form one column");
          await browser.screenshot(path.join(output, `${locale}-${width}-currency-dialog.png`));
          if (width === 320 && locale === "en") {
            await chooseCurrency("THB");
            await browser.wait(`document.querySelector('input[name="quantity-coffee-blossom-honey"][value="4"]')?.closest('label')?.querySelector('strong')?.innerText.includes(${JSON.stringify(expectedPrice)})`);
            assert.equal(await browser.evaluate(`document.querySelector('input[name="quantity-coffee-blossom-honey"][value="4"]')?.closest('label')?.querySelector('strong')?.innerText.includes('≈')`), false, "THB shows the exact baht price");
            await chooseCurrency("KWD");
            await browser.wait(`${currencyTrigger}?.textContent.trim()==='KWD'`);
            assert.equal(await browser.evaluate(`(() => { const button=${currencyTrigger}; return button.scrollWidth<=button.clientWidth+1 && button.querySelector('bdi').getClientRects().length===1; })()`), true, "KWD stays on one line inside the currency button");
            await browser.screenshot(path.join(output, `${locale}-${width}-kwd-header.png`));
            await chooseCurrency("USD");
            await browser.wait(`document.querySelector('input[name="quantity-coffee-blossom-honey"][value="4"]')?.closest('label')?.querySelector('strong')?.innerText.includes('USD')`);
            await browser.clickExpression(currencyTrigger);
            await browser.wait(`document.querySelector('#store-currencies')?.open`);
          }
          if (width === 320) {
            await browser.evaluate(`document.querySelector('#store-currencies button[data-currency="THB"]').scrollIntoView({block:'end',behavior:'instant'})`);
            assert.equal(await browser.evaluate(`document.querySelector('#store-currencies button[aria-label]').getBoundingClientRect().top < document.querySelector('#store-currencies').getBoundingClientRect().top + 100`), true, "Currency dialog close control remains visible while scrolling");
            await browser.screenshot(path.join(output, `${locale}-${width}-currency-dialog-bottom.png`));
          }
          await browser.click('#store-currencies button[aria-label]');
          await browser.wait(`document.querySelector('#store-currencies')?.open === false`);
          await browser.click(languageTrigger);
          await browser.wait(`document.querySelector('#store-languages')?.open`);
          assert.equal(await browser.evaluate(`document.querySelector('#store-languages').scrollWidth <= document.querySelector('#store-languages').clientWidth + 1`), true, `${locale} ${width}px language dialog has no horizontal overflow`);
          await browser.screenshot(path.join(output, `${locale}-${width}-language-dialog.png`));
          await browser.click('#store-languages button[aria-label]');
          await browser.wait(`document.querySelector('#store-languages')?.open === false`);
        }
        await browser.evaluate(`document.querySelector(${JSON.stringify(quantity)})?.closest('fieldset')?.scrollIntoView({block:'start',behavior:'instant'})`);
        await browser.evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
        await browser.screenshot(path.join(output, `${locale}-${width}-bundles.png`));
      }
      console.log(`PASS: ${locale} ${width}px language pricing and horizontal layout`);
    }
  }
  await browser.viewport(1440, 900);
  await browser.goto(`${origin}/coffee-blossom-honey`);
  await browser.wait(`document.querySelectorAll(${JSON.stringify(quantity)}).length === 9`);
  await browser.wait(`document.querySelector('input[name="quantity-coffee-blossom-honey"][value="4"]')?.closest('label')?.innerText.includes('11,200')`);
  await browser.wait(`document.querySelector('input[name="quantity-coffee-blossom-honey"][value="4"]')?.closest('label')?.querySelector('strong')?.innerText.includes('USD')`);
  const usd = await browser.evaluate(`document.querySelector('input[name="quantity-coffee-blossom-honey"][value="4"]')?.closest('label')?.querySelector('strong')?.innerText`);
  const requiredCurrencies = ["AED", "SAR", "KWD", "QAR", "MYR", "BND", "SGD", "CAD", "AUD", "GBP", "EUR", "USD", "THB"];
  await browser.clickExpression(currencyTrigger);
  await browser.wait(`document.querySelector('#store-currencies')?.open`);
  assert.deepEqual(await browser.evaluate(`Array.from(document.querySelectorAll('#store-currencies button[data-currency]'), button=>button.dataset.currency)`), requiredCurrencies, "Only requested destination currencies and THB are selectable");
  await browser.wait(`Array.from(document.querySelectorAll('#store-currencies button[data-currency] img')).length===13 && Array.from(document.querySelectorAll('#store-currencies button[data-currency] img')).every(image=>image.complete && image.naturalWidth>0)`);
  for (const currency of requiredCurrencies) {
    await chooseCurrency(currency);
    await browser.wait(`document.querySelector('input[name="quantity-coffee-blossom-honey"][value="4"]')?.closest('label')?.querySelector('strong')?.innerText.includes(${JSON.stringify(currency === "THB" ? "11,200" : currency)})`);
  }
  await chooseCurrency("EUR");
  await browser.wait(`document.querySelector('input[name="quantity-coffee-blossom-honey"][value="4"]')?.closest('label')?.querySelector('strong')?.innerText.includes('EUR')`);
  assert.equal(await browser.evaluate(`${currencyTrigger}?.textContent.trim()`), "EUR", "Currency button displays the selected code");
  const eur = await browser.evaluate(`document.querySelector('input[name="quantity-coffee-blossom-honey"][value="4"]')?.closest('label')?.querySelector('strong')?.innerText`);
  assert.notEqual(eur, usd, "Selected currency updates the prominent bundle price");
  assert.equal(await browser.evaluate(`JSON.parse(localStorage.getItem('vetra-store-v1')).displayCurrency`), "EUR");
  await browser.goto(`${origin}/coffee-blossom-honey`);
  await browser.wait(`document.querySelector('input[name="quantity-coffee-blossom-honey"][value="4"]')?.closest('label')?.querySelector('strong')?.innerText.includes('EUR')`);
  await browser.clickExpression(currencyTrigger);
  await browser.wait(`document.querySelector('#store-currencies button[aria-pressed="true"]')?.dataset.currency==='EUR'`);
  await chooseCurrency("USD");
  await browser.wait(`document.querySelector('input[name="quantity-coffee-blossom-honey"][value="4"]')?.closest('label')?.querySelector('strong')?.innerText.includes('USD')`);
  await browser.click('label:has(input[name="quantity-coffee-blossom-honey"][value="4"])');
  await browser.wait(`document.querySelector('input[name="quantity-coffee-blossom-honey"][value="4"]')?.checked === true`);
  await browser.click('#honey-purchase-controls button:first-of-type');
  await browser.wait(`document.querySelector('#mini-cart')?.open === true`);
  assert.equal(await browser.evaluate(`document.querySelector('#mini-cart')?.innerText.includes('USD')`), true, "Cart uses the selected international display currency");
  await browser.click('#mini-cart button[aria-label="Close bag"]');
  await browser.wait(`document.querySelector('#mini-cart')?.open === false`);
  for (const route of ["cart", "checkout"]) {
    await browser.goto(`${origin}/${route}`);
    await browser.wait(`document.querySelector('aside')?.innerText.includes('USD') && document.querySelector('aside')?.innerText.includes('11,200')`);
    console.log(`PASS: ${route} shows the chosen currency and exact THB order total`);
  }
  await browser.goto(`${origin}/coffee-blossom-honey`);
  await chooseCurrency("EUR");
  await switchStoreLanguage(browser, "th", "/th/coffee-blossom-honey");
  await browser.wait(`document.querySelector('input[name="quantity-coffee-blossom-honey"][value="4"]')?.closest('label')?.innerText.includes('1,360')`);
  assert.equal(await browser.evaluate(`JSON.parse(localStorage.getItem('vetra-store-v1')).items[0]?.quantity`), 4, "Changing language keeps the selected bundle in the bag");
  await browser.goto(`${origin}/th/cart`);
  await browser.wait(`document.querySelector('aside')?.innerText.includes('1,360')`);
  await browser.goto(`${origin}/th/checkout`);
  await browser.wait(`document.querySelector('input[name="country"]')?.value==='Thailand' && document.querySelector('aside')?.innerText.includes('1,360')`);
  await browser.screenshot(path.join(output, "th-checkout-thailand.png"));
  await browser.fill('input[name="country"]', 'Singapore');
  await browser.wait(`document.querySelector('aside')?.innerText.includes('11,200')`);
  await browser.screenshot(path.join(output, "th-checkout-singapore.png"));
  assert.equal(await browser.evaluate(`document.querySelector('input[name="country"]')?.value`), "Singapore");
  await browser.fill('input[name="country"]', 'Thailand');
  await browser.wait(`document.querySelector('aside')?.innerText.includes('1,360')`);
  await browser.viewport(390, 900);
  await browser.fill('input[name="country"]', 'Singapore');
  await browser.wait(`document.querySelector('aside')?.innerText.includes('11,200')`);
  await browser.evaluate(`document.querySelector('input[name="country"]').scrollIntoView({block:'center',behavior:'instant'})`);
  await browser.screenshot(path.join(output, "th-checkout-singapore-mobile.png"));
  await browser.viewport(1440, 900);
  await browser.goto(`${origin}/th/coffee-blossom-honey`);
  await browser.wait(`document.querySelector('input[name="quantity-coffee-blossom-honey"][value="4"]')?.closest('label')?.querySelector('strong')?.innerText.includes('1,360')`);
  await chooseCurrency("EUR");
  await browser.wait(`document.querySelector('input[name="quantity-coffee-blossom-honey"][value="4"]')?.closest('label')?.querySelector('strong')?.innerText.includes('EUR')`);
  assert.equal(await browser.evaluate(`document.querySelector('input[name="quantity-coffee-blossom-honey"][value="4"]')?.closest('label')?.innerText.includes('1,360')`), true, "Thai bundle keeps its exact THB price alongside the estimate");
  await chooseCurrency("THB");
  await browser.wait(`document.querySelector('input[name="quantity-coffee-blossom-honey"][value="4"]')?.closest('label')?.querySelector('strong')?.innerText.includes('1,360')`);
  assert.equal(await browser.evaluate(`document.querySelector('input[name="quantity-coffee-blossom-honey"][value="4"]')?.closest('label')?.querySelector('strong')?.innerText.includes('≈')`), false, "THB selection restores the exact Thai price");
  await chooseCurrency("USD");
  await browser.goto(`${origin}/th/coffee-blossom-honey`);
  await browser.wait(`document.querySelector('input[name="quantity-coffee-blossom-honey"][value="4"]')?.closest('label')?.querySelector('strong')?.innerText.includes('USD')`);
  console.log("PASS: Thai prices respond to selected currency and keep the exact THB reference");
  console.log("PASS: language changes keep the bag and checkout address reprices both directions");
  await browser.viewport(320, 900);
  await browser.goto(`${origin}/blog?q=quality#main-content`);
  await browser.clickExpression(currencyTrigger);
  await browser.wait(`document.querySelector('#store-currencies')?.open && document.activeElement?.getAttribute('aria-label')==='Close currency selection'`);
  for (let i = 0; i < 24; i++) {
    await browser.key("Tab");
    assert.equal(await browser.evaluate(`Boolean(document.activeElement.closest('#store-currencies'))`), true, "Tab stays within currency dialog");
  }
  await browser.key("Escape");
  await browser.wait(`document.querySelector('#store-currencies')?.open === false`);
  assert.equal(await browser.evaluate(`document.activeElement?.getAttribute('aria-controls')`), "store-currencies", "Escape returns focus to currency trigger");
  await browser.click(languageTrigger);
  await browser.wait(`document.querySelector('#store-languages')?.open && document.activeElement?.getAttribute('aria-label')==='Close language selection'`);
  for (let i = 0; i < 5; i++) {
    await browser.key("Tab");
    assert.equal(await browser.evaluate(`Boolean(document.activeElement.closest('#store-languages'))`), true, "Tab stays within language dialog");
  }
  await browser.key("Escape");
  await browser.wait(`document.querySelector('#store-languages')?.open === false`);
  assert.equal(await browser.evaluate(`document.activeElement?.getAttribute('aria-controls')`), "store-languages", "Escape returns focus to language trigger");
  await switchStoreLanguage(browser, "ar", "/ar/blog");
  await browser.wait(`location.search==='?q=quality' && location.hash==='#main-content'`);
  await switchStoreLanguage(browser, "th", "/th/blog");
  await browser.wait(`location.search==='?q=quality' && location.hash==='#main-content'`);
  console.log("PASS: currency dialog traps focus and language choices preserve the route, query, fragment, and Thai client navigation");
  assert.deepEqual(browser.errors, [], "No client runtime exceptions");
} finally { await browser.close(); }

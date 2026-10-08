import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./lib/browser.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origin = process.argv[2];
if (!origin || !process.argv.includes("--isolated") || !/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(origin)) throw new Error("Use the disposable local runner: check-cms-live.mjs --minicart-only");
const output = path.join(root, "output", "qa", "mini-cart");
await mkdir(output, { recursive: true });
const browser = await launchBrowser(output);
const checks = [], layouts = [];
const pass = (message) => { checks.push(message); console.log(`PASS: ${message}`); };
const drawer = "document.querySelector('#mini-cart')";
const trigger = "document.querySelector('[data-cart-trigger]')";
const locales = {
  en: { prefix: "", shipping: "Worldwide shipping included · charged in THB", confirm: "Confirm order", close: "Close bag" },
  ar: { prefix: "/ar", shipping: "الشحن إلى جميع أنحاء العالم مشمول · يُحصّل المبلغ بالبات التايلاندي", confirm: "تأكيد الطلب", close: "إغلاق السلة" },
  th: { prefix: "/th", shipping: "จัดส่งฟรีในประเทศไทย", confirm: "ยืนยันคำสั่งซื้อ", close: "ปิดตะกร้า" },
};

async function open() {
  await browser.click("[data-cart-trigger]");
  await browser.wait(`${drawer}?.open && ${drawer}.dataset.phase === 'open'`);
  await browser.wait(`!${drawer}.getAnimations().some(animation => animation.playState === 'running')`);
}
async function close() {
  await browser.key("Escape");
  await browser.wait(`!${drawer}?.open`);
  assert.equal(await browser.evaluate(`document.activeElement === ${trigger}`), true, "Focus returns to the cart trigger");
  assert.notEqual(await browser.evaluate("document.body.style.overflow"), "hidden", "Background scrolling unlocks");
}
async function inspect(locale, width) {
  const t = locales[locale];
  const result = await browser.evaluate(`(() => {
    const dialog=${drawer}; const rect=dialog.getBoundingClientRect();
    return { width:rect.width, x:rect.x, viewport:innerWidth, rootRem:parseFloat(getComputedStyle(document.documentElement).fontSize), scroll:dialog.scrollWidth, pageScroll:document.documentElement.scrollWidth, height:rect.height, bodyOverflow:document.body.style.overflow, heading:dialog.querySelector('h2')?.getAttribute('aria-label'), icon:!!dialog.querySelector('h2 svg'), eyebrow:!!dialog.querySelector('[class*=eyebrow]'), subtitle:!!dialog.querySelector('[class*=subtitle]'), continue:!!dialog.querySelector('[class*=continue]'), shipping:dialog.querySelector('[class*=shipping]')?.textContent, buttons:Array.from(dialog.querySelectorAll('.button')).map(e=>e.textContent.trim()), animationName:getComputedStyle(dialog).animationName, animationDuration:getComputedStyle(dialog).animationDuration};
  })()`);
  layouts.push({ locale, width, ...result });
  assert.ok(Math.abs(result.width - Math.min(width * .9, result.rootRem * 36)) <= 2, `${locale} ${width}: drawer width`);
  assert.ok(Math.abs(result.x - (locale === "ar" ? 0 : width - result.width)) <= 2, `${locale} ${width}: drawer reading edge`);
  assert.ok(result.scroll <= result.width + 1 && result.pageScroll <= width + 1, `${locale} ${width}: no horizontal overflow`);
  assert.equal(result.bodyOverflow, "hidden", `${locale} ${width}: background scroll lock`);
  assert.match(result.animationName, /enter$/, `${locale} ${width}: smooth drawer entry`);
  assert.ok(result.icon && /\(\d+\)/.test(result.heading), `${locale} ${width}: accessible icon and count heading`);
  assert.equal(result.eyebrow || result.subtitle || result.continue, false, `${locale} ${width}: removed copy and control`);
  if (result.shipping) {
    assert.equal(result.shipping, t.shipping);
    assert.deepEqual(result.buttons, [t.confirm], `${locale} ${width}: one primary action`);
  }
}

try {
  for (const [locale, t] of Object.entries(locales)) {
    for (const width of [390, 768, 1440]) {
      await browser.viewport(width, 900);
      await browser.goto(`${origin}${t.prefix || "/"}`);
      await browser.wait("document.fonts.status === 'loaded'");
      assert.ok(await browser.evaluate(`${trigger}?.getClientRects().length > 0`), `${locale} ${width}: cart trigger visible`);
      await open();
      await inspect(locale, width);
      if (width === 390 || width === 1440) await browser.screenshot(path.join(output, `${locale}-${width}-empty.png`));
      await close();
    }
    pass(`${locale}: 90% mobile and tablet drawer, desktop trigger/panel, focus, and no overflow`);

    await browser.viewport(390, 812);
    await browser.goto(`${origin}${t.prefix}/coffee-blossom-honey`);
    const add = "#honey-purchase-controls > button:not([aria-pressed])";
    await browser.wait(`document.querySelector(${JSON.stringify(add)})?.disabled === false`, 40000);
    await browser.click(add);
    await browser.wait(`${drawer}?.open && ${drawer}.querySelector('[role=status]')?.textContent.trim().length > 0`);
    await browser.wait(`!${drawer}.getAnimations().some(animation => animation.playState === 'running')`);
    await inspect(locale, 390);
    await browser.screenshot(path.join(output, `${locale}-390-filled.png`));
    assert.equal(await browser.evaluate(`${drawer}.querySelectorAll('a[href="${t.prefix}/cart"]').length`), 0, `${locale}: no View bag link`);
    await browser.wait(`${drawer}.querySelector('[role=status]')?.textContent.trim() === ''`, 4500);
    assert.equal(await browser.evaluate(`${drawer}.querySelector('[class*=feedback]') === null`), true, `${locale}: feedback leaves visual layout after 3 seconds`);
    await browser.viewport(1440, 900);
    await inspect(locale, 1440);
    await browser.screenshot(path.join(output, `${locale}-1440-filled.png`));
    const checkout = `${t.prefix}/checkout`;
    await browser.click(`#mini-cart a[href="${checkout}"]`);
    await browser.wait(`location.pathname === ${JSON.stringify(checkout)} && !${drawer}?.open`);
    pass(`${locale}: selected product, localized shipping/action, 3-second feedback, and checkout navigation`);
  }
  await browser.command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await browser.viewport(390, 812);
  await browser.goto(`${origin}/th`);
  await open();
  assert.ok(await browser.evaluate(`parseFloat(getComputedStyle(${drawer}).animationDuration) <= .01`));
  await close();
  pass("Reduced motion removes drawer animation");
  assert.deepEqual(browser.errors, [], "No uncaught browser exceptions");
} finally {
  await browser.close();
}
await writeFile(path.join(output, "report.json"), JSON.stringify({ checks, layouts }, null, 2));

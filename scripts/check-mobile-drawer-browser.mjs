import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./lib/browser.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origin = process.argv[2];
if (!origin || !process.argv.includes("--isolated") || !/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(origin)) throw new Error("Use the disposable local runner: check-cms-live.mjs --navigation-only");
const output = path.join(root, "output", "qa", "mobile-drawer");
await mkdir(output, { recursive: true });
const checks = [], layouts = [], errors = [];
const pass = (message) => { checks.push(message); console.log(`PASS: ${message}`); };
const drawer = "document.querySelector('#mobile-navigation')";
const trigger = "document.querySelector('button[aria-controls=\"mobile-navigation\"]')";

async function verifyLayout(browser, label, rtl, width) {
  const state = await browser.evaluate(`(() => {
    const panel=${drawer}.getBoundingClientRect();
    const logo=document.querySelector('header a[aria-label="VETRA STORE"]').getBoundingClientRect();
    const first=${drawer}.querySelector('nav a');
    const icon=first.querySelector('svg').getBoundingClientRect(), text=first.querySelector('span').getBoundingClientRect();
    const header=document.querySelector('header').getBoundingClientRect();
    return {panel:{x:panel.x,width:panel.width,height:panel.height},logoCenter:logo.x+logo.width/2,headerCenter:header.x+header.width/2,icon:{left:icon.left,right:icon.right},text:{left:text.left,right:text.right},bodyOverflow:document.body.style.overflow,scrollWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,icons:${drawer}.querySelectorAll('nav a svg').length,links:${drawer}.querySelectorAll('nav a').length,arrows:${drawer}.querySelectorAll('nav a .lucide-arrow-right').length,headerSearchVisible:!!document.querySelector('header button[aria-controls="store-search"]').getClientRects().length,drawerSearchVisible:!!${drawer}.querySelector('button[aria-controls="store-search"]').getClientRects().length};
  })()`);
  layouts.push({ label, ...state });
  assert.ok(Math.abs(state.panel.width - Math.min(width * 0.8, 576)) <= 2, `${label}: 80% drawer width`);
  assert.ok(Math.abs(state.panel.x - (rtl ? width - state.panel.width : 0)) <= 2, `${label}: drawer opens from the reading edge: ${JSON.stringify(state.panel)}`);
  assert.ok(state.panel.height >= 700, `${label}: full-height drawer`);
  assert.ok(Math.abs(state.logoCenter - state.headerCenter) <= 2, `${label}: mobile header logo is centered`);
  assert.equal(state.bodyOverflow, "hidden", `${label}: background scroll is locked`);
  assert.ok(state.scrollWidth <= state.viewportWidth + 1, `${label}: no horizontal overflow`);
  assert.equal(state.links, 4);
  assert.equal(state.icons, state.links, `${label}: each main link has an icon`);
  assert.equal(state.arrows, 0, `${label}: no trailing arrow icons`);
  assert.ok(rtl ? state.icon.left > state.text.right : state.icon.right < state.text.left, `${label}: icons lead the labels`);
  assert.equal(state.headerSearchVisible, false);
  assert.equal(state.drawerSearchVisible, true);
}

async function open(browser) {
  await browser.click('button[aria-controls="mobile-navigation"]');
  await browser.wait(`${drawer}.open && ${drawer}.dataset.phase === 'open'`);
  await browser.wait(`!${drawer}.getAnimations().some(animation => animation.playState === 'running')`);
}

async function closeWithEscape(browser) {
  await browser.key("Escape");
  await browser.wait(`!${drawer}.open`);
  assert.equal(await browser.evaluate(`document.activeElement === ${trigger}`), true, "Focus returns to menu trigger");
  assert.notEqual(await browser.evaluate("document.body.style.overflow"), "hidden", "Background scroll unlocks");
}

const browser = await launchBrowser(output);
try {
  for (const [locale, prefix] of [["en", ""], ["ar", "/ar"], ["th", "/th"]]) {
    for (const width of [320, 390, 768]) {
      await browser.viewport(width, 812);
      await browser.goto(`${origin}${prefix || "/"}`);
      await browser.wait("document.fonts.status === 'loaded'");
      if (width === 390) await browser.screenshot(path.join(output, `${locale}-header-390.png`));
      await open(browser);
      await verifyLayout(browser, `${locale} ${width}px`, locale === "ar", width);
      if (width === 390) await browser.screenshot(path.join(output, `${locale}-drawer-390.png`));
      for (let i = 0; i < 9; i++) {
        await browser.key("Tab");
        assert.equal(await browser.evaluate(`Boolean(document.activeElement.closest('#mobile-navigation'))`), true, `${locale}: keyboard stays in drawer`);
      }
      await closeWithEscape(browser);
    }
    pass(`${locale}: 320/390/768px drawer size, header centering, icons, focus and Escape`);
  }

  await browser.viewport(390, 812);
  await browser.goto(`${origin}/`);
  await open(browser);
  await browser.click('#mobile-navigation button[aria-controls="store-search"]');
  await browser.wait(`!${drawer}.open && document.querySelector('#store-search').open && document.activeElement.id === 'quick-search-input'`);
  assert.equal(await browser.evaluate("document.body.style.overflow"), "hidden");
  await browser.key("Escape");
  await browser.wait("!document.querySelector('#store-search').open && document.activeElement?.getAttribute('aria-controls') === 'mobile-navigation'");
  pass("drawer search opens after drawer closes, keeps input focus and returns focus to the menu button");

  await open(browser);
  await browser.click('#mobile-navigation a[href="/products"]');
  await browser.wait(`location.pathname === '/products' && !${drawer}.open`);
  pass("drawer Shop link navigates and closes cleanly");

  await open(browser);
  await browser.viewport(1024, 812);
  await browser.wait(`!${drawer}.open`);
  pass("drawer closes when the layout changes to desktop navigation");

  await browser.viewport(390, 812);
  await browser.goto(`${origin}/ar`);
  await open(browser);
  await browser.command("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, x: 20, y: 400 });
  await browser.command("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, x: 20, y: 400 });
  await browser.wait(`!${drawer}.open`);
  pass("Arabic drawer dismisses from its backdrop");

  await browser.command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await open(browser);
  assert.ok(await browser.evaluate(`parseFloat(getComputedStyle(${drawer}).animationDuration) <= 0.01`));
  await closeWithEscape(browser);
  pass("reduced motion removes drawer transition");
  errors.push(...browser.errors);
} finally {
  await browser.close();
}

const largeFont = await launchBrowser(output, { preferences: { webkit: { webprefs: { default_font_size: 32 } } } });
try {
  await largeFont.viewport(320, 650);
  await largeFont.goto(`${origin}/th`);
  await largeFont.wait("document.fonts.status === 'loaded'");
  await largeFont.screenshot(path.join(output, "th-header-320-large-font.png"));
  await open(largeFont);
  const largePanel = await largeFont.evaluate(`${drawer}.getBoundingClientRect().width`);
  assert.equal(largePanel, 320, "Drawer uses available width when large text needs more room");
  await largeFont.evaluate(`${drawer}.querySelector('a[href="/th/contact"]').scrollIntoView({block:'end'})`);
  const large = await largeFont.evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,footer:${drawer}.querySelector('a[href="/th/contact"]').getBoundingClientRect().bottom,contactTextHeight:${drawer}.querySelector('a[href="/th/contact"] span').getBoundingClientRect().height,viewport:innerHeight,rem:parseFloat(getComputedStyle(document.documentElement).fontSize)})`);
  assert.equal(large.rem, 32);
  assert.ok(large.scroll <= large.width + 1);
  assert.ok(large.footer <= large.viewport + 1, "Final drawer actions remain reachable with large text");
  assert.ok(large.contactTextHeight <= 120, "Large Thai text wraps as readable words");
  await largeFont.screenshot(path.join(output, "th-drawer-320-large-font.png"));
  await closeWithEscape(largeFont);
  pass("Thai drawer remains scrollable and reachable with a real 32px browser font preference");
  errors.push(...largeFont.errors);
} finally {
  await largeFont.close();
}
assert.deepEqual(errors, [], "No uncaught browser exceptions");
await writeFile(path.join(output, "report.json"), JSON.stringify({ checks, layouts, errors }, null, 2));

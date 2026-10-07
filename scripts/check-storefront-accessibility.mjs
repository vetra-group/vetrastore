import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser } from './lib/browser.mjs';

const origin = process.argv[2];
assert.match(origin || '', /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
assert.ok(process.argv.includes('--isolated'), 'Use the isolated storefront runner.');
const output = path.resolve('output/qa/storefront-polish');
await mkdir(output, { recursive: true });
const views = [], errors = [], checks = [];
const routes = ['/', '/products', '/coffee-blossom-honey', '/contact', '/blog', '/about'];
const pass = name => { checks.push(name); console.log(`PASS: ${name}`); };
async function layout(browser, label) {
  await browser.wait("document.fonts.status==='loaded'");
  const view = await browser.evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,rem:parseFloat(getComputedStyle(document.documentElement).fontSize),dpr:devicePixelRatio})`);
  views.push({ label, ...view });
  assert.ok(view.scroll <= view.width + 1, `${label} overflows: ${JSON.stringify(view)}`);
  return view;
}
try {
  // Chromium stores real browser zoom by storage partition. The default
  // profile partition's empty relative path becomes "x". This does not use
  // CSS zoom, a simulated root font, or the pinch-only pageScaleFactor API.
  // https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/ui/zoom/chrome_zoom_level_prefs.cc
  let baseWidth;
  for (const zoom of [1, 2, 4]) {
    const browser = await launchBrowser(output, { windowSize: { width: 1280, height: 1000 }, preferences: { partition: { default_zoom_level: { x: Math.log(zoom) / Math.log(1.2) } } } });
    try {
      for (const prefix of ['', '/ar', '/th']) for (const route of routes) {
        await browser.goto(origin + (prefix + route).replace(/\/$/, '') + (prefix + route === '/' ? '/' : ''));
        const view = await layout(browser, `${prefix || 'en'}${route} browser zoom ${zoom * 100}%`);
        if (zoom === 1 && !baseWidth) baseWidth = view.width;
        assert.ok(Math.abs(view.width * zoom - baseWidth) <= 4, 'Browser zoom must change the CSS viewport, not just magnify a screenshot.');
        assert.ok(Math.abs(view.dpr - zoom) < 0.02, 'Verify actual zoom through devicePixelRatio.');
      }
      for (const prefix of ['', '/ar', '/th']) {
      const locale = prefix.slice(1) || 'en';
      await browser.goto(origin + (prefix || '/'));
      await browser.click('button[aria-controls="store-search"]');
      await browser.wait('document.activeElement?.id === "quick-search-input"');
      await layout(browser, `${locale} search dialog ${zoom * 100}%`);
      for (let i = 0; i < 8; i++) { await browser.key('Tab'); assert.equal(await browser.evaluate('Boolean(document.activeElement.closest("#store-search"))'), true); }
      await browser.screenshot(path.join(output, `search-${locale}-zoom-${zoom * 100}.png`));
      await browser.key('Escape');
      await browser.wait('!document.querySelector("#store-search")?.open');
      assert.equal(await browser.evaluate('document.activeElement.getAttribute("aria-controls")'), 'store-search');
      }
      pass(`Actual ${zoom * 100}% browser zoom: 18 localized routes plus English, Arabic and Thai search focus containment/return`);
    } finally { errors.push(...browser.errors); await browser.close(); }
  }
  const fonts = await launchBrowser(output, { preferences: { webkit: { webprefs: { default_font_size: 32 } } } });
  try {
    for (const width of [320, 1440]) {
      await fonts.viewport(width, 1000);
      for (const prefix of ['', '/ar', '/th']) for (const route of routes) {
        await fonts.goto(origin + (prefix + route).replace(/\/$/, '') + (prefix + route === '/' ? '/' : ''));
        const view = await layout(fonts, `${prefix || 'en'}${route} 32px browser font at ${width}`);
        assert.equal(view.rem, 32, 'Root must follow the browser font preference.');
      }
      await fonts.screenshot(path.join(output, `browser-font-32-${width}.png`));
    }
    pass('Real 32px browser default font: 36 localized route/width views');
    await fonts.viewport(390, 650);
    for (const [prefix, continueLabel] of [['', 'Continue shopping'], ['/ar', 'متابعة التسوق'], ['/th', 'เลือกซื้อสินค้าต่อ']]) {
    await fonts.goto(origin + prefix + '/coffee-blossom-honey');
    await fonts.wait('document.querySelector("#honey-purchase-controls > button:not([aria-pressed])")?.disabled === false');
    await fonts.click('#honey-purchase-controls > button:not([aria-pressed])');
    await fonts.wait('document.querySelector("#mini-cart")?.open');
    await fonts.clickText(continueLabel, 'document.querySelector("#mini-cart")');
    await fonts.wait('!document.querySelector("#mini-cart")?.open');
    }
    pass('Mini-cart footer in all three languages remains reachable on a short viewport with a real 32px font preference');
  } finally { errors.push(...fonts.errors); await fonts.close(); }
  const responsive = await launchBrowser(output);
  try {
    await responsive.command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    for (const width of [320, 768, 1600, 1920, 2560, 3200, 3840, 4800, 7680]) {
      await responsive.viewport(width, 1000);
      for (const prefix of ['', '/ar', '/th']) for (const route of ['/', '/products', '/coffee-blossom-honey']) {
        await responsive.goto(origin + (prefix + route).replace(/\/$/, '') + (prefix + route === '/' ? '/' : ''));
        const view = await layout(responsive, `${prefix || "en"}${route} width ${width}`);
        assert.equal(view.rem, ({ 320:16, 768:16, 1600:16, 1920:18, 2560:24, 3200:28, 3840:34, 4800:40, 7680:40 })[width]);
      }
    }
    await responsive.viewport(1440, 1000);
    await responsive.goto(origin + '/ar');
    await responsive.wait("document.fonts.status==='loaded'");
    const fontResources = await responsive.evaluate("performance.getEntriesByType('resource').map(r=>r.name).filter(n=>/woff|fonts\\.google|fonts\\.gstatic/.test(n))");
    assert.ok(fontResources.some(url => url.includes('/_next/static/media/') && url.includes('.woff2')), 'Self-hosted fonts must load.');
    assert.ok(fontResources.every(url => new URL(url).origin === origin), 'No third-party font requests.');
    await responsive.click('button[aria-controls="store-search"]');
    await responsive.wait('document.querySelector("#store-search")?.open');
    const motion = await responsive.evaluate('parseFloat(getComputedStyle(document.querySelector("#store-search")).animationDuration)');
    assert.ok(motion <= 0.01, 'Reduced motion suppresses dialog movement.');
    pass('81 English, Arabic and Thai responsive views match the requested rem curve; Arabic local fonts load; reduced motion is respected');
  } finally { errors.push(...responsive.errors); await responsive.close(); }
  assert.deepEqual(errors, []);
} finally {
  await writeFile(path.join(output, 'accessibility-report.json'), JSON.stringify({ at: new Date().toISOString(), checks, views, errors, scope: 'Installed Chromium browser, disposable profile preferences. OS scaling, physical devices and other browser engines are not covered.' }, null, 2));
}

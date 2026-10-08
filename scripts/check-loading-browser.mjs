import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./lib/browser.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origin = process.argv[2];
if (!origin || !process.argv.includes("--isolated") || !/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(origin)) throw new Error("Run against the disposable preview: check-cms-live.mjs --loading-only");
const output = path.join(root, "output", "qa", "loading");
await mkdir(output, { recursive: true });
const browser = await launchBrowser(output);
const checks = [], layouts = [];
const pass = (name) => { checks.push(name); console.log(`PASS: ${name}`); };
const loader = '[data-loading]';
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Delay only this disposable browser's reads, leaving the server and content
// untouched. Respect abort signals exactly as native fetch does.
const { identifier } = await browser.command("Page.addScriptToEvaluateOnNewDocument", { source: `
  (() => {
    const original = window.fetch.bind(window);
    const state = window.__loadingTest = {
      hold: { session: true, workspace: true, operations: false, rsc: false },
      waiting: [], requests: [], seen: [],
      release(kind) { this.hold[kind] = false; this.waiting.filter(item => item.kind === kind).forEach(item => item.resolve()); },
      restore() { window.fetch = original; }
    };
    window.fetch = async (input, init = {}) => {
      const url = new URL(input instanceof Request ? input.url : String(input), location.href);
      const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
      const method = init.method || (input instanceof Request ? input.method : 'GET');
      state.seen.push({path:url.pathname, rsc:url.searchParams.has('_rsc'), prefetch:headers.get('Next-Router-Prefetch')});
      const kind = url.pathname === '/api/cms/session' && method === 'GET' ? 'session'
        : url.pathname === '/api/cms/workspace' && method === 'GET' ? 'workspace'
        : url.pathname === '/api/cms/operations' && method === 'GET' ? 'operations'
        : url.searchParams.has('_rsc') && !headers.has('Next-Router-Prefetch') ? 'rsc' : null;
      if (kind && state.hold[kind]) {
        const signal = init.signal || (input instanceof Request ? input.signal : undefined);
        await new Promise((resolve, reject) => {
          const item = { kind, resolve: () => { signal?.removeEventListener('abort', abort); resolve(); } };
          const abort = () => reject(signal.reason || new DOMException('Aborted', 'AbortError'));
          if (signal?.aborted) return abort();
          signal?.addEventListener('abort', abort, { once: true });
          state.waiting.push(item); state.requests.push({ kind, path: url.pathname });
        });
      }
      return original(input, init);
    };
  })();
` });

async function layout(label) {
  const dimensions = await browser.evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,main:document.querySelectorAll('main').length,lang:document.documentElement.lang,dir:document.documentElement.dir})`);
  layouts.push({ label, ...dimensions });
  assert.ok(dimensions.scroll <= dimensions.width + 1, `${label} overflows: ${JSON.stringify(dimensions)}`);
  assert.equal(dimensions.main, 1, `${label} must have one main landmark`);
}
async function release(kind) { await browser.evaluate(`window.__loadingTest.release(${JSON.stringify(kind)})`); }
async function noLoading() { await browser.wait(`!document.querySelector('${loader}') && !document.querySelector('[data-navigation-loading]')`); }

try {
  const privatePreview = await fetch(`${origin}/cms/preview?type=product&key=missing`, { redirect: "manual" });
  assert.equal(privatePreview.status, 307);
  assert.equal(new URL(privatePreview.headers.get("location"), origin).pathname, "/cms");
  pass("unauthenticated CMS previews retain their HTTP redirect before loading UI");
  for (const [locale, prefix] of [["en", ""], ["ar", "/ar"], ["th", "/th"]]) {
    await browser.viewport(locale === "en" ? 1440 : 390, 900);
    await browser.goto(`${origin}${prefix}/cms`);
    await browser.wait("window.__loadingTest?.requests.some(r=>r.kind==='session')");
    await browser.wait("Boolean(document.querySelector('[data-loading=admin]'))");
    await browser.evaluate("document.fonts.ready");
    assert.equal(await browser.evaluate("document.querySelector('[data-loading=admin]').lang"), locale);
    assert.equal(await browser.evaluate("document.querySelector('[data-loading=admin]').dir"), locale === "ar" ? "rtl" : "ltr");
    assert.ok(await browser.evaluate("document.querySelector('[data-loading=admin] [role=status]').textContent.length > 10"));
    for (const width of [320, 768, 1440, 2560]) {
      await browser.viewport(width, 900); await layout(`${locale} CMS loader ${width}`);
      if ((locale === "en" && width === 1440) || (locale !== "en" && width === 320)) {
        await browser.wait("getComputedStyle(document.querySelector('[data-loading=admin]')).opacity === '1'");
        await browser.screenshot(path.join(output, `${locale}-cms-${width}.png`));
      }
    }
    await browser.command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    assert.equal(await browser.evaluate("document.querySelector('[data-loading=admin]').getAnimations({subtree:true}).filter(a=>a.playState==='running').length"), 0);
    await browser.command("Emulation.setEmulatedMedia", { features: [] });
    await release("session");
    await noLoading();
    assert.ok(await browser.evaluate("Boolean(document.querySelector('main h1'))"));
    pass(`${locale} CMS startup: responsive, localized, reduced motion, and resolves to sign-in`);
  }

  // Real SSR storefront hydration states before any application JS executes.
  await browser.command("Emulation.setScriptExecutionDisabled", { value: true });
  for (const [prefix, route, width] of [["", "cart", 1440], ["/ar", "checkout", 320], ["/th", "account", 768]]) {
    await browser.viewport(width, 1000);
    await browser.goto(`${origin}${prefix}/${route}`);
    await browser.wait("Boolean(document.querySelector('[data-loading]'))");
    await browser.wait("getComputedStyle(document.querySelector('[data-loading]')).opacity === '1'");
    await browser.evaluate("document.fonts.ready");
    await layout(`${prefix || 'en'} ${route} before hydration`);
    await browser.screenshot(path.join(output, `${prefix.slice(1) || 'en'}-${route}-initial.png`));
  }
  await browser.command("Emulation.setScriptExecutionDisabled", { value: false });
  await browser.goto(`${origin}/cart`);
  await noLoading();
  pass("cart, Arabic checkout and Thai account render branded SSR loaders and cart completes hydration");

  // Mobile menu links remain mounted when the menu closes, keeping pending
  // feedback alive until Next completes the navigation.
  await browser.viewport(390, 844);
  await browser.goto(`${origin}/contact`);
  await browser.wait("Boolean(window.__loadingTest)");
  await browser.click('button[aria-controls="mobile-navigation"]');
  await browser.evaluate("window.__loadingTest.hold.rsc=true");
  await browser.click('#mobile-navigation a[href="/about"]');
  await browser.wait("Boolean(document.querySelector('[data-navigation-loading]'))");
  await browser.wait("!document.querySelector('#mobile-navigation').open");
  await browser.wait("window.__loadingTest.requests.some(r=>r.kind==='rsc')");
  await pause(250);
  await browser.screenshot(path.join(output, "mobile-navigation-pending.png"));
  await browser.command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await browser.wait("Array.from(document.querySelectorAll('[data-navigation-loading],[data-loading=page]')).flatMap(e=>e.getAnimations({subtree:true})).filter(a=>a.playState==='running').length === 0");
  assert.equal(await browser.evaluate("Array.from(document.querySelectorAll('[data-navigation-loading],[data-loading=page]')).flatMap(e=>e.getAnimations({subtree:true})).filter(a=>a.playState==='running').length"), 0);
  await browser.command("Emulation.setEmulatedMedia", { features: [] });
  await release("rsc");
  await browser.wait("location.pathname === '/about'");
  await noLoading();
  pass("slow mobile menu navigation keeps progress visible after closing and clears on completion");

  // A prefetched loading shell is allowed to display immediately while the
  // destination payload is still pending; no invented minimum wait is added.
  await browser.viewport(1440, 1000);
  await browser.goto(`${origin}/products`);
  await noLoading();
  await pause(800);
  await browser.evaluate("window.__loadingTest.hold.rsc=true");
  await browser.click('header a[href="/about"]');
  await browser.wait("Boolean(document.querySelector('[data-loading=page]') || document.querySelector('[data-navigation-loading]'))");
  await pause(250);
  await layout("desktop slow storefront navigation");
  await browser.screenshot(path.join(output, "storefront-navigation-pending.png"));
  await release("rsc");
  await browser.wait("location.pathname === '/about'");
  await noLoading();
  pass("slow storefront navigation displays fallback or progress and clears after content arrives");

  await browser.goto(`${origin}/cms?view=orders`);
  await release("session");
  await browser.clickText("Enter local workspace");
  await browser.wait("window.__loadingTest.requests.some(r=>r.kind==='workspace')");
  assert.equal(await browser.evaluate("document.querySelector('button[type=submit]').disabled"), true);
  await release("workspace");
  await browser.wait("Boolean(document.querySelector('main h1')) && !document.querySelector('button[type=submit]')");
  await noLoading();
  // Returning while authenticated covers the second initial loading phase.
  await browser.goto(`${origin}/cms?view=orders`);
  await release("session");
  await browser.wait("window.__loadingTest.requests.some(r=>r.kind==='workspace')");
  assert.ok(await browser.evaluate("Boolean(document.querySelector('[data-loading=admin]'))"));
  await browser.evaluate("window.__loadingTest.hold.operations=true");
  await release("workspace");
  await browser.wait("window.__loadingTest.requests.some(r=>r.kind==='operations')");
  await browser.wait("Boolean(document.querySelector('[data-loading=panel]'))");
  await browser.evaluate("document.querySelector('[data-loading=panel]').scrollIntoView({block:'center',behavior:'instant'})");
  await browser.wait("getComputedStyle(document.querySelector('[data-loading=panel]')).opacity === '1'");
  await layout("CMS orders panel loading");
  await browser.screenshot(path.join(output, "cms-orders-panel.png"));
  await release("operations");
  await noLoading();
  const invalidPreview = await browser.evaluate(`(async () => { const response=await fetch('/cms/preview?type=invalid&key=missing'); return response.status; })()`);
  assert.equal(invalidPreview, 404);
  pass("authenticated workspace and nested CMS panels show loading and complete without stale loaders");

  await browser.evaluate("window.__loadingTest.hold.operations=true");
  const statusSelector = 'select[aria-label="Follow-up status"]';
  await browser.evaluate(`(() => { const s=document.querySelector(${JSON.stringify(statusSelector)}); if(!s) throw new Error('Status filter missing'); s.value='new'; s.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await browser.wait("Boolean(document.querySelector('[data-loading=compact]'))");
  await browser.evaluate(`(() => { const s=document.querySelector(${JSON.stringify(statusSelector)}); s.value='all'; s.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await browser.wait("Boolean(document.querySelector('[data-loading=compact]'))");
  assert.equal(await browser.evaluate("document.querySelectorAll('[data-loading=panel]').length"), 0);
  await release("operations");
  await noLoading();
  pass("CMS A-to-B-to-A filters keep compact progress until the latest read completes");

  // Leave a session read unresolved: the application's own 15s timeout must
  // recover. Afterwards retry against native fetch to verify the real route.
  await browser.goto(`${origin}/cms`);
  await browser.wait("Boolean(document.querySelector('[data-loading=admin]'))");
  await browser.wait("!document.querySelector('[data-loading=admin]') && Boolean(document.querySelector('[role=alert]'))", 18000);
  await browser.command("Page.removeScriptToEvaluateOnNewDocument", { identifier });
  await browser.evaluate("window.__loadingTest.restore()");
  await browser.clickText("Try again");
  await browser.wait("Boolean(document.querySelector('main h1')) && !document.querySelector('[role=alert]')");
  await noLoading();
  pass("a stalled CMS session times out and Try again restores the workspace");
  assert.deepEqual(browser.errors, []);
  pass("no browser runtime exceptions during loading journeys");
} finally {
  await writeFile(path.join(output, "report.json"), JSON.stringify({ checks, layouts, errors: browser.errors }, null, 2));
  await browser.close();
}

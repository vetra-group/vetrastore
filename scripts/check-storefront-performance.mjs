import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser } from './lib/browser.mjs';

const origin = process.argv[2] || 'http://127.0.0.1:3100';
const label = process.argv[3] || 'after';
assert.match(origin, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
assert.ok(['before', 'after'].includes(label));
const output = path.resolve('output/qa/storefront-polish');
await mkdir(output, { recursive: true });
const browser = await launchBrowser(output);
const samples = [];
try {
  await browser.command('Network.enable');
  await browser.command('Network.setCacheDisabled', { cacheDisabled: true });
  await browser.command('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 400000, uploadThroughput: 100000, connectionType: 'cellular4g' });
  await browser.command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await browser.command('Page.addScriptToEvaluateOnNewDocument', { source: `window.__lab={lcp:0,cls:0,longTask:0};for(const type of ['largest-contentful-paint','layout-shift','longtask'])new PerformanceObserver(list=>{for(const e of list.getEntries()){if(type==='largest-contentful-paint')window.__lab.lcp=e.startTime;if(type==='layout-shift'&&!e.hadRecentInput)window.__lab.cls+=e.value;if(type==='longtask')window.__lab.longTask+=e.duration;}}).observe({type,buffered:true});` });
  for (const width of [390, 1440]) for (const prefix of ['', '/ar', '/th']) for (const routePath of ['', '/coffee-blossom-honey']) {
    const route = `${prefix}${routePath}` || '/';
    const locale = prefix.slice(1) || 'en';
    await browser.viewport(width, 900);
    await browser.goto(origin + route);
    await browser.wait(`document.fonts.status==='loaded'&&Array.from(document.images).filter(i=>i.getBoundingClientRect().top<innerHeight&&i.getBoundingClientRect().bottom>0).every(i=>i.complete&&i.naturalWidth>0)`, 45000);
    await browser.evaluate('new Promise(resolve=>setTimeout(resolve,1200))');
    samples.push(await browser.evaluate(`({route:location.pathname,width:innerWidth,metrics:window.__lab,fontStatus:document.fonts.status,resources:performance.getEntriesByType('resource').map(r=>({url:r.name,bytes:r.encodedBodySize,transfer:r.transferSize,duration:Math.round(r.duration)})),overflow:document.documentElement.scrollWidth>innerWidth})`));
    if (label === 'after' && !routePath) {
      await browser.evaluate('document.querySelector("main > section:nth-of-type(3)").scrollIntoView({block:"start",behavior:"instant"})');
      await browser.wait('Array.from(document.querySelectorAll("main > section:nth-of-type(3) img")).filter(i=>i.getBoundingClientRect().top<innerHeight).every(i=>i.complete && i.naturalWidth>0)');
      await browser.screenshot(path.join(output, `home-collections-${locale}-${width}.png`));
    }
  }
  console.log(JSON.stringify(samples.map(s=>({route:s.route,width:s.width,...s.metrics,fontRequests:s.resources.filter(r=>/woff|fonts\.google|fonts\.gstatic/.test(r.url)).length,overflow:s.overflow})),null,2));
} finally {
  await writeFile(path.join(output, `performance-${label}.json`), JSON.stringify({ label, at:new Date().toISOString(), conditions:'Fresh browser profile, disabled HTTP cache, 150ms network latency, 400KB/s download; no CPU throttle; reduced motion stabilizes slider. Local lab samples, not field Core Web Vitals. CLS is accumulated observed shifts during capture.', samples, errors:browser.errors },null,2));
  await browser.close();
}

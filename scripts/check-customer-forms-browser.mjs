import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./lib/browser.mjs";
import { switchStoreLanguage } from "./lib/store-language.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origin = process.argv[2];
if (!origin || !process.argv.includes("--isolated") || !/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(origin)) throw new Error("Run with an isolated loopback preview: check-customer-forms-browser.mjs <origin> --isolated");
const output = path.join(root, "output", "qa", "storefront-polish");
await mkdir(output, { recursive: true });
const browser = await launchBrowser(output);
const checks = [], layouts = [], started = new Date().toISOString();
const form = 'form:has(input[name="name"])';
const remember = '[data-form-recovery] input[type="checkbox"]';
const copy = {
  ar: { prefix: "/ar", errors: "يُرجى مراجعة هذه البيانات", restore: "استعادة البيانات", discard: "حذف البيانات المحفوظة", add: "إضافة إلى السلة", name: "عميل اختبار النماذج", message: "أود الاستفسار عن تفاصيل هذه المنتجات وطريقة التوصيل.", saved: "حُفظ الاستفسار التجريبي في صندوق الوارد المشترك للفريق. رقم المرجع" },
  en: { prefix: "", errors: "Please check these details", restore: "Restore details", discard: "Delete saved details", add: "Add to bag", name: "Form Browser Customer", message: "Please tell me about this product selection.", saved: "Test enquiry saved in the shared staff inbox. Reference" },
  th: { prefix: "/th", errors: "กรุณาตรวจสอบข้อมูลต่อไปนี้", restore: "นำข้อมูลกลับมา", discard: "ลบข้อมูลที่เก็บไว้", add: "เพิ่มลงตะกร้า", name: "ลูกค้าทดสอบแบบฟอร์ม", message: "ขอสอบถามข้อมูลสินค้าและวิธีการจัดส่งค่ะ", saved: "บันทึกคำสอบถามทดสอบในกล่องคำขอร่วมแล้ว เลขอ้างอิง" },
};
const pass = (name) => { checks.push(name); console.log(`PASS: ${name}`); };
const draftKey = (kind, locale) => `vetra-customer-draft:v1:${kind}:${locale}`;
const readDraft = (kind, locale) => browser.evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(draftKey(kind, locale))}) || 'null')`);
const isFormReady = `Boolean(document.querySelector(${JSON.stringify(`${form} input[name="name"]`)})) && !document.querySelector(${JSON.stringify(`${form} button[type="submit"]`)})?.disabled`;
async function ready() { await browser.wait(isFormReady); await browser.evaluate("document.fonts.ready.then(()=>true)"); }
async function layout(label) {
  const dimensions = await browser.evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,rem:parseFloat(getComputedStyle(document.documentElement).fontSize),lang:document.documentElement.lang})`);
  layouts.push({ label, ...dimensions });
  assert.ok(dimensions.scroll <= dimensions.width + 1, `${label} overflows: ${JSON.stringify(dimensions)}`);
}
async function screenshot(name) {
  await browser.evaluate(`document.querySelector(${JSON.stringify(form)})?.scrollIntoView({block:'start',behavior:'instant'})`);
  await browser.screenshot(path.join(output, name));
}
async function validation(kind, locale) {
  const c = copy[locale];
  await browser.click(`${form} button[type="submit"]`);
  await browser.wait(`document.activeElement?.getAttribute('aria-label') === ${JSON.stringify(c.errors)}`);
  const invalid = await browser.evaluate(`Array.from(document.querySelectorAll(${JSON.stringify(`${form} [aria-invalid="true"]`)})).map(e=>({name:e.name,description:e.getAttribute('aria-describedby').split(' ').every(id=>Boolean(document.getElementById(id)?.textContent.trim()))}))`);
  assert.ok(invalid.length >= (kind === "contact" ? 4 : 8));
  assert.ok(invalid.every((entry) => entry.description));
  assert.equal(await readDraft(kind, locale), null, "Invalid input is not persisted without opt-in");
  await browser.click(`div[aria-label="${c.errors}"] button`);
  assert.equal(await browser.evaluate("document.activeElement.name"), "name");
  pass(`${locale} ${kind}: inline errors are linked, summary receives focus, and its link focuses the field`);
}
async function fillContact(locale) {
  await browser.fill('input[name="name"]', copy[locale].name);
  await browser.fill('input[name="email"]', `customer-forms-${locale}@example.test`);
  await browser.fill('textarea[name="message"]', copy[locale].message);
}
async function fillCheckout(locale) {
  for (const [name, value] of Object.entries({ name: copy[locale].name, email: `checkout-forms-${locale}@example.test`, phone: locale === "ar" ? "٠٨١٢٣٤٥٦٧٨" : "0812345678", address: "12 Example Road", district: "Example district", province: "Bangkok", postcode: locale === "ar" ? "١٠١١٠" : "10110", notes: "Fictional browser test. No delivery required." })) {
    await browser.fill(`${form} [name="${name}"]`, value);
  }
}
async function recovery(kind, locale) {
  const c = copy[locale];
  assert.equal(await browser.evaluate(`document.querySelector(${JSON.stringify(remember)}).checked`), false);
  await (kind === "contact" ? fillContact(locale) : fillCheckout(locale));
  assert.equal(await readDraft(kind, locale), null, "Typing must not persist personal data before opt-in");
  await browser.click('input[name="consent"]');
  await browser.click(remember);
  await browser.wait(`Boolean(localStorage.getItem(${JSON.stringify(draftKey(kind, locale))}))`);
  const draft = await readDraft(kind, locale);
  assert.equal(draft.values.name, c.name);
  assert.equal(draft.values.consent, undefined);
  assert.equal(draft.values.payment, undefined);
  assert.equal(draft.values["preview-method"], undefined);
  assert.ok(draft.expires > Date.now() && draft.expires <= Date.now() + 24 * 60 * 60 * 1000);
  if (locale === "ar" && kind === "contact") {
    await switchStoreLanguage(browser, "en", "/contact"); await ready();
    assert.equal(await browser.evaluate('document.querySelector("input[name=name]").value'), "", "Arabic draft must not fill the English form");
    assert.equal(await readDraft(kind, "en"), null);
    assert.equal((await readDraft(kind, "ar")).values.name, c.name, "Changing language retains the Arabic draft");
    await switchStoreLanguage(browser, "ar", "/ar/contact"); await ready();
    pass("Arabic form recovery is isolated by language and survives language switching");
  }
  await browser.command("Page.reload");
  await ready();
  await browser.clickText(c.restore);
  await browser.wait(`document.querySelector('input[name="name"]').value === ${JSON.stringify(c.name)}`);
  assert.equal(await browser.evaluate(`document.querySelector('input[name="consent"]').checked`), false);
  if (kind === "checkout") assert.equal(await browser.evaluate(`document.querySelector('input[name="postcode"]').value`), "10110");
  else assert.equal(await browser.evaluate(`document.querySelector('textarea[name="message"]').value`), c.message);
  await layout(`${locale} ${kind} restored at 320px`);
  await screenshot(`forms-${kind}-${locale}-mobile-restored.png`);
  await browser.click(remember);
  assert.equal(await readDraft(kind, locale), null, "Opt-out deletes this form's saved details");
  assert.equal(await browser.evaluate(`document.querySelector('input[name="name"]').value`), c.name, "Opt-out preserves current input");
  pass(`${locale} ${kind}: recovery requires opt-in, survives reload, excludes consent/payment, and opt-out deletes only the saved copy`);
  await browser.click(remember);
  await browser.command("Page.reload"); await ready();
  await browser.clickText(c.discard);
  assert.equal(await readDraft(kind, locale), null);
  assert.equal(await browser.evaluate(`document.querySelector('input[name="name"]').value`), "");
  pass(`${locale} ${kind}: saved details can be discarded without restoring them`);
}

try {
  for (const locale of ["en", "ar", "th"]) {
    const c = copy[locale];
    await browser.viewport(320, 900);
    await browser.goto(`${origin}${c.prefix}/contact`); await ready();
    await validation("contact", locale);
    await layout(`${locale} contact errors at 320px`);
    await screenshot(`forms-contact-${locale}-mobile-errors.png`);
    await recovery("contact", locale);
    await browser.viewport(1440, 1050);
    await fillContact(locale);
    await layout(`${locale} contact details at 1440px`);
    await screenshot(`forms-contact-${locale}-desktop.png`);
    // Only this isolated local mock receives a fictional customer request.
    if (locale === "en" || locale === "ar") {
      await browser.click('input[name="consent"]'); await browser.click(remember);
      await browser.click(`${form} button[type="submit"]`);
      await browser.wait(`document.body.textContent.includes(${JSON.stringify(c.saved)})`);
      assert.equal(await readDraft("contact", locale), null);
      assert.equal(await browser.evaluate(`document.querySelector('input[name="name"]').value`), "");
      pass(`${locale}: confirmed isolated contact success clears opted-in recovery and resets the form`);
    }
  }

  // Populate the shopping bag through the real purchase UI, never storage fixtures.
  await browser.goto(`${origin}/coffee-blossom-honey`);
  await browser.clickText(copy.en.add, 'document.querySelector("#honey-purchase-controls")');
  await browser.wait('Boolean(document.querySelector("#mini-cart[open]"))');
  await browser.key("Escape");
  await browser.wait('!document.querySelector("#mini-cart")?.open');
  pass("Checkout setup adds a product through the storefront and dismisses the mini-cart with Escape");

  for (const locale of ["en", "ar", "th"]) {
    const c = copy[locale];
    await browser.viewport(320, 900);
    await browser.goto(`${origin}${c.prefix}/checkout`); await ready();
    await validation("checkout", locale);
    await layout(`${locale} checkout errors at 320px`);
    await screenshot(`forms-checkout-${locale}-mobile-errors.png`);
    await recovery("checkout", locale);
    await browser.viewport(1440, 1050);
    await fillCheckout(locale);
    await layout(`${locale} checkout details at 1440px`);
    await screenshot(`forms-checkout-${locale}-desktop.png`);
    if (locale === "ar") {
      assert.equal(await browser.evaluate(`${JSON.stringify("10110")} === document.querySelector('input[name="postcode"]').value`), true);
      await browser.click('input[name="consent"]'); await browser.click(remember);
      await browser.click(`${form} button[type="submit"]`);
      await browser.wait(`document.body.textContent.includes(${JSON.stringify(c.saved)})`);
      assert.equal(await readDraft("checkout", locale), null);
      assert.equal(await browser.evaluate("document.activeElement.tagName"), "H2");
      pass("Arabic checkout with Arabic-Indic phone/postcode succeeds through the server and clears recovery");
    }
  }
  assert.deepEqual(browser.errors, [], "No uncaught browser errors during customer form journeys");
  pass("English, Arabic and Thai contact/checkout forms remain within 320px and 1440px layouts without browser exceptions");
} catch (error) {
  await browser.screenshot(path.join(output, "forms-failure.png")).catch(() => undefined);
  await writeFile(path.join(output, "forms-failure.txt"), `${error.stack}\n\n${await browser.evaluate("document.body.innerText").catch(() => "Page unavailable")}`);
  throw error;
} finally {
  await writeFile(path.join(output, "forms-report.json"), JSON.stringify({ started, completed: new Date().toISOString(), checks, layouts, errors: browser.errors, limitation: "Headless Chromium at CSS viewport sizes. Real browser zoom/font preferences are checked by the separate accessibility suite. Requests use the isolated local mock only." }, null, 2));
  await browser.close();
}

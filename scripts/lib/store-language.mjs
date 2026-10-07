import assert from "node:assert/strict";

/** Use the actual collapsed language chooser, including its navigation path. */
export async function switchStoreLanguage(browser, locale, expectedPath) {
  const documentStartedAt = await browser.evaluate("performance.timeOrigin");
  await browser.click('summary[aria-controls="store-languages"]');
  await browser.wait('document.querySelector("#store-languages")?.closest("details")?.open');
  const order = await browser.evaluate('Array.from(document.querySelectorAll("#store-languages a[hreflang]")).map(link => link.getAttribute("hreflang"))');
  assert.deepEqual(order, ["en", "ar", "th"], "Language display order is English, Arabic, Thai");
  await browser.click(`#store-languages a[hreflang="${locale}"]`);
  await browser.wait(`document.documentElement.lang === ${JSON.stringify(locale)} && document.readyState === 'complete'${expectedPath ? ` && location.pathname === ${JSON.stringify(expectedPath)}` : ""}`);
  assert.equal(await browser.evaluate("document.documentElement.dir"), locale === "ar" ? "rtl" : "ltr");
  if (locale === "th") assert.equal(await browser.evaluate("performance.timeOrigin"), documentStartedAt, "Thai selection stays in the app instead of following cached legacy document redirects");
}

import assert from "node:assert/strict";

const origin = process.argv[2] || "http://127.0.0.1:3100";
assert.ok(process.argv.includes("--isolated"), "Use npm run test:cms:live. These checks require a disposable CMS preview so no test entries remain in your trash.");
let cookie = "", count = 0;
async function request(path, options = {}) {
  const response = await fetch(origin + path, { ...options, headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...options.headers } });
  const body = await response.json();
  return { response, body };
}
const json = (method, body) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const check = (condition, message) => { assert.ok(condition, message); count++; };
let baseline, current, changed = false;
async function save(content, action = "save", revision = current.revision) {
  const result = await request("/api/cms", json("PUT", { revision, content, action }));
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  current = result.body.state; return current;
}
try {
  const anonymous = await request("/api/cms"); check(anonymous.response.status === 401, "Anonymous CMS data access must be denied");
  const foreign = await request("/api/cms/session", { ...json("POST", { action: "login" }), headers: { "Content-Type": "application/json", Origin: "https://foreign.invalid" } });
  check(foreign.response.status === 403, "Foreign login origin must be denied");
  const login = await request("/api/cms/session", json("POST", { action: "login" }));
  check(login.response.status === 200, "Local session must start"); cookie = login.response.headers.get("set-cookie").split(";")[0];
  check(login.response.headers.get("set-cookie").includes("HttpOnly") && login.response.headers.get("set-cookie").includes("SameSite=Strict"), "Session needs protected cookie attributes");
  ({ body: { state: baseline } } = await request("/api/cms")); current = structuredClone(baseline);
  const malformed = await request("/api/cms", json("PUT", { revision: current.revision, content: null, action: "save" }));
  check(malformed.response.status === 400, "Malformed content must fail");
  const draft = structuredClone(current.draft);
  const stamp = `CMS QA ${Date.now()}`;
  draft.copy["site.en.announcement"] = stamp;
  draft.copy["site.ar.announcement"] = `اختبار نشر المحتوى ${Date.now()}`;
  await save(draft); changed = true;
  let html = await (await fetch(origin + "/")).text();
  check(!html.includes(stamp), "Saved draft must not alter published storefront");
  const stale = await request("/api/cms", json("PUT", { revision: baseline.revision, content: baseline.draft, action: "save" }));
  check(stale.response.status === 409, "Stale draft must not overwrite another save");
  const privateArticles = ["draft", "archived"].map((status) => {
    const article = structuredClone(draft.articles[0]);
    article.slug = `private-${status}-${Date.now()}`;
    article.id = article.slug;
    delete article.previousSlugs;
    article.status = status;
    article.content.en.intro = `PRIVATE ARTICLE BODY ${status} ${Date.now()}`;
    return article;
  });
  draft.articles.push(...privateArticles);
  await save(draft, "publish");
  html = await (await fetch(origin + "/")).text();
  check(html.includes(stamp), "Published copy must render on the public route");
  const visibleArticle = draft.articles.find((article) => article.status === "published");
  for (const path of ["/", "/ar", "/th", "/blog", "/ar/blog", "/th/blog", `/blog/${visibleArticle.slug}`, `/ar/blog/${visibleArticle.slug}`, `/th/blog/${visibleArticle.slug}`, "/cms", "/ar/cms", "/th/cms"]) {
    const response = await fetch(origin + path);
    check(response.status === 200, `${path}: public page response`);
    const publicHtml = await response.text();
    for (const article of privateArticles) {
      check(!publicHtml.includes(article.slug) && !publicHtml.includes(article.content.en.intro), `${path}: draft and archived articles must stay out of HTML and serialized client data`);
    }
  }
  for (const article of privateArticles) {
    const response = await fetch(`${origin}/blog/${article.slug}`);
    check(response.status === 404, "Draft and archived blog routes must not render");
  }
  const authenticatedState = await request("/api/cms");
  check(privateArticles.every((article) => authenticatedState.body.state.draft.articles.some((entry) => entry.slug === article.slug && entry.content.en.intro === article.content.en.intro)), "Authenticated CMS must retain private article bodies for editing");
  const retryRevision = current.revision - 1;
  const retried = await save(draft, "publish", retryRevision);
  check(retried.revision === retryRevision + 1, "Retry must not duplicate completed publication");
  const product = structuredClone(draft.products[0]);
  product.id = product.slug = `cms-qa-${Date.now()}`; product.category = "coffee"; product.featured = true; product.stock = 3; product.price = 123; product.name = { en: "CMS verification product", ar: "منتج لاختبار إدارة المحتوى", th: "สินค้าทดสอบ CMS" };
  draft.products.push(product); await save(draft, "publish");
  const detail = await fetch(origin + "/products/" + product.slug);
  check(detail.status === 200 && (await detail.text()).includes(product.name.en), "New published product must have a detail route");
  const catalog = await (await fetch(origin + "/products")).text();
  check(catalog.includes(product.name.en), "New published product must appear in catalog");
  for (const locale of ["ar", "th"]) {
    const translatedDetail = await fetch(`${origin}/${locale}/products/${product.slug}`);
    check(translatedDetail.status === 200 && (await translatedDetail.text()).includes(product.name[locale]), "New product translation must render on its localized detail route");
    const translatedCatalog = await (await fetch(`${origin}/${locale}/products`)).text();
    check(translatedCatalog.includes(product.name[locale]), "New product translation must appear in its localized catalog");
  }
  const beforeMoveRevision = current.revision;
  const moved = await request("/api/cms/trash", json("POST", { action: "move", revision: current.revision, kind: "product", key: product.id, content: current.draft }));
  assert.equal(moved.response.status, 200, JSON.stringify(moved.body)); current = moved.body.state;
  const entry = current.trash.find((entry) => entry.kind === "product" && entry.item.id === product.id);
  check(!!entry && !current.draft.products.some((entry) => entry.id === product.id), "Deleted product must move into trash");
  check(Date.parse(entry.expiresAt) - Date.parse(entry.deletedAt) === 30 * 24 * 60 * 60 * 1000, "Deleted product must retain an exact 30-day restore window");
  check(current.published.products.some((entry) => entry.id === product.id), "Moving a draft product to trash must preserve the published storefront until publication");
  const moveRetry = await request("/api/cms/trash", json("POST", { action: "move", revision: beforeMoveRevision, kind: "product", key: product.id, content: draft }));
  check(moveRetry.response.status === 200 && moveRetry.body.state.trash.filter((item) => item.id === entry.id).length === 1, "A completed move retry must not duplicate trash entries");
  const beforeRestoreRevision = current.revision;
  const restored = await request("/api/cms/trash", json("POST", { action: "restore", revision: current.revision, id: entry.id }));
  assert.equal(restored.response.status, 200, JSON.stringify(restored.body)); current = restored.body.state;
  check(current.draft.products.some((item) => item.id === product.id) && !current.trash.some((item) => item.id === entry.id), "Restore must return the product to its draft and remove it from trash");
  const restoreRetry = await request("/api/cms/trash", json("POST", { action: "restore", revision: beforeRestoreRevision, id: entry.id }));
  check(restoreRetry.response.status === 200 && restoreRetry.body.state.revision === current.revision, "A completed restore retry must not insert the product twice");
  const exportResult = await request("/api/cms/export");
  check(exportResult.response.status === 200 && exportResult.body.version === 1, "Backup export must contain a valid state snapshot");
} finally {
  if (changed && baseline) {
    // Every cleanup uses our latest revision; concurrent user changes return 409 and are preserved.
    await save(baseline.published, "publish");
    if (JSON.stringify(baseline.draft) !== JSON.stringify(baseline.published)) await save(baseline.draft, "save");
  }
  if (cookie) await request("/api/cms/session", { method: "DELETE" });
}
console.log(`PASS: ${count} live CMS authorization, revision, publication, product route, 30-day trash, restore, retries and export checks. Disposable preview only.`);

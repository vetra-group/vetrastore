// Run only through the owned, disposable CMS preview in check-cms-live.mjs.
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origin = process.argv[2];
assert.ok(origin && process.argv.includes("--isolated"), "Use the disposable test:cms:live runner.");
const url = new URL(origin);
assert.ok(["127.0.0.1", "localhost"].includes(url.hostname), "Only local disposable previews may be tested.");
const directory = path.resolve(process.env.CMS_LOCAL_DATA_DIR || root);
const relative = path.relative(path.join(root, "output"), directory);
assert.ok(relative && /^cms-live-[\w-]+$/.test(relative), "CMS_LOCAL_DATA_DIR must be an owned disposable cms-live folder.");

let cookie = "", checks = 0, state;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const json = (body) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
async function api(endpoint, options = {}, authenticated = true) {
  const response = await fetch(`${origin}${endpoint}`, { ...options, headers: { Origin: origin, ...(authenticated && cookie ? { Cookie: cookie } : {}), ...options.headers } });
  const body = await response.json(); return { response, body };
}
async function save(content) {
  const result = await api("/api/cms", { ...json({ revision: state.revision, content, action: "save" }), method: "PUT" });
  assert.equal(result.response.status, 200, JSON.stringify(result.body)); state = result.body.state;
}
async function publish(selection) {
  const result = await api("/api/cms/publishing", json({ action: "publish", revision: state.revision, selection }));
  assert.equal(result.response.status, 200, JSON.stringify(result.body)); state = result.body.state;
}
async function publicPage(route, authenticated = false) { return fetch(origin + route, { redirect: "manual", headers: authenticated ? { Cookie: cookie } : {} }); }

try {
  for (const endpoint of ["/api/cms/publishing", "/api/cms/backup"]) check((await api(endpoint, {}, false)).response.status === 401, `${endpoint} must require a session`);
  const login = await api("/api/cms/session", json({ action: "login" }));
  assert.equal(login.response.status, 200, JSON.stringify(login.body)); cookie = login.response.headers.get("set-cookie").split(";")[0];
  state = (await api("/api/cms")).body.state;
  const original = structuredClone(state), articleId = `workflow-${randomUUID()}`, slug = `workflow-guide-${Date.now()}`, renamed = `${slug}-revised`, privateText = `PRIVATE DRAFT ${randomUUID()}`;
  let draft = structuredClone(state.draft);
  const article = structuredClone(draft.articles[0]);
  article.id = articleId; article.slug = slug; article.status = "draft"; article.featured = false;
  delete article.previousSlugs; delete article.publishedAt; delete article.updatedAt;
  article.reviewRequired = false; article.editorialNotes = `PRIVATE NOTE ${randomUUID()}`;
  for (const locale of ["en", "ar", "th"]) { article.content[locale].title = { en: "Workflow article en", ar: "مقال لاختبار سير العمل", th: "บทความทดสอบขั้นตอนการทำงาน" }[locale]; article.content[locale].intro = locale === "en" ? privateText : locale === "ar" ? "مقدمة خاصة لاختبار سير العمل قبل النشر." : "ข้อความส่วนตัวสำหรับทดสอบขั้นตอนก่อนเผยแพร่"; }
  draft.articles.push(article); draft.products[0].price += 7; draft.settings.storeName = "Unpublished workflow store edit";
  await save(draft);
  check((await publicPage(`/blog/${slug}`)).status === 404, "A saved draft article must stay off its public route");
  const anonymousPreview = await publicPage(`/cms/preview?type=article&key=${articleId}`);
  check([303, 307, 308].includes(anonymousPreview.status), "Anonymous preview must redirect to sign-in");
  check(!(await anonymousPreview.text()).includes(privateText), "Anonymous preview must never serialize draft text");
  const preview = await publicPage(`/cms/preview?type=article&key=${articleId}`, true), previewHtml = await preview.text();
  check(preview.status === 200 && previewHtml.includes(privateText), "Authenticated preview must render the saved draft");
  check(/name="robots"[^>]*content="[^"]*noindex/.test(previewHtml), "Draft preview must be excluded from indexing");
  const review = await api("/api/cms/publishing");
  check(review.body.changes.some((entry) => entry.kind === "article" && entry.key === articleId), "Review must identify the saved article by stable identity");
  const foreign = await api("/api/cms/publishing", { ...json({ action: "publish", revision: state.revision }), headers: { "Content-Type": "application/json", Origin: "https://foreign.invalid" } });
  check(foreign.response.status === 403, "A foreign origin cannot publish");
  const staleRevision = state.revision;
  draft = structuredClone(state.draft); draft.articles.find((entry) => entry.id === articleId).status = "published"; await save(draft);
  const stalePublish = await api("/api/cms/publishing", json({ action: "publish", revision: staleRevision, selection: [{ kind: "article", key: articleId }] }));
  check(stalePublish.response.status === 409, "A stale publication revision must be rejected");
  await publish([{ kind: "article", key: articleId }]);
  check(state.published.products[0].price === original.published.products[0].price && state.published.settings.storeName === original.published.settings.storeName, "Selective article publication must preserve unrelated live product/settings data");
  check(state.draft.products[0].price === draft.products[0].price, "Selective publication must retain other draft edits");
  const live = await publicPage(`/blog/${slug}`), liveHtml = await live.text();
  check(live.status === 200 && liveHtml.includes(privateText), "Published article must render through the public route");
  check(!liveHtml.includes(article.editorialNotes), "Private editorial notes must never be serialized publicly");
  for (const locale of ["ar", "th"]) {
    const localized = await publicPage(`/${locale}/blog/${slug}`), html = await localized.text();
    check(localized.status === 200 && html.includes(article.content[locale].title), "Published article must preserve its Arabic and Thai translations");
    check(!html.includes(article.editorialNotes), "Localized public articles must not expose private notes");
  }

  const backupResponse = await api("/api/cms/backup"), backup = backupResponse.body;
  check(backupResponse.response.status === 200 && backup.format === "vetra-cms-backup" && Array.isArray(backup.files) && Array.isArray(backup.history), "Complete backup must include state, history and media payloads");
  check(backupResponse.response.headers.get("content-disposition")?.includes("attachment"), "Backup must download as a file");
  const preRenameReview = await api("/api/cms/publishing");
  const historicalId = preRenameReview.body.history.find((entry) => entry.revision === state.revision)?.id || preRenameReview.body.history[0]?.id;
  assert.ok(historicalId, "Saved publication must create history");
  draft = structuredClone(state.draft); const renaming = draft.articles.find((entry) => entry.id === articleId); renaming.slug = renamed; renaming.content.en.title = "Updated workflow title"; await save(draft);
  await publish([{ kind: "article", key: articleId }]);
  for (const locale of ["", "/ar", "/th"]) {
    const alias = await publicPage(`${locale}/blog/${slug}?campaign=test&tag=one&tag=two`);
    check(alias.status === 308, "Previous article slug must permanently redirect");
    const target = new URL(alias.headers.get("location"), origin);
    check(target.pathname === `${locale}/blog/${renamed}` && target.searchParams.get("campaign") === "test" && target.searchParams.getAll("tag").join(",") === "one,two", "Article alias must preserve locale and repeated query parameters");
  }
  const beforeRestorePublished = JSON.stringify(state.published);
  const restoreHistory = await api("/api/cms/publishing", json({ action: "restore-history", revision: state.revision, id: historicalId }));
  assert.equal(restoreHistory.response.status, 200, JSON.stringify(restoreHistory.body)); state = restoreHistory.body.state;
  check(JSON.stringify(state.published) === beforeRestorePublished, "History restore must change only the draft");
  const inspect = await api("/api/cms/backup", json({ action: "inspect", backup }));
  check(inspect.response.status === 200 && inspect.body.restoreMode === "draft" && /^[a-f0-9]{64}$/.test(inspect.body.planHash), "Backup inspection must produce a reviewed draft-only plan");
  const wrongPlan = await api("/api/cms/backup", json({ action: "restore", backup, revision: state.revision, planHash: "0".repeat(64) }));
  check(wrongPlan.response.status === 409, "Backup restore must reject an unreviewed plan hash");
  const restored = await api("/api/cms/backup", json({ action: "restore", backup, revision: state.revision, planHash: inspect.body.planHash }));
  assert.equal(restored.response.status, 200, JSON.stringify(restored.body)); state = restored.body.state;
  check(JSON.stringify(state.published) === beforeRestorePublished, "Backup restore must preserve the live published snapshot");
  check(state.draft.articles.some((entry) => entry.id === articleId && entry.content.en.title === "Workflow article en"), "Backup restore must recover original draft article content by stable identity");
  const repeatedBackup = await api("/api/cms/backup", json({ action: "restore", backup, revision: inspect.body.revision, planHash: inspect.body.planHash }));
  check(repeatedBackup.response.status === 200 && repeatedBackup.body.state.revision === state.revision, "Retrying a completed backup restore must not add another revision");
  draft = structuredClone(state.draft); draft.settings.storeName = "Later editor change"; await save(draft);
  const staleBackup = await api("/api/cms/backup", json({ action: "restore", backup, revision: inspect.body.revision, planHash: inspect.body.planHash }));
  check(staleBackup.response.status === 409, "A stale backup restore cannot overwrite a later editor change");
  console.log(`PASS: ${checks} isolated HTTP workflow checks for authenticated draft preview, selective publication, aliases, history and complete backup recovery.`);
} finally {
  // The owner runner removes this complete disposable data directory after exit.
  if (cookie) await api("/api/cms/session", { method: "DELETE" });
}

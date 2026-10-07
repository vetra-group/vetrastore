// Run only through the owned, disposable CMS preview in check-cms-live.mjs.
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origin = process.argv[2];
assert.ok(origin && process.argv.includes("--isolated"), "Use the disposable test:cms:live runner.");
assert.ok(["127.0.0.1", "localhost"].includes(new URL(origin).hostname), "Only local disposable previews may be tested.");
const directory = path.resolve(process.env.CMS_LOCAL_DATA_DIR || root);
const relative = path.relative(path.join(root, "output"), directory);
assert.ok(relative && /^cms-live-[\w-]+$/.test(relative), "CMS_LOCAL_DATA_DIR must be an owned disposable cms-live folder.");

let cookie = "", checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const json = (body, method = "PUT") => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
async function api(endpoint, options = {}, authenticated = true) {
  const response = await fetch(origin + endpoint, { ...options, headers: { Origin: origin, ...(authenticated && cookie ? { Cookie: cookie } : {}), ...options.headers } });
  return { response, body: await response.json() };
}
async function expect(endpoint, options, status = 200) {
  const result = await api(endpoint, options);
  assert.equal(result.response.status, status, JSON.stringify(result.body));
  checks++;
  return result.body;
}
const keyOf = (article) => article.id ?? article.slug;
const fullState = async () => (await expect("/api/cms")).state;
const workspace = async () => (await expect("/api/cms/workspace")).state;

try {
  check((await api("/api/cms/workspace", {}, false)).response.status === 401, "Anonymous workspace reads must be rejected.");
  check((await api("/api/cms/workspace", json({}), false)).response.status === 401, "Anonymous workspace writes must be rejected.");
  const session = await expect("/api/cms/session");
  assert.equal(session.mode, "local", "This test must never authenticate against configured staff accounts.");
  const login = await api("/api/cms/session", json({ action: "login" }, "POST"));
  assert.equal(login.response.status, 200, JSON.stringify(login.body));
  cookie = login.response.headers.get("set-cookie").split(";")[0];
  const original = await fullState();
  let compact = await workspace();
  check(compact.draft.articles.every((article) => Object.values(article.content).every((copy) => !copy.intro && !copy.sections.length)), "Workspace list omits every article body.");
  check(compact.workspace.loadedArticleIds.length === 0, "Initial workspace must declare no loaded article bodies.");
  check(!compact.draft.articles.some((article) => article.editorialNotes), "Private body notes are fetched only when an article is opened.");
  const articleKey = keyOf(original.draft.articles[0]);
  const record = await expect(`/api/cms/workspace?article=${encodeURIComponent(articleKey)}`);
  assert.deepEqual(record.article, original.draft.articles[0]);
  check(record.revision === original.revision, "Full article response must carry the same authoritative revision.");
  check((await api("/api/cms/workspace")).response.headers.get("cache-control") === "no-store", "Private workspace responses must disable caching.");
  for (const query of ["?article=", "?article=a&article=b", "?unknown=1", `?article=${"a".repeat(121)}`]) await expect(`/api/cms/workspace${query}`, {}, 400);
  await expect("/api/cms/workspace?article=missing-workspace-record", {}, 404);

  compact.draft.settings.storeName = `Workspace ${randomUUID().slice(0, 8)}`;
  const firstPayload = { revision: compact.revision, content: compact.draft, loadedArticleIds: [] };
  const firstSave = await expect("/api/cms/workspace", json(firstPayload));
  let saved = await fullState();
  assert.deepEqual(saved.draft.articles, original.draft.articles);
  assert.deepEqual(saved.published, original.published);
  check(saved.draft.settings.storeName === firstPayload.content.settings.storeName, "A compact save must retain the requested non-article edit.");
  const retry = await expect("/api/cms/workspace", json(firstPayload));
  check(retry.state.revision === firstSave.state.revision, "Retrying a successful save with a lost response must not create another revision.");

  compact = await workspace();
  const opened = await expect(`/api/cms/workspace?article=${encodeURIComponent(articleKey)}`);
  compact.draft.articles = compact.draft.articles.map((article) => keyOf(article) === articleKey ? structuredClone(opened.article) : article);
  compact.draft.articles.find((article) => keyOf(article) === articleKey).content.en.intro += " Workspace regression edit.";
  compact.draft.articles.find((article) => keyOf(article) === articleKey).content.ar.intro += " تعديل عربي لاختبار حفظ المحتوى.";
  const loadedSave = await expect("/api/cms/workspace", json({ revision: compact.revision, content: compact.draft, loadedArticleIds: [articleKey] }));
  saved = await fullState();
  check(saved.draft.articles[0].content.en.intro.endsWith(" Workspace regression edit."), "A fetched article can save its complete body.");
  check(saved.draft.articles[0].content.ar.intro.endsWith(" تعديل عربي لاختبار حفظ المحتوى."), "A loaded Arabic article body survives a compact workspace save.");
  assert.deepEqual(saved.draft.articles[0].content.th, original.draft.articles[0].content.th);
  assert.deepEqual(saved.draft.articles.slice(1), original.draft.articles.slice(1));
  check(loadedSave.state.draft.articles[0].content.en.intro === saved.draft.articles[0].content.en.intro && loadedSave.state.draft.articles.slice(1).every((article) => Object.values(article.content).every((copy) => !copy.intro && !copy.sections.length)), "Save response keeps only explicitly loaded article bodies.");
  await expect("/api/cms/workspace", json(firstPayload), 409);
  check((await fullState()).revision === saved.revision, "A stale conflicting retry must preserve the latest revision.");

  compact = await workspace();
  await expect("/api/cms/workspace", json({ revision: compact.revision, content: compact.draft, loadedArticleIds: [articleKey] }), 400);
  await expect("/api/cms/workspace", json({ revision: compact.revision, content: compact.draft, loadedArticleIds: [articleKey, articleKey] }), 400);
  await expect("/api/cms/workspace", { ...json({ revision: compact.revision, content: compact.draft, loadedArticleIds: [] }), headers: { "Content-Type": "application/json", Origin: "https://foreign.invalid" } }, 403);
  assert.deepEqual((await fullState()).draft, saved.draft);
  check((await fullState()).revision === saved.revision, "Invalid or unauthorized compact saves cannot alter saved content.");

  // Newly created records carry complete bodies even before a fetch is possible.
  compact = await workspace();
  const added = structuredClone(saved.draft.articles[0]);
  added.id = `workspace-${randomUUID()}`; added.slug = `workspace-${Date.now()}`;
  added.status = "draft"; added.featured = false;
  delete added.previousSlugs; delete added.publishedAt;
  compact.draft.articles.push(added);
  const addition = await expect("/api/cms/workspace", json({ revision: compact.revision, content: compact.draft, loadedArticleIds: [added.id] }));
  check(addition.state.draft.articles.some((article) => article.id === added.id && JSON.stringify(article.content) === JSON.stringify(added.content)), "Complete new records can be saved through the compact workspace.");
  compact = await workspace();
  const trashed = await expect("/api/cms/trash", json({ action: "move", revision: compact.revision, kind: "article", key: added.slug, content: compact.draft, loadedArticleIds: [] }, "POST"));
  const removed = trashed.state.trash.find((entry) => entry.kind === "article" && entry.item.id === added.id);
  check(!!removed && JSON.stringify(removed.item.content) === JSON.stringify(added.content), "Trashing an unloaded article must retain its complete body for restoration.");
  const restored = await expect("/api/cms/trash", json({ action: "restore", revision: trashed.state.revision, id: removed.id }, "POST"));
  check(restored.state.draft.articles.some((article) => article.id === added.id && article.content.en.intro === added.content.en.intro), "Trash restoration must recover the full article.");
  assert.deepEqual(restored.state.published, original.published);
  console.log(`PASS: ${checks} isolated workspace HTTP checks for authorization, compact reads, body preservation, idempotent retries, revision conflicts, and complete Trash recovery.`);
} finally {
  // The owner runner removes this complete disposable data directory after exit.
  if (cookie) await api("/api/cms/session", { method: "DELETE" });
}

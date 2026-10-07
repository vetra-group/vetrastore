import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url), cache = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const record = { exports: {} }; cache.set(filename, record);
  const localRequire = (name) => {
    if (name === "next/cache") return { revalidatePath() {} };
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
    if (name.startsWith(".")) return load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`)));
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled)(localRequire, record, record.exports); return record.exports;
}
const output = path.join(root, "output"); fs.mkdirSync(output, { recursive: true });
const directory = fs.mkdtempSync(path.join(output, "publishing-check-"));
const recovery = fs.mkdtempSync(path.join(output, "publishing-recovery-"));
const previous = Object.fromEntries(["NEXT_PUBLIC_DEMO_MODE", "VERCEL", "CMS_LOCAL_DATA_DIR", "CMS_STORAGE_DRIVER"].map((key) => [key, process.env[key]]));
const clone = structuredClone; let checks = 0;
function pass(message) { checks++; console.log(`PASS: ${message}`); }
function request(endpoint, method = "GET", body, cookie) { return new Request(`http://127.0.0.1:3100/api/cms${endpoint}`, { method, headers: { origin: "http://127.0.0.1:3100", ...(cookie ? { cookie } : {}), ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
try {
  process.env.NEXT_PUBLIC_DEMO_MODE = "true"; delete process.env.VERCEL; delete process.env.CMS_STORAGE_DRIVER; process.env.CMS_LOCAL_DATA_DIR = directory;
  const server = load("src/lib/cms/server.ts"), publishing = load("src/lib/cms/publishing.ts"), validation = load("src/lib/cms/validation.ts"), session = load("src/app/api/cms/session/route.ts"), publishingRoute = load("src/app/api/cms/publishing/route.ts"), backupRoute = load("src/app/api/cms/backup/route.ts");
  assert.equal((await publishingRoute.GET(request("/publishing"))).status, 401);
  assert.equal((await backupRoute.GET(request("/backup"))).status, 401);
  await assert.rejects(server.getCmsPreviewContent(request("/preview")), (error) => error.code === "UNAUTHENTICATED");
  const login = await session.POST(request("/session", "POST", { action: "login" })); assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  pass("draft previews, change reviews and complete backups require an authenticated session");

  let state = await server.getCmsState(); const original = clone(state), id = state.draft.articles[0].id, slug = state.draft.articles[0].slug;
  assert.ok(id); let draft = clone(state.draft);
  draft.articles[0].slug = "selection-guide-revised"; draft.articles[0].content.en.title = "A reviewed selection guide"; draft.products[0].price = 520; draft.products[0].pricing.THB[0].total = 520;
  state = await server.updateCmsContent(state.revision, draft, "save");
  assert.equal(state.draft.articles[0].id, id); assert.ok(state.draft.articles[0].previousSlugs.includes(slug)); assert.equal(state.trash.length, 0);
  assert.equal((await server.getCmsPreviewContent(request("/preview", "GET", undefined, cookie))).articles[0].slug, "selection-guide-revised");
  const review = await (await publishingRoute.GET(request("/publishing", "GET", undefined, cookie))).json();
  assert.ok(review.changes.some((item) => item.kind === "article" && item.fields.includes("slug")));
  assert.ok(review.changes.some((item) => item.kind === "product" && item.fields.includes("price")));
  const publicationRevision = state.revision;
  const response = await publishingRoute.POST(request("/publishing", "POST", { action: "publish", revision: publicationRevision, selection: [{ kind: "article", key: id }] }, cookie)); assert.equal(response.status, 200); state = (await response.json()).state;
  assert.equal(state.published.products[0].price, 380); assert.equal(state.draft.products[0].price, 520);
  assert.equal(publishing.articleForRoute(state.published, slug).article.slug, "selection-guide-revised"); assert.equal(publishing.articleForRoute(state.published, slug).redirect, true);
  assert.equal((await server.publishCmsSelection(publicationRevision, [{ kind: "article", key: id }])).revision, state.revision);
  await assert.rejects(server.publishCmsSelection(publicationRevision, [{ kind: "product", key: state.draft.products[0].id }]), (error) => error.code === "REVISION_CONFLICT");
  pass("stable IDs preserve renamed routes; selected publication leaves unrelated drafts untouched and retries are idempotent");

  draft = clone(state.draft); draft.articles[0].slug = "selection-guide-final";
  state = await server.updateCmsContent(state.revision, draft, "save"); state = await server.publishCmsSelection(state.revision, [{ kind: "article", key: id }]);
  assert.deepEqual(new Set(state.published.articles[0].previousSlugs), new Set([slug, "selection-guide-revised"]));
  for (const old of [slug, "selection-guide-revised"]) assert.equal(publishing.articleForRoute(state.published, old).article.slug, "selection-guide-final");
  draft = clone(state.draft); draft.articles.push({ ...clone(draft.articles[0]), id: randomUUID(), slug, previousSlugs: [] });
  await assert.rejects(server.updateCmsContent(state.revision, draft, "save"), /unique|belongs/);
  pass("multiple renames redirect directly to the latest route and earlier routes cannot be stolen");

  draft = clone(state.draft); draft.articles[0].reviewRequired = true; draft.articles[0].editorialNotes = "Private supplier evidence request";
  state = await server.updateCmsContent(state.revision, draft, "save");
  await assert.rejects(server.publishCmsSelection(state.revision, [{ kind: "article", key: id }]), (error) => error.code === "EDITORIAL_REVIEW_REQUIRED");
  await assert.rejects(server.updateCmsContent(state.revision, draft, "publish"), (error) => error.code === "EDITORIAL_REVIEW_REQUIRED");
  assert.equal(publishing.publicArticle(state.draft.articles[0]).editorialNotes, undefined);
  draft.articles[0].reviewRequired = false; state = await server.updateCmsContent(state.revision, draft, "save");
  pass("facts requiring review block both publication paths and editorial notes are stripped from public articles");

  const history = await server.getCmsPublishingReview(); assert.ok(history.history.length >= 4);
  const first = history.history.find((entry) => entry.revision === 0); assert.ok(first);
  const compared = await server.getCmsPublishingReview(first.id); assert.ok(compared.changes.some((item) => item.kind === "product"));
  assert.equal(compared.entry.draft.products[0].price, original.draft.products[0].price, "Authenticated history comparisons include the snapshot used for localized record titles");
  const publishedBefore = clone(state.published), restoreRevision = state.revision;
  state = await server.restoreCmsHistory(restoreRevision, first.id);
  assert.equal(state.draft.products[0].price, original.draft.products[0].price); assert.deepEqual(state.published, publishedBefore);
  assert.equal(state.draft.articles[0].id, id); assert.ok(state.draft.articles[0].previousSlugs.includes("selection-guide-final"));
  assert.equal((await server.restoreCmsHistory(restoreRevision, first.id)).revision, state.revision);
  pass("revision comparison and recovery restore drafts while preserving published content and route history");

  const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY4sAAAAASUVORK5CYII=", "base64");
  const owner = createHash("sha256").update("publishing-test-owner").digest("hex"), submission = randomUUID();
  const staged = await server.stageCmsMedia(owner, submission, bytes, "image/png", "selection-label.png");
  const committed = await server.commitCmsMedia(owner, submission, state.revision, [{ id: staged.upload.id, alt: { th: "ฉลากสินค้าสำหรับทดสอบ", en: "Product label test" } }]); state = committed.state;
  draft = clone(state.draft); draft.products[0].gallery = [{ id: "back-label", src: staged.upload.src, alt: { en: "Back label", ar: "الملصق الخلفي", th: "ฉลากด้านหลัง" } }];
  draft.articles[0].content.en.sections[0].image = { src: staged.upload.src, alt: "Selection evidence label", caption: "A label to review" };
  draft.articles[0].content.en.sections[0].bullets = ["Check the label", "Compare the quantity"];
  draft.articles[0].content.en.sections[0].table = { headers: ["Check", "Details"], rows: [["Label", "Read before ordering"]] };
  state = await server.updateCmsContent(state.revision, draft, "save");
  await assert.rejects(server.deleteCmsMedia(state.revision, staged.upload.id), (error) => error.code === "MEDIA_REFERENCED");
  const invalid = clone(draft); invalid.articles[0].content.en.sections[0].links = [{ label: "Unsafe", href: "javascript:alert(1)" }]; assert.throws(() => validation.validateCmsContent(invalid));
  invalid.articles[0].content.en.sections[0].links = []; invalid.articles[0].content.en.sections[0].table.rows[0].push("Extra column"); assert.throws(() => validation.validateCmsContent(invalid));
  pass("gallery and inline article media remain protected; rich sections validate links and table structure");

  const backup = await server.createCmsBackup(); assert.equal(backup.files.length, 1); assert.ok(backup.uploads.submissions.some((entry) => entry.id === submission)); assert.ok(backup.history.length);
  const inspected = await server.inspectCmsBackup(backup); assert.equal(inspected.images, 1); assert.equal(inspected.restoreMode, "draft");
  const tampered = clone(backup); tampered.files[0].base64 = Buffer.from("tampered").toString("base64"); await assert.rejects(server.inspectCmsBackup(tampered));
  const missing = clone(backup); missing.files = []; await assert.rejects(server.inspectCmsBackup(missing), (error) => error.code === "BACKUP_INCOMPLETE");
  const traversal = clone(backup); traversal.files[0].filename = "../state.json"; await assert.rejects(server.inspectCmsBackup(traversal));
  const incorrectDimensions = clone(backup); incorrectDimensions.state.draft.media[0].width += 1; await assert.rejects(server.inspectCmsBackup(incorrectDimensions), (error) => error.code === "BACKUP_INVALID");
  pass("complete backups include uploaded bytes, upload tracking and revisions; corrupted or incomplete archives are rejected");

  process.env.CMS_LOCAL_DATA_DIR = recovery;
  let recovered = await server.getCmsState(); const freshPublished = clone(recovered.published);
  const recoveryPlan = await server.inspectCmsBackup(backup);
  await assert.rejects(server.restoreCmsBackup(recovered.revision, "changed", backup), (error) => error.code === "BACKUP_PLAN_CHANGED");
  recovered = await server.restoreCmsBackup(recovered.revision, recoveryPlan.planHash, backup);
  assert.equal(recovered.draft.products[0].gallery[0].src, staged.upload.src); assert.deepEqual(recovered.published, freshPublished);
  const savedBytes = fs.readFileSync(path.join(recovery, "media", backup.files[0].filename)); assert.deepEqual(savedBytes, bytes);
  assert.ok((await server.getCmsPublishingReview()).history.length);
  assert.equal((await server.restoreCmsBackup(recoveryPlan.revision, recoveryPlan.planHash, backup)).revision, recovered.revision);
  assert.ok((await server.cleanupCmsMedia()).retainedIds.includes(staged.upload.id));
  pass("a fresh CMS restores actual image bytes and editable content without changing live content; retries and cleanup remain safe");
  console.log(`PASS: ${checks} publishing and recovery checks. Isolated temporary storage only.`);
} finally {
  for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  for (const target of [directory, recovery]) { assert.ok(target.startsWith(`${output}${path.sep}`)); fs.rmSync(target, { recursive: true, force: true }); }
}

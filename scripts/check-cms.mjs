import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);
const filePromises = nativeRequire("node:fs/promises");
const cache = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const moduleRecord = { exports: {} }; cache.set(filename, moduleRecord);
  const localRequire = (name) => {
    if (name === "next/cache") return { revalidatePath() {} };
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
    if (name.startsWith(".")) return load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`)));
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled)(localRequire, moduleRecord, moduleRecord.exports);
  return moduleRecord.exports;
}
const output = path.join(root, "output"); fs.mkdirSync(output, { recursive: true });
const directory = fs.mkdtempSync(path.join(output, "cms-check-"));
assert.ok(directory.startsWith(`${output}${path.sep}`));
const old = { demo: process.env.NEXT_PUBLIC_DEMO_MODE, vercel: process.env.VERCEL, data: process.env.CMS_LOCAL_DATA_DIR };
const restore = (key, value) => { if (value === undefined) delete process.env[key]; else process.env[key] = value; };
let checks = 0;
function pass(name) { checks++; console.log(`PASS: ${name}`); }
function clone(value) { return structuredClone(value); }
function setBasePrice(product, amount) { product.price = amount; if (product.pricing) product.pricing.THB[0].total = amount; }
function request(endpoint, method = "GET", body, cookie, headers = {}) {
  return new Request(`http://127.0.0.1:3100/api/cms${endpoint}`, { method, headers: { ...(body ? { "content-type": "application/json" } : {}), ...(method !== "GET" ? { origin: "http://127.0.0.1:3100" } : {}), ...(cookie ? { cookie } : {}), ...headers }, ...(body ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}) });
}
async function main() {
  process.env.NEXT_PUBLIC_DEMO_MODE = "true"; delete process.env.VERCEL; process.env.CMS_LOCAL_DATA_DIR = directory;
  const defaults = load("src/lib/cms/defaults.ts"), validation = load("src/lib/cms/validation.ts"), auth = load("src/lib/cms/auth.ts"), server = load("src/lib/cms/server.ts");
  const cms = load("src/app/api/cms/route.ts"), session = load("src/app/api/cms/session/route.ts"), mediaRoute = load("src/app/api/cms/media/route.ts"), cleanupRoute = load("src/app/api/cms/media/cleanup/route.ts"), exportRoute = load("src/app/api/cms/export/route.ts"), trashRoute = load("src/app/api/cms/trash/route.ts"), privateMediaRoute = load("src/app/api/cms/trash-media/[filename]/route.ts");
  const content = defaults.defaultContent();
  const { publicContent } = load("src/lib/cms/public-content.ts");
  const mixedContent = clone(content);
  for (const status of ["draft", "archived"]) {
    mixedContent.articles.push({ ...clone(content.articles[0]), slug: `private-${status}`, status });
    mixedContent.products.push({ ...clone(content.products[0]), id: `private-${status}`, slug: `private-${status}`, status });
  }
  mixedContent.slides.push({ ...clone(content.slides[0]), key: "private-slide", enabled: false });
  mixedContent.media.push({ id: "private-library-entry", name: "Private media filename" });
  const beforeProjection = clone(mixedContent);
  const storefront = publicContent(mixedContent);
  assert.deepEqual(storefront.products, content.products);
  assert.deepEqual(Object.keys(storefront).sort(), ["copy", "products", "settings"]);
  assert.deepEqual(storefront.copy, content.copy);
  assert.deepEqual(storefront.settings, content.settings);
  assert.deepEqual(mixedContent, beforeProjection, "Projecting storefront data must preserve the complete CMS snapshot");
  pass("public projection contains only published products, copy and settings without mutating CMS data");
  assert.deepEqual(validation.validateCmsContent(content), content);
  assert.deepEqual(validation.validateCmsState(defaults.defaultState()), defaults.defaultState());
  const legacy = defaults.defaultState(); delete legacy.trash; assert.deepEqual(validation.validateCmsState(legacy).trash, []);
  for (const mutate of [
    (c) => { c.products[0].price = Infinity; }, (c) => { c.products[0].price = -1; }, (c) => { c.products[0].price = 1.234; },
    (c) => { c.products[0].pricing.USD = []; }, (c) => { c.products[0].pricing.THB[1].quantity = 1; },
    (c) => { c.products[0].pricing.USD[0].total = 0; }, (c) => { c.products[0].pricing.THB[1].total = 1000; },
    (c) => { c.products[0].slug = "different-honey"; }, (c) => { c.products = []; }, (c) => { c.products[0].stock = 1.5; },
    (c) => { c.products[0].weight = 0; }, (c) => { c.products[0].name.th = ""; }, (c) => { c.products.push(clone(c.products[0])); },
    (c) => { c.products[0].image = "https://evil.example/file.png"; }, (c) => { c.products[0].image = "/images/../private.png"; },
    (c) => { c.slides[0].path = "javascript:alert(1)"; }, (c) => { c.slides[0].path = "//evil.example"; }, (c) => { c.slides[0].path = "/\\evil.example"; },
    (c) => { c.slides[0].enabled = "true"; }, (c) => { c.copy = JSON.parse('{"__proto__":"oops"}'); }, (c) => { c.copy = { "site.en.notReal": "oops" }; },
    (c) => { c.settings.email = "invalid"; }, (c) => { c.articles[0].content.en.sections[0].text = "a".repeat(12001); }, (c) => { c.settings.currency = "USD"; },
  ]) { const changed = clone(content); mutate(changed); assert.throws(() => validation.validateCmsContent(changed), validation.CmsError); }
  const legacyPrice = clone(defaults.defaultState());
  for (const snapshot of [legacyPrice.draft, legacyPrice.published]) { snapshot.products[0].price = 480; delete snapshot.products[0].pricing; }
  const originalLegacy = clone(legacyPrice);
  const upgradedPrice = validation.validateCmsState(legacyPrice);
  assert.equal(upgradedPrice.draft.products[0].price, 380); assert.equal(upgradedPrice.published.products[0].price, 380);
  assert.deepEqual(upgradedPrice.draft.products[0].pricing, content.products[0].pricing);
  assert.deepEqual(legacyPrice, originalLegacy, "Price migration must not mutate saved snapshots");
  assert.equal(validation.validLink("https://example.com/path"), "https://example.com/path");
  assert.equal(validation.validImageSource("https://res.cloudinary.com/example/image/upload/photo.webp"), "https://res.cloudinary.com/example/image/upload/photo.webp");
  pass("deep content validation, localized required fields, identity, uniqueness, prices, URLs and copy allowlist");

  const token = auth.issueSessionToken("test-key", 1000);
  assert.equal(auth.verifySessionToken(token, "test-key", 1000), true);
  assert.equal(auth.verifySessionToken(token, "different-key", 1000), false);
  assert.equal(auth.verifySessionToken(`${token}x`, "test-key", 1000), false);
  assert.equal(auth.verifySessionToken(token, "test-key", 30_000_000), false);
  assert.equal((await cms.GET(request(""))).status, 401);
  assert.equal((await session.POST(request("/session", "POST", { action: "login" }, undefined, { origin: "https://evil.example" }))).status, 403);
  assert.equal((await session.POST(request("/session", "POST", { action: "login" }, undefined, { origin: "" }))).status, 403);
  const login = await session.POST(request("/session", "POST", { action: "login" })); assert.equal(login.status, 200);
  const normalizedUrl = new Request("http://localhost:3100/api/cms/session", { method: "POST", headers: { host: "127.0.0.1:3100", origin: "http://127.0.0.1:3100", "content-type": "application/json", "x-forwarded-host": "untrusted.example" }, body: '{"action":"login"}' });
  assert.equal((await session.POST(normalizedUrl)).status, 200, "Next's internal localhost URL must respect the actual local Host header");
  const rebound = new Request("http://localhost:3100/api/cms/session", { method: "POST", headers: { host: "untrusted.example:3100", origin: "http://untrusted.example:3100", "content-type": "application/json" }, body: '{"action":"login"}' });
  assert.equal((await session.POST(rebound)).status, 503, "A nonlocal Host must not gain local access through an internal localhost URL");
  const setCookie = login.headers.get("set-cookie"); assert.match(setCookie, /HttpOnly/); assert.match(setCookie, /SameSite=Strict/);
  const cookie = setCookie.split(";")[0];
  assert.equal((await session.GET(request("/session", "GET", undefined, cookie))).status, 200);
  assert.equal((await (await session.GET(request("/session", "GET", undefined, cookie))).json()).authenticated, true);
  assert.equal((await cms.PUT(request("", "PUT", { revision: 0, content, action: "save" }, cookie, { origin: "https://evil.example" }))).status, 403);
  assert.equal((await cms.PUT(request("", "PUT", { revision: 0, content, action: "save" }, `${cookie}x`))).status, 401);
  assert.equal((await cms.PUT(request("", "PUT", " ".repeat(2 * 1024 * 1024 + 1), cookie))).status, 413);
  assert.equal((await cms.PUT(request("", "PUT", "{broken", cookie))).status, 400);
  pass("signed expiring sessions, same-origin write authorization, tamper rejection and bounded JSON bodies");

  const changed = clone(content); setBasePrice(changed.products[0], 550);
  let response = await cms.PUT(request("", "PUT", { revision: 0, content: changed, action: "save" }, cookie)); assert.equal(response.status, 200);
  let state = (await response.json()).state; assert.equal(state.revision, 1); assert.equal(state.draft.products[0].price, 550); assert.equal(state.published.products[0].price, 380);
  response = await cms.PUT(request("", "PUT", { revision: 0, content: changed, action: "save" }, cookie)); assert.equal(response.status, 200); assert.equal((await response.json()).state.revision, 1);
  assert.equal((await cms.PUT(request("", "PUT", { revision: 0, content: changed, action: "publish" }, cookie))).status, 409);
  const next = clone(changed); setBasePrice(next.products[0], 600);
  const races = await Promise.all(Array.from({ length: 5 }, (_, index) => { const c = clone(next); c.settings.storeName = `Store ${index}`; return cms.PUT(request("", "PUT", { revision: 1, content: c, action: "publish" }, cookie)); }));
  assert.equal(races.filter((res) => res.status === 200).length, 1, JSON.stringify(await Promise.all(races.map((response) => response.clone().json())))); assert.equal(races.filter((res) => res.status === 409).length, 4);
  state = await server.getCmsState(); assert.equal(state.revision, 2); assert.equal(state.published.products[0].price, 600); assert.equal((await server.getPublishedContent()).products[0].price, 600);
  const committed = clone(state), invalid = clone(state.draft); invalid.products[0].image = "/images/does-not-exist.png";
  assert.equal((await cms.PUT(request("", "PUT", { revision: 2, content: invalid, action: "publish" }, cookie))).status, 400);
  assert.deepEqual(await server.getCmsState(), committed);
  const draft = clone(state.draft); setBasePrice(draft.products[0], 650);
  const originalStateRename = filePromises.rename;
  try {
    filePromises.rename = async (source, destination) => { await originalStateRename(source, destination); if (destination === path.join(directory, "state.json")) throw new Error("Simulated uncertain content commit"); };
    await assert.rejects(server.updateCmsContent(2, draft, "save"), /uncertain content commit/);
    assert.equal((await server.getCmsState()).revision, 3);
  } finally { filePromises.rename = originalStateRename; }
  state = await server.updateCmsContent(2, draft, "save"); assert.equal(state.revision, 3, "Uncertain committed save is confirmed without a second revision");
  state = await server.updateCmsContent(3, null, "restore"); assert.equal(state.draft.products[0].price, 600);
  assert.equal((await server.updateCmsContent(3, null, "restore")).revision, 4);
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory, "state.json"), "utf8")).revision, 4);
  assert.equal(fs.existsSync(path.join(directory, "write.lock")), false); assert.equal(fs.readdirSync(directory).some((file) => file.endsWith(".tmp")), false);
  pass("persistent draft and publish separation, restore, revision conflicts, serialized concurrent saves and safe retries");

  const image = new Uint8Array(fs.readFileSync(path.join(root, "public", "images", "honey-product.png")));
  const details = server.imageDetails(image, "image/png"); assert.ok(details.width > 0 && details.height > 0);
  assert.throws(() => server.imageDetails(image, "image/jpeg")); assert.throws(() => server.imageDetails(new Uint8Array([1, 2, 3]), "image/png"));
  assert.throws(() => server.imageDetails(image.subarray(0, 33), "image/png"));
  assert.throws(() => server.imageDetails(image.subarray(0, image.length - 12), "image/png"));
  const oversized = Buffer.from(image); oversized.writeUInt32BE(20001, 16); assert.throws(() => server.imageDetails(oversized, "image/png"));
  assert.throws(() => server.imageDetails(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'), "image/svg+xml"));
  const unpreparedSource = new Uint8Array(fs.readFileSync(path.join(root, "public", "images", "honey-front.jpg")));
  await assert.rejects(server.stageCmsMedia("a".repeat(64), randomUUID(), unpreparedSource, "image/jpeg", "oversized-source.jpg"), (error) => error.code === "IMAGE_DIMENSIONS");
  const originalRename = filePromises.rename;
  const beforeFailure = await server.getCmsState();
  const owner = "a".repeat(64), otherOwner = "b".repeat(64), alt = { th: "ภาพทดสอบ", en: "Test image" };
  const failedSubmission = randomUUID();
  const failedUpload = (await server.stageCmsMedia(owner, failedSubmission, image, "image/png", "product.png")).upload;
  const privateFilenameFor = (upload) => path.join(directory, "media", path.basename(upload.src));
  assert.deepEqual(await server.getCmsState(), beforeFailure, "Preparation/upload must not save text or media library records");
  assert.equal(await server.readCmsMedia(path.basename(failedUpload.src)), null, "Pending files are not public");
  assert.equal((await server.getCmsMediaSubmission(owner, failedSubmission)).status, "pending");
  await assert.rejects(server.getCmsMediaSubmission(otherOwner, failedSubmission), (error) => error.code === "SUBMISSION_OWNER");
  try {
    filePromises.rename = async (source, destination) => { if (destination === path.join(directory, "state.json")) throw new Error("Simulated state-write failure"); return originalRename(source, destination); };
    await assert.rejects(server.commitCmsMedia(owner, failedSubmission, 4, [{ id: failedUpload.id, alt }]));
    assert.deepEqual(await server.getCmsState(), beforeFailure);
    assert.ok(fs.existsSync(privateFilenameFor(failedUpload)), "A failed database save preserves the successful upload for user-triggered retries");
    assert.equal((await server.getCmsMediaSubmission(owner, failedSubmission)).status, "pending");
  } finally { filePromises.rename = originalRename; }
  const originalUnlink = filePromises.unlink;
  try {
    filePromises.unlink = async (filename) => { if (filename === privateFilenameFor(failedUpload)) throw new Error("Simulated image-deletion failure"); return originalUnlink(filename); };
    const failedCleanup = await server.abandonCmsMediaSubmission(owner, failedSubmission);
    assert.equal(failedCleanup.status, "abandoned"); assert.ok(failedCleanup.failedIds.includes(failedUpload.id));
    assert.ok(fs.existsSync(privateFilenameFor(failedUpload)), "Failed asset deletion stays available to authorized manual cleanup");
  } finally { filePromises.unlink = originalUnlink; }
  const cleaned = await server.cleanupCmsMedia(); assert.ok(cleaned.deletedIds.includes(failedUpload.id));
  assert.equal(fs.existsSync(privateFilenameFor(failedUpload)), false);
  await assert.rejects(server.commitCmsMedia(owner, failedSubmission, 4, [{ id: failedUpload.id, alt }]));
  pass("staged uploads stay private; failed saves preserve them, ownership rejects other sessions, and failed rollback remains recoverable through manual cleanup");

  const sharedA = randomUUID(), sharedB = randomUUID();
  const sharedUpload = (await server.stageCmsMedia(owner, sharedA, image, "image/png", "shared.png")).upload;
  await server.stageCmsMedia(otherOwner, sharedB, image, "image/png", "shared.png");
  const abandonedA = await server.abandonCmsMediaSubmission(owner, sharedA);
  assert.ok(abandonedA.retainedIds.includes(sharedUpload.id)); assert.ok(fs.existsSync(privateFilenameFor(sharedUpload)), "Another pending submission protects shared bytes");
  assert.equal((await server.getCmsMediaSubmission(otherOwner, sharedB)).uploads.length, 1);
  await server.cleanupCmsMedia(); assert.ok(fs.existsSync(privateFilenameFor(sharedUpload)), "Manual cleanup cannot remove an in-flight submission's media");
  await server.abandonCmsMediaSubmission(otherOwner, sharedB); await server.cleanupCmsMedia();
  assert.equal(fs.existsSync(privateFilenameFor(sharedUpload)), false, "Unreferenced abandoned submissions can be cleaned after both owners finish");
  pass("SHA deduplication protects another active submission and manual cleanup does not race its pending save");

  const uncertainSubmission = randomUUID();
  const uncertainUpload = (await server.stageCmsMedia(owner, uncertainSubmission, image, "image/png", "uncertain.png")).upload;
  const savedSnapshot = fs.readFileSync(path.join(directory, "state.json"), "utf8");
  try {
    fs.writeFileSync(path.join(directory, "state.json"), "{broken save outcome");
    await assert.rejects(server.abandonCmsMediaSubmission(owner, uncertainSubmission), (error) => error.code === "CMS_STORAGE_INVALID");
    await assert.rejects(server.cleanupCmsMedia(), (error) => error.code === "CMS_STORAGE_INVALID");
    assert.ok(fs.existsSync(privateFilenameFor(uncertainUpload)), "Uncertain state readback cannot authorize deletion");
    assert.equal(fs.readFileSync(path.join(directory, "state.json"), "utf8"), "{broken save outcome");
  } finally { fs.writeFileSync(path.join(directory, "state.json"), savedSnapshot); }
  await server.abandonCmsMediaSubmission(owner, uncertainSubmission);
  assert.equal(fs.existsSync(privateFilenameFor(uncertainUpload)), false);
  pass("uncertain database outcomes block automatic and manual deletion until saved references can be verified");

  const submissionId = randomUUID();
  const staged = (await server.stageCmsMedia(owner, submissionId, image, "image/png", "x".repeat(200))).upload;
  assert.equal((await server.stageCmsMedia(owner, submissionId, image, "image/png", "product.png")).upload.id, staged.id);
  let uploaded;
  try {
    filePromises.rename = async (source, destination) => { await originalRename(source, destination); if (destination === path.join(directory, "state.json")) throw new Error("Simulated uncertainty after committed rename"); };
    const result = await server.commitCmsMedia(owner, submissionId, 4, [{ id: staged.id, alt }]);
    uploaded = { state: result.state, media: result.media[0] };
  } finally { filePromises.rename = originalRename; }
  assert.equal(uploaded.state.revision, 5); assert.equal(uploaded.media.width, details.width); assert.equal(uploaded.state.draft.media.length, 1);
  assert.ok(uploaded.state.audit[0].action.length <= 100); assert.equal((await server.getCmsState()).revision, 5, "Long valid filenames must never invalidate saved activity");
  const retry = await server.commitCmsMedia(owner, submissionId, 4, [{ id: staged.id, alt }]); assert.equal(retry.state.revision, 5); assert.equal(retry.media[0].id, uploaded.media.id);
  await assert.rejects(server.commitCmsMedia(owner, submissionId, 4, [{ id: staged.id, alt: { ...alt, en: "Altered after completion" } }]), (error) => error.code === "SUBMISSION_COMMITTED");
  await assert.rejects(server.commitCmsMedia(owner, submissionId, 4, [{ id: "f".repeat(64), alt }]), (error) => error.code === "MEDIA_BATCH_INCOMPLETE");
  const resolved = await server.getCmsMediaSubmission(owner, submissionId); assert.equal(resolved.status, "committed"); assert.equal(resolved.state.revision, 5);
  assert.equal((await server.abandonCmsMediaSubmission(owner, submissionId)).status, "committed", "Cleanup first resolves uncertain saves and preserves committed assets");
  fs.unlinkSync(path.join(directory, "media", path.basename(uploaded.media.src)));
  const repairSubmission = randomUUID(); await server.stageCmsMedia(owner, repairSubmission, image, "image/png", "product.png");
  const repaired = await server.commitCmsMedia(owner, repairSubmission, 5, [{ id: staged.id, alt }]);
  assert.equal(repaired.state.revision, 5); assert.ok(await server.readCmsMedia(path.basename(uploaded.media.src)), "Identical upload repairs a missing private image without duplicating its record");
  assert.equal((await server.readCmsMedia(path.basename(uploaded.media.src))).published, false, "Saved draft images are not indexable publications"); assert.equal(await server.readCmsMedia("../../session-secret"), null);
  const withImage = clone(uploaded.state.draft); withImage.products[0].image = uploaded.media.src;
  state = await server.updateCmsContent(5, withImage, "publish");
  assert.equal((await server.readCmsMedia(path.basename(uploaded.media.src))).published, true, "Images referenced by a published product are indexable");
  await assert.rejects(server.deleteCmsMedia(6, uploaded.media.id), (error) => error.code === "MEDIA_REFERENCED");
  withImage.products[0].image = "/images/honey-product.png"; state = await server.updateCmsContent(6, withImage, "save");
  await assert.rejects(server.deleteCmsMedia(7, uploaded.media.id), (error) => error.code === "MEDIA_REFERENCED");
  state = await server.updateCmsContent(7, withImage, "publish");
  assert.equal((await server.readCmsMedia(path.basename(uploaded.media.src))).published, false, "An unreferenced library image is not a public publication");
  state = await server.deleteCmsMedia(8, uploaded.media.id);
  assert.equal(state.draft.media.length, 0); assert.equal(state.published.media.length, 0); assert.equal(await server.readCmsMedia(path.basename(uploaded.media.src)), null);
  const firstMediaTrash = state.trash.find((entry) => entry.kind === "media" && entry.item.id === uploaded.media.id);
  assert.ok(firstMediaTrash); assert.equal(Date.parse(firstMediaTrash.expiresAt) - Date.parse(firstMediaTrash.deletedAt), validation.CMS_TRASH_TTL_MS);
  assert.ok(fs.existsSync(path.join(directory, "media", path.basename(uploaded.media.src))));
  const privateParams = { params: Promise.resolve({ filename: path.basename(uploaded.media.src) }) };
  assert.equal((await privateMediaRoute.GET(request(`/trash-media/${path.basename(uploaded.media.src)}`), privateParams)).status, 401);
  const privateImage = await privateMediaRoute.GET(request(`/trash-media/${path.basename(uploaded.media.src)}`, "GET", undefined, cookie), privateParams); assert.equal(privateImage.status, 200); assert.equal(privateImage.headers.get("cache-control"), "private, no-store");
  assert.equal((await server.deleteCmsMedia(8, uploaded.media.id)).revision, 9);
  pass("verified image containers and dimensions, uncertain save readback, idempotent staged/commit retries, missing-file repair and reference-safe removal");

  await assert.rejects(server.stageCmsMedia(owner, randomUUID(), image, "image/png", "product.png"), (error) => error.code === "MEDIA_IN_TRASH");
  await server.cleanupCmsMedia(); assert.ok(fs.existsSync(privateFilenameFor(staged)), "Manual cleanup must preserve unexpired Trash media");
  const restoredMedia = await trashRoute.POST(request("/trash", "POST", { action: "restore", revision: 9, id: firstMediaTrash.id }, cookie)); assert.equal(restoredMedia.status, 200); state = (await restoredMedia.json()).state;
  assert.equal(state.revision, 10); assert.equal(state.published.media.length, 0); assert.ok(await server.readCmsMedia(path.basename(uploaded.media.src)));
  assert.equal((await server.restoreCmsTrashItem(9, firstMediaTrash.id)).revision, 10);
  const routeSubmission = randomUUID();
  const form = new FormData(); form.set("submissionId", routeSubmission); form.set("file", new Blob([image], { type: "image/png" }), "product.png");
  response = await mediaRoute.POST(new Request("http://127.0.0.1:3100/api/cms/media", { method: "POST", headers: { origin: "http://127.0.0.1:3100", cookie }, body: form }));
  assert.equal(response.status, 200); const routeUpload = (await response.json()).upload; assert.equal((await server.getCmsState()).revision, 10);
  response = await mediaRoute.PUT(request("/media", "PUT", { submissionId: routeSubmission, revision: 10, uploads: [{ id: routeUpload.id, alt }] }, cookie));
  assert.equal(response.status, 200); state = (await response.json()).state; assert.equal(state.revision, 10);
  assert.equal((await cleanupRoute.POST(request("/media/cleanup", "POST", {}))).status, 401);
  assert.equal((await cleanupRoute.POST(request("/media/cleanup", "POST", {}, cookie, { origin: "https://foreign.example" }))).status, 403);
  const exported = await exportRoute.GET(request("/export", "GET", undefined, cookie)); assert.equal(exported.status, 200); assert.match(exported.headers.get("content-disposition"), /attachment/); assert.deepEqual(await exported.json(), state);
  assert.equal((await exportRoute.GET(request("/export"))).status, 401);
  pass("authenticated multipart upload and complete snapshot export");

  const originalNow = Date.now;
  let testNow = originalNow(); Date.now = () => testNow;
  try {
    const newProduct = { ...clone(state.draft.products[0]), id: "trash-test-product", slug: "trash-test-product", category: "coffee", price: 250, image: uploaded.media.src, status: "draft" };
    let draft = clone(state.draft); draft.products.push(newProduct); state = await server.updateCmsContent(state.revision, draft, "save");
    draft = clone(state.draft); draft.products[1].name.en = "Edited before deleting"; draft.copy["site.en.announcement"] = "Other edits remain saved"; draft.copy["site.ar.announcement"] = "تبقى التعديلات الأخرى محفوظة";
    const moveRevision = state.revision;
    const move = await trashRoute.POST(request("/trash", "POST", { action: "move", revision: moveRevision, kind: "product", key: newProduct.id, content: draft }, cookie));
    assert.equal(move.status, 200); state = (await move.json()).state;
    const productTrash = state.trash.find((entry) => entry.kind === "product" && entry.item.id === newProduct.id);
    assert.equal(productTrash.item.name.en, "Edited before deleting"); assert.equal(productTrash.position, 1); assert.equal(state.draft.copy["site.en.announcement"], "Other edits remain saved");
    assert.equal((await server.moveCmsItemToTrash(moveRevision, "product", newProduct.id, draft)).revision, state.revision);
    await assert.rejects(server.deleteCmsMedia(state.revision, uploaded.media.id), (error) => error.code === "MEDIA_REFERENCED");
    const conflict = { ...clone(newProduct), id: "conflicting-product" };
    draft = clone(state.draft); draft.products.push(conflict);
    const beforeConflict = clone(state);
    await assert.rejects(server.updateCmsContent(state.revision, draft, "save"), (error) => error.code === "ROUTE_RESERVED"); assert.deepEqual(await server.getCmsState(), beforeConflict, "A trashed route remains reserved for its original identity");
    const restoreRevision = state.revision; state = await server.restoreCmsTrashItem(restoreRevision, productTrash.id);
    assert.equal(state.draft.products[1].name.en, "Edited before deleting"); assert.equal(state.published.products.length, 1); assert.equal((await server.restoreCmsTrashItem(restoreRevision, productTrash.id)).revision, state.revision);
    await assert.rejects(server.moveCmsItemToTrash(state.revision, "product", "coffee-blossom-honey", state.draft), (error) => error.code === "HONEY_PROTECTED");
    draft = clone(state.draft); draft.articles[0].content.en.sections[0].text = "Edited article section before deleting.";
    state = await server.moveCmsItemToTrash(state.revision, "article", draft.articles[0].slug, draft);
    const articleTrash = state.trash.find((entry) => entry.kind === "article"); assert.equal(articleTrash.position, 0);
    state = await server.restoreCmsTrashItem(state.revision, articleTrash.id); assert.equal(state.draft.articles[0].content.en.sections[0].text, "Edited article section before deleting.");
    draft = clone(state.draft); const deletedSlide = draft.slides.shift(); state = await server.updateCmsContent(state.revision, draft, "save");
    const slideTrash = state.trash.find((entry) => entry.kind === "slide" && entry.item.key === deletedSlide.key);
    state = await server.updateCmsContent(state.revision, draft, "publish");
    assert.equal(state.trash.filter((entry) => entry.kind === "slide" && entry.item.key === deletedSlide.key).length, 1, "Publishing a previously removed record must not duplicate its trash snapshot");
    draft = clone(state.draft); draft.slides.push({ ...clone(deletedSlide), key: "temporary-slide" }); state = await server.updateCmsContent(state.revision, draft, "save");
    state = await server.updateCmsContent(state.revision, null, "restore"); assert.ok(state.trash.some((entry) => entry.kind === "slide" && entry.item.key === "temporary-slide"), "Restore published cannot permanently bypass trash for removed draft items");
    const invalidExpiry = clone(state); invalidExpiry.trash[0].expiresAt = new Date(Date.parse(invalidExpiry.trash[0].deletedAt) + validation.CMS_TRASH_TTL_MS - 1).toISOString(); assert.throws(() => validation.validateCmsState(invalidExpiry));
    pass("edited payload and other draft edits survive soft delete, original positions restore, identity conflicts reject, protected honey remains and imports/publish/restore retain removed records");

    testNow = Date.parse(slideTrash.expiresAt) - 1; state = await server.getCmsState(); assert.ok(state.trash.some((entry) => entry.id === slideTrash.id));
    state = await server.restoreCmsTrashItem(state.revision, slideTrash.id); assert.equal(state.draft.slides[0].key, deletedSlide.key, "Restore is allowed one millisecond before 30 days");
    testNow += 1; state = await server.getCmsState(); assert.equal(state.trash.length, 0, "Entries expire exactly at their 30-day deadline");
    draft = clone(state.draft); draft.products.find((item) => item.id === newProduct.id).image = "/images/honey-product.png"; state = await server.updateCmsContent(state.revision, draft, "publish");
    state = await server.deleteCmsMedia(state.revision, uploaded.media.id);
    const mediaTrash = state.trash.find((entry) => entry.kind === "media" && entry.item.id === uploaded.media.id), filename = path.basename(uploaded.media.src), privateFilename = path.join(directory, "media", filename);
    assert.ok(fs.existsSync(privateFilename)); assert.ok(await server.readTrashedCmsMedia(filename)); assert.equal(await server.readCmsMedia(filename), null);
    testNow = Date.parse(mediaTrash.expiresAt) - 1; state = await server.getCmsState(); assert.ok(fs.existsSync(privateFilename)); assert.ok(state.trash.some((entry) => entry.id === mediaTrash.id));
    const beforeExpiryRace = clone(state), originalStat = filePromises.stat; let mediaChecks = 0;
    try {
      filePromises.stat = async (...args) => { const result = await originalStat(...args); if (args[0] === privateFilename && ++mediaChecks >= 1) testNow = Date.parse(mediaTrash.expiresAt); return result; };
      await assert.rejects(server.restoreCmsTrashItem(state.revision, mediaTrash.id), (error) => error.code === "TRASH_EXPIRED");
      assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, "state.json"), "utf8")), beforeExpiryRace, "A deadline crossed during asynchronous image checks cannot commit a restoration");
    } finally { filePromises.stat = originalStat; testNow = Date.parse(mediaTrash.expiresAt) - 1; }
    const leftoverBytes = fs.readFileSync(path.join(root, "public", "images", "honey-front.jpg"));
    const leftoverId = createHash("sha256").update(leftoverBytes).digest("hex"), leftoverFilename = path.join(directory, "media", `${leftoverId}.jpg`);
    fs.writeFileSync(leftoverFilename, leftoverBytes); fs.utimesSync(leftoverFilename, new Date(0), new Date(0));
    testNow += 1; state = await server.getCmsState(); assert.equal(state.trash.length, 0); assert.equal(fs.existsSync(privateFilename), false); assert.equal(await server.readTrashedCmsMedia(filename), null);
    assert.ok(fs.existsSync(leftoverFilename), "Trash expiry must not run a background scan of unrelated leftover uploads");
    const manualOrphanCleanup = await server.cleanupCmsMedia(); assert.ok(manualOrphanCleanup.deletedIds.includes(leftoverId));
    assert.equal(fs.existsSync(leftoverFilename), false, "Only explicit manual cleanup removes verified unreferenced leftover uploads");
    await assert.rejects(server.restoreCmsTrashItem(state.revision, mediaTrash.id), (error) => error.code === "TRASH_NOT_FOUND");
    pass("30-day boundary is authoritative, pre-expiry restoration works, trashed media remains private and its verified unreferenced file is purged only at expiry");

    const protectedState = clone(state); protectedState.draft.media.push(uploaded.media); protectedState.draft.products[0].image = uploaded.media.src; protectedState.trash.push(mediaTrash);
    fs.writeFileSync(privateFilename, image); fs.writeFileSync(path.join(directory, "state.json"), JSON.stringify(protectedState));
    state = await server.getCmsState(); assert.equal(state.trash.length, 0); assert.ok(fs.existsSync(privateFilename), "Expiry must never delete an image still referenced by live content");
    draft = clone(state.draft); draft.products[0].image = "/images/honey-product.png"; state = await server.updateCmsContent(state.revision, draft, "save");
    state = await server.deleteCmsMedia(state.revision, uploaded.media.id); const missingMedia = state.trash.find((entry) => entry.kind === "media"); fs.unlinkSync(privateFilename);
    const beforeMissing = clone(state); await assert.rejects(server.restoreCmsTrashItem(state.revision, missingMedia.id), (error) => error.code === "TRASH_RESTORE_CONFLICT"); assert.deepEqual(await server.getCmsState(), beforeMissing);
    fs.writeFileSync(privateFilename, image); state = await server.restoreCmsTrashItem(state.revision, missingMedia.id);
    const beforeCapacity = clone(state), full = clone(state);
    full.trash = Array.from({ length: validation.CMS_TRASH_LIMIT }, () => ({ id: randomUUID(), deletedAt: new Date(testNow).toISOString(), expiresAt: new Date(testNow + validation.CMS_TRASH_TTL_MS).toISOString(), position: 0, kind: "slide", item: clone(full.draft.slides[0]) }));
    fs.writeFileSync(path.join(directory, "state.json"), JSON.stringify(full));
    await assert.rejects(server.moveCmsItemToTrash(full.revision, "slide", full.draft.slides[0].key, full.draft), (error) => error.code === "TRASH_CAPACITY"); assert.equal((await server.getCmsState()).trash.length, validation.CMS_TRASH_LIMIT);
    fs.writeFileSync(path.join(directory, "state.json"), JSON.stringify(beforeCapacity)); state = await server.getCmsState();
    pass("expiry preserves live references, missing-media restore fails without data loss, and bounded retention refuses overflow instead of discarding unexpired items");
  } finally { Date.now = originalNow; }

  const lateFailureBytes = new Uint8Array(fs.readFileSync(path.join(root, "public", "images", "coffee-beans.webp")));
  const lateFailureSubmission = randomUUID();
  const lateFailureUpload = (await server.stageCmsMedia(owner, lateFailureSubmission, lateFailureBytes, "image/webp", "late-write.webp")).upload;
  const lateFailureRevision = state.revision;
  try {
    filePromises.rename = async (source, destination) => {
      const snapshot = JSON.parse(fs.readFileSync(path.join(directory, "state.json"), "utf8"));
      if (destination === path.join(directory, "uploads.json") && snapshot.draft.media.some((item) => item.id === lateFailureUpload.id)) throw new Error("Simulated upload-tracking failure after database commit");
      return originalRename(source, destination);
    };
    await assert.rejects(server.commitCmsMedia(owner, lateFailureSubmission, lateFailureRevision, [{ id: lateFailureUpload.id, alt }]));
  } finally { filePromises.rename = originalRename; }
  const lateOutcome = await server.getCmsMediaSubmission(owner, lateFailureSubmission);
  assert.equal(lateOutcome.status, "committed"); assert.equal(lateOutcome.state.revision, lateFailureRevision + 1);
  const lateRetry = await server.commitCmsMedia(owner, lateFailureSubmission, lateFailureRevision, [{ id: lateFailureUpload.id, alt }]);
  assert.equal(lateRetry.state.revision, lateFailureRevision + 1); assert.equal(lateRetry.state.draft.media.filter((item) => item.id === lateFailureUpload.id).length, 1);
  await server.abandonCmsMediaSubmission(owner, lateFailureSubmission); await server.cleanupCmsMedia();
  assert.ok(fs.existsSync(privateFilenameFor(lateFailureUpload)), "Tracking failure after an actual save cannot delete committed media");
  const relabelSubmission = randomUUID(), newAlt = { en: "New descriptions, same saved image", ar: "أوصاف جديدة للصورة المحفوظة نفسها", th: "คำอธิบายใหม่" };
  await server.stageCmsMedia(owner, relabelSubmission, lateFailureBytes, "image/webp", "renamed.webp");
  const relabeled = await server.commitCmsMedia(owner, relabelSubmission, lateRetry.state.revision, [{ id: lateFailureUpload.id, alt: newAlt }]);
  assert.equal(relabeled.state.revision, lateRetry.state.revision + 1); assert.deepEqual(relabeled.media[0].alt, newAlt);
  for (const key of ["id", "src", "name", "width", "height", "bytes", "createdAt"]) assert.equal(relabeled.media[0][key], lateRetry.media[0][key], "Changing descriptions preserves existing media identity and facts");
  assert.deepEqual(relabeled.state.published, lateRetry.state.published, "Changing draft descriptions cannot alter the published snapshot");
  pass("a failed final submission-tracking write resolves from the saved marker without duplicate records or destructive cleanup");

  const invalidFile = "{the saved content is broken"; fs.writeFileSync(path.join(directory, "state.json"), invalidFile);
  await assert.rejects(server.getCmsState(), (error) => error.code === "CMS_STORAGE_INVALID");
  await assert.rejects(server.updateCmsContent(0, content, "save"), (error) => error.code === "CMS_STORAGE_INVALID");
  assert.equal(fs.readFileSync(path.join(directory, "state.json"), "utf8"), invalidFile);
  pass("corrupt existing content is reported and preserved without resetting or overwriting it");

  process.env.NEXT_PUBLIC_DEMO_MODE = "false";
  assert.equal(auth.cmsMode(), "unavailable"); assert.equal((await session.POST(request("/session", "POST", { action: "login" }))).status, 503); assert.equal((await cms.PUT(request("", "PUT", { revision: 0, content, action: "save" }, cookie))).status, 503);
  process.env.NEXT_PUBLIC_DEMO_MODE = "true"; process.env.VERCEL = "1"; assert.equal(auth.cmsMode(), "unavailable");
  const publicDefaults = await server.getPublishedContent();
  const sourceDefaults = defaults.defaultContent();
  assert.deepEqual(publicDefaults, { ...sourceDefaults, products: sourceDefaults.products.filter((item) => item.status === "published"), slides: sourceDefaults.slides.filter((item) => item.enabled), articles: sourceDefaults.articles.filter((item) => item.status === "published").map((item) => ({ ...item, id: item.id || item.slug })) });
  assert.ok(publicDefaults.articles.every((item) => !Object.hasOwn(item, "editorialNotes") && !Object.hasOwn(item, "reviewRequired")));
  delete process.env.VERCEL;
  assert.equal((await session.POST(new Request("https://example.com/api/cms/session", { method: "POST", headers: { "content-type": "application/json", origin: "https://example.com" }, body: '{"action":"login"}' }))).status, 503);
  pass("production and nonlocal configuration gates prevent password-free CMS access and writes");
  console.log(`PASS: ${checks} CMS checks. Temporary local files only; no outside services used.`);
}
try { await main(); }
finally { restore("NEXT_PUBLIC_DEMO_MODE", old.demo); restore("VERCEL", old.vercel); restore("CMS_LOCAL_DATA_DIR", old.data); fs.rmSync(directory, { recursive: true, force: true }); }

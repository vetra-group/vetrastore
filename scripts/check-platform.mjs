import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash, randomUUID, scryptSync } from "node:crypto";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);
const cache = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const moduleRecord = { exports: {} }; cache.set(filename, moduleRecord);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const require = (name) => name === "next/cache" ? { revalidatePath() {} } : name.startsWith("@/") ? load(`src/${name.slice(2)}.ts`) : name.startsWith(".") ? load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`))) : nativeRequire(name);
  new Function("require", "module", "exports", compiled)(require, moduleRecord, moduleRecord.exports);
  return moduleRecord.exports;
}
const output = path.join(root, "output"); fs.mkdirSync(output, { recursive: true });
const directory = fs.mkdtempSync(path.join(output, "platform-check-"));
const env = { ...process.env }, realFetch = globalThis.fetch;
let checks = 0;
const pass = (text) => { console.log(`PASS: ${text}`); checks++; };
const request = (cookie, method = "GET") => new Request("http://127.0.0.1:3100/api/cms", { method, headers: { ...(cookie ? { cookie } : {}), ...(method === "GET" ? {} : { origin: "http://127.0.0.1:3100" }) } });
try {
  // Every adapter test is isolated and all external transport is mocked.
  process.env.NEXT_PUBLIC_DEMO_MODE = "true"; process.env.CMS_LOCAL_DATA_DIR = directory;
  delete process.env.VERCEL; delete process.env.MONGODB_URI; delete process.env.CMS_STORAGE;
  process.env.CMS_AUTH_MODE = "password"; process.env.CMS_SESSION_SECRET = "a".repeat(64);
  const salt = "b".repeat(32), password = "Synthetic test password only";
  const hash = `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
  const staff = [{ id: "qa-owner", email: "owner@example.invalid", name: "QA owner", role: "owner", passwordHash: hash, sessionVersion: 1 }, { id: "qa-editor", email: "editor@example.invalid", name: "QA editor", role: "editor", passwordHash: hash, sessionVersion: 1 }];
  process.env.CMS_STAFF_ACCOUNTS = JSON.stringify(staff);
  const auth = load("src/lib/cms/auth.ts"), defaults = load("src/lib/cms/defaults.ts"), cms = load("src/app/api/cms/route.ts");
  assert.equal(auth.cmsMode(), "configured");
  await assert.rejects(auth.sessionCookie(request(), { email: staff[0].email, password: "wrong" }), (error) => error.code === "INVALID_CREDENTIALS");
  const ownerCookie = (await auth.sessionCookie(request(), { email: staff[0].email, password })).split(";")[0];
  const editorCookie = (await auth.sessionCookie(request(), { email: staff[1].email, password })).split(";")[0];
  assert.equal((await auth.cmsIdentity(request(ownerCookie))).role, "owner");
  assert.equal((await auth.cmsIdentity(request(editorCookie))).role, "editor");
  assert.equal(await auth.authenticated(request(`${editorCookie}tampered`)), false);
  await assert.rejects(auth.withCmsIdentity(request(editorCookie, "POST"), true, async () => true, "publish"), (error) => error.code === "FORBIDDEN");
  assert.match(await auth.withCmsIdentity(request(ownerCookie), false, async () => auth.cmsActor()), /QA owner/);
  assert.throws(() => auth.assertCmsOwner(), (error) => error.code === "FORBIDDEN", "Configured server mutations must not infer an owner when request identity is missing");
  pass("password authentication, identity, expiry signatures, actor attribution and owner permissions");
  const mediaApi = load("src/app/api/cms/media/route.ts"), cmsServer = load("src/lib/cms/server.ts"), fixture = fs.readFileSync(path.join(root, "public", "images", "honey-product.png"));
  const submissionId = randomUUID(), form = new FormData(); form.set("submissionId", submissionId); form.set("file", new Blob([fixture], { type: "image/png" }), "ownership-check.png");
  const uploadedResponse = await mediaApi.POST(new Request("http://127.0.0.1:3100/api/cms/media", { method: "POST", headers: { cookie: editorCookie, origin: "http://127.0.0.1:3100" }, body: form }));
  assert.equal(uploadedResponse.status, 200); const uploaded = (await uploadedResponse.json()).upload;
  const mediaRequest = (token, id = submissionId, method = "GET", body) => new Request(`http://127.0.0.1:3100/api/cms/media${method === "GET" ? `?submissionId=${id}` : ""}`, { method, headers: { cookie: token, origin: "http://127.0.0.1:3100", "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  await auth.revokeSession(request(editorCookie)); assert.equal((await mediaApi.GET(mediaRequest(editorCookie))).status, 401);
  staff[1].name = "Renamed editor"; process.env.CMS_STAFF_ACCOUNTS = JSON.stringify(staff);
  const renewedEditor = (await auth.sessionCookie(request(), { email: staff[1].email, password })).split(";")[0];
  const resumed = await mediaApi.GET(mediaRequest(renewedEditor)); assert.equal(resumed.status, 200); assert.equal((await resumed.json()).uploads[0].id, uploaded.id);
  assert.equal((await mediaApi.GET(mediaRequest(ownerCookie))).status, 403, "A different staff identity cannot inspect another member's staged submission");
  assert.equal((await mediaApi.PATCH(mediaRequest(ownerCookie, submissionId, "PATCH", { submissionId }))).status, 403);
  const mediaState = await cmsServer.getCmsState(), mediaSave = { submissionId, revision: mediaState.revision, uploads: [{ id: uploaded.id, alt: { th: "ทดสอบสิทธิ์", en: "Ownership regression" } }] };
  assert.equal((await mediaApi.PUT(mediaRequest(ownerCookie, submissionId, "PUT", mediaSave))).status, 403);
  assert.equal((await mediaApi.PUT(mediaRequest(renewedEditor, submissionId, "PUT", mediaSave))).status, 200);
  assert.equal((await (await mediaApi.GET(mediaRequest(renewedEditor))).json()).status, "committed");
  pass("staged images survive re-login and display-name changes; different staff cannot inspect, commit or abandon them");

  const sessionHash = (token) => createHash("sha256").update(token.slice(token.indexOf("=") + 1)).digest("hex");
  const legacyId = randomUUID(); await cmsServer.stageCmsMedia(sessionHash(renewedEditor), legacyId, fixture, "image/png", "legacy-check.png");
  assert.equal((await mediaApi.GET(mediaRequest(renewedEditor, legacyId))).status, 200, "A still-valid original session can migrate its own legacy receipt");
  await auth.revokeSession(request(renewedEditor));
  const anotherEditor = (await auth.sessionCookie(request(), { email: staff[1].email, password })).split(";")[0];
  assert.equal((await mediaApi.GET(mediaRequest(anotherEditor, legacyId))).status, 200, "Migrated receipts use stable ownership");
  const expiredLegacyId = randomUUID(), legacyHash = sessionHash(editorCookie);
  await cmsServer.stageCmsMedia(legacyHash, expiredLegacyId, fixture, "image/png", "expired-legacy-check.png");
  assert.equal((await mediaApi.GET(mediaRequest(anotherEditor, expiredLegacyId))).status, 403);
  assert.equal((await mediaApi.PATCH(mediaRequest(anotherEditor, expiredLegacyId, "PATCH", { submissionId: expiredLegacyId }))).status, 403);
  const preservedLedger = JSON.parse(fs.readFileSync(path.join(directory, "uploads.json"), "utf8"));
  assert.equal(preservedLedger.submissions.find((entry) => entry.id === expiredLegacyId).owner, legacyHash);
  assert.ok(fs.existsSync(path.join(directory, "media", `${uploaded.id}.png`)));
  pass("current-session legacy receipts migrate safely while expired legacy receipts cannot be implicitly claimed or deleted");
  const configurationKeys = ["CMS_STORAGE", "CMS_AUTH_MODE", "MONGODB_URI", "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "NEXT_PUBLIC_DEMO_MODE", "NEXT_PUBLIC_SITE_URL", "SITE_NOINDEX", "VERCEL"];
  const configuredEnvironment = Object.fromEntries(configurationKeys.map((key) => [key, process.env[key]]));
  const restoreConfiguration = () => { for (const [key, value] of Object.entries(configuredEnvironment)) if (value === undefined) delete process.env[key]; else process.env[key] = value; };
  try {
    for (const missing of ["CMS_AUTH_MODE", "MONGODB_URI", "CLOUDINARY_API_SECRET"]) {
      Object.assign(process.env, { CMS_STORAGE: "mongodb", CMS_AUTH_MODE: "password", MONGODB_URI: "mongodb://mock.invalid/no-network", CLOUDINARY_CLOUD_NAME: "mock-cloud", CLOUDINARY_API_KEY: "mock-key", CLOUDINARY_API_SECRET: "mock-secret" });
      process.env[missing] = "";
      assert.equal(auth.cmsMode(), "unavailable", `Missing ${missing} must disable a configured remote CMS`);
      await assert.rejects(load("src/lib/cms/server.ts").getPublishedContent(), (error) => error.code === "CMS_UNAVAILABLE", `Missing ${missing} must not expose fallback catalog prices`);
    }
    Object.assign(process.env, { CMS_STORAGE: "", CMS_AUTH_MODE: "", NEXT_PUBLIC_DEMO_MODE: "false" });
    assert.equal((await load("src/lib/cms/server.ts").getPublishedContent()).products[0].id, defaults.defaultContent().products[0].id, "An intentionally disabled local CMS retains the bundled storefront");
    Object.assign(process.env, { NEXT_PUBLIC_DEMO_MODE: "true", VERCEL: "1" });
    assert.equal(auth.cmsMode(), "unavailable", "A deployed demo must not gain password-free CMS access");
    await assert.rejects(auth.authorizeCms(request(ownerCookie)), (error) => error.code === "CMS_UNAVAILABLE");
    for (const [url, demo, noindex, blocked] of [["http://127.0.0.1:3100", "false", "false", true], ["https://store.example", "true", "false", true], ["https://store.example", "false", "true", true], ["https://store.example", "false", "false", false]]) {
      Object.assign(process.env, { NEXT_PUBLIC_SITE_URL: url, NEXT_PUBLIC_DEMO_MODE: demo, SITE_NOINDEX: noindex });
      cache.delete(path.join(root, "src", "lib", "metadata.ts"));
      assert.equal(load("src/lib/metadata.ts").preventIndexing, blocked, "Local, demo and staging metadata block indexing; an approved non-demo public configuration can allow it");
    }
  } finally { restoreConfiguration(); cache.delete(path.join(root, "src", "lib", "metadata.ts")); }
  pass("incomplete remote configuration fails closed, deployments reject local access and indexing follows local/demo/staging/public settings");
  const initial = await load("src/lib/cms/server.ts").getCmsState();
  const body = { revision: initial.revision, action: "save", content: structuredClone(initial.draft) };
  body.content.settings.phone = "+66000000000";
  const settingsRequest = new Request("http://127.0.0.1:3100/api/cms", { method: "PUT", headers: { cookie: anotherEditor, origin: "http://127.0.0.1:3100", "content-type": "application/json" }, body: JSON.stringify(body) });
  assert.equal((await cms.PUT(settingsRequest)).status, 403);
  assert.equal((await load("src/lib/cms/server.ts").getCmsState()).revision, initial.revision);
  await auth.revokeSession(request(anotherEditor));
  assert.equal(await auth.authenticated(request(anotherEditor)), false);
  staff[0].sessionVersion = 2; process.env.CMS_STAFF_ACCOUNTS = JSON.stringify(staff);
  assert.equal(await auth.authenticated(request(ownerCookie)), false);
  pass("editor settings rejection, logout revocation and account-wide session-version revocation");
  const content = defaults.defaultContent();
  const { searchStore } = load("src/lib/search.ts");
  const privateArticle = structuredClone(content.articles[0]); privateArticle.slug = "hidden-needle"; privateArticle.status = "draft"; privateArticle.content.en.title = "UNIQUE_PRIVATE_NEEDLE"; content.articles.push(privateArticle);
  assert.equal(searchStore(content, "en", "UNIQUE_PRIVATE_NEEDLE").length, 0);
  assert.ok(searchStore(content, "en", "honey").some((result) => result.kind === "product"));
  assert.ok(searchStore(content, "en", "honey").some((result) => result.kind === "article"));
  assert.ok(searchStore(content, "th", "น้ำผึ้ง", "article").every((result) => result.kind === "article"));
  assert.equal(searchStore(content, "th", " ").length, 0);
  pass("localized site search finds products and articles without exposing drafts");
  const { resolveSellingDetails, sellingCopy } = load("src/lib/business-settings.ts");
  const before = resolveSellingDetails(content.settings, "en");
  content.settings.business = { shipping: { confirmed: false, content: { th: { title: "ทดสอบ", summary: "ทดสอบ", description: "ข้อมูลทดสอบ" }, en: { title: "Test shipping", summary: "Test summary", description: "Synthetic approved terms" } } } };
  assert.deepEqual(resolveSellingDetails(content.settings, "en"), before);
  content.settings.business.shipping.confirmed = true;
  assert.equal(resolveSellingDetails(content.settings, "en").shipping.description, "Synthetic approved terms");
  assert.equal(sellingCopy(content.settings, {})["honey.en.shippingNote"], "Test summary");
  pass("unconfirmed business information stays pending; confirmed terms propagate consistently");
  const { launchReadiness } = load("src/lib/launch-readiness.ts");
  const indexingReady = (environment) => launchReadiness(content, environment).find((item) => item.key === "indexing").ready;
  assert.equal(indexingReady({ NEXT_PUBLIC_SITE_URL: "http://localhost:3100" }), false);
  assert.equal(indexingReady({ NEXT_PUBLIC_SITE_URL: "https://store.example", NEXT_PUBLIC_DEMO_MODE: "true" }), false);
  assert.equal(indexingReady({ NEXT_PUBLIC_SITE_URL: "https://store.example", SITE_NOINDEX: "true" }), false);
  assert.equal(indexingReady({ NEXT_PUBLIC_SITE_URL: "https://store.example", NEXT_PUBLIC_DEMO_MODE: "false" }), true);
  pass("launch indexing status stays pending for local, demo and noindex environments");

  const collections = new Map();
  const matches = (doc, filter) => Object.entries(filter).every(([key, value]) => value && typeof value === "object" && !(value instanceof Date) ? Object.entries(value).every(([op, compare]) => op === "$gt" ? doc[key] > compare : op === "$lte" ? doc[key] <= compare : op === "$regex" ? new RegExp(compare).test(doc[key]) : false) : doc[key] === value);
  const db = { collection(name) {
    if (!collections.has(name)) collections.set(name, new Map());
    const records = collections.get(name);
    const find = (filter) => [...records.values()].find((doc) => matches(doc, filter));
    return {
      async findOne(filter) { return structuredClone(find(filter) ?? null); },
      async insertOne(doc) { if (records.has(doc._id)) throw Object.assign(new Error("duplicate"), { code: 11000 }); records.set(doc._id, structuredClone(doc)); },
      async findOneAndUpdate(filter, update) { const doc = find(filter); if (!doc) return null; Object.assign(doc, structuredClone(update.$set)); return structuredClone(doc); },
      async updateOne(filter, update) { const doc = find(filter); if (doc) Object.assign(doc, structuredClone(update.$set)); },
      async replaceOne(filter, doc) { records.set(filter._id, structuredClone(doc)); },
      async deleteOne(filter) { const doc = find(filter); if (doc) records.delete(doc._id); },
      find(filter = {}) { return { limit(limit) { return { async toArray() { return [...records.values()].filter((doc) => matches(doc, filter)).slice(0, limit).map((doc) => structuredClone(doc)); } }; } }; },
    };
  } };
  const mongo = load("src/lib/db.ts"); mongo.getDb = async () => db; mongo.getMongoClient = async () => ({ startSession: () => ({ withTransaction: async (task) => task(), endSession: async () => undefined }) });
  process.env.CMS_STORAGE = "mongodb"; process.env.MONGODB_URI = "mongodb://mock.invalid/no-network";
  process.env.CLOUDINARY_CLOUD_NAME = "mock-cloud"; process.env.CLOUDINARY_API_KEY = "mock-key"; process.env.CLOUDINARY_API_SECRET = "mock-secret";
  const image = Buffer.from("Synthetic image transport bytes"); const id = createHash("sha256").update(image).digest("hex"), filename = `${id}.png`;
  let upload = null, deleteFails = false, existingResponse = false, uploadFails = false;
  globalThis.fetch = async (url, options) => {
    const endpoint = new URL(url);
    assert.equal(endpoint.hostname, "api.cloudinary.com");
    if (endpoint.pathname.endsWith("/upload")) { assert.equal(options.body.get("type"), "authenticated"); assert.equal(options.body.get("overwrite"), "false"); assert.equal(options.body.get("signature").length, 64); if (uploadFails) return new Response(null, { status: 503 }); if (existingResponse) return Response.json({ existing: true }); upload = Buffer.from(await options.body.get("file").arrayBuffer()); return Response.json({ public_id: `vetra-cms/${id}`, type: "authenticated" }); }
    if (endpoint.pathname.endsWith("/download")) { assert.equal(endpoint.searchParams.get("type"), "authenticated"); return upload ? new Response(upload) : new Response(null, { status: 404 }); }
    if (endpoint.pathname.endsWith("/destroy")) { if (deleteFails) return new Response(null, { status: 503 }); upload = null; return Response.json({ result: "ok" }); }
    throw new Error("Unexpected transport");
  };
  const storage = load("src/lib/cms/storage.ts");
  const statePath = path.join(directory, "state.json"), imagePath = path.join(directory, "media", filename);
  await assert.rejects(storage.atomicFile(statePath, "{}"), (error) => error.code === "CMS_BUSY");
  await storage.withRemoteCmsLock(async () => {
    await storage.atomicFile(statePath, '{"revision":1}');
    assert.equal(await storage.readFile(statePath, "utf8"), '{"revision":1}');
    await storage.atomicFile(imagePath, image);
    assert.deepEqual(await storage.readFile(imagePath), image);
    existingResponse = true; await storage.atomicFile(imagePath, image); assert.deepEqual(await storage.readFile(imagePath), image);
    upload = Buffer.from("Unexpected different bytes"); await assert.rejects(storage.atomicFile(imagePath, image), (error) => error.code === "MEDIA_STORAGE_INVALID");
    upload = image; await storage.atomicFile(imagePath, image); existingResponse = false;
    assert.equal((await storage.stat(imagePath)).size, image.length);
    assert.deepEqual(await storage.readdir(path.join(directory, "media")), [filename]);
    assert.deepEqual(await storage.readdir(path.join(directory, "history")), []);
    deleteFails = true; await assert.rejects(storage.unlink(imagePath));
    assert.deepEqual(await storage.readFile(imagePath), image);
    deleteFails = false; await storage.unlink(imagePath);
    await assert.rejects(storage.readFile(imagePath), (error) => error.code === "ENOENT");
  });
  pass("mocked durable JSON and private Cloudinary media verify bytes and preserve failed deletions");
  await storage.withRemoteCmsLock(async () => {
    await storage.atomicFile(statePath, JSON.stringify(defaults.defaultState()));
    uploadFails = true;
    await assert.rejects(storage.atomicFile(imagePath, image), (error) => error.code === "UPLOAD_UNCERTAIN");
    assert.equal(collections.get("cms_files").get(`media/${filename}`).ready, false);
    uploadFails = false;
  });
  const cleanup = await load("src/lib/cms/server.ts").cleanupCmsMedia();
  assert.ok(cleanup.deletedIds.includes(id));
  assert.equal(collections.get("cms_files").has(`media/${filename}`), false);
  pass("existing-provider retries verify original bytes and cleanup removes interrupted upload intents with absent provider files");
  await storage.withRemoteCmsLock(async () => { await storage.atomicFile(statePath, '{"revision":1}'); });
  await storage.withRemoteCmsLock(async () => {
    await assert.rejects(storage.withRemoteCmsLock(async () => undefined), (error) => error.code === "CMS_BUSY");
    collections.get("cms_locks").get("content").owner = "another-worker";
    await assert.rejects(storage.atomicFile(statePath, '{"revision":999}'), (error) => error.code === "CMS_LOCK_EXPIRED");
  });
  assert.equal(await storage.readFile(statePath, "utf8"), '{"revision":1}');
  pass("concurrent durable saves and expired-worker writes are fenced without replacing saved content");
  console.log(`PASS: ${checks} platform groups. Temporary storage and mocked external transport only.`);
} finally {
  globalThis.fetch = realFetch;
  for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
  Object.assign(process.env, env);
  const relative = path.relative(output, directory);
  assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative) && relative.startsWith("platform-check-"));
  fs.rmSync(directory, { recursive: true, force: true });
}

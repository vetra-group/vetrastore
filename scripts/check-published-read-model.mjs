import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url), modules = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (modules.has(filename)) return modules.get(filename).exports;
  const record = { exports: {} }; modules.set(filename, record);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const require = (name) => name === "next/cache" ? { revalidatePath() {} } : name.startsWith("@/") ? load(`src/${name.slice(2)}.ts`) : name.startsWith(".") ? load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`))) : nativeRequire(name);
  new Function("require", "module", "exports", code)(require, record, record.exports);
  return record.exports;
}
const output = path.join(root, "output"); fs.mkdirSync(output, { recursive: true });
const directory = fs.mkdtempSync(path.join(output, "published-read-check-"));
const environment = { ...process.env }; let checks = 0;
const pass = (message) => { checks++; console.log(`PASS: ${message}`); };
const setThaiBase = (product, amount) => { product.price = amount; if (product.pricing) product.pricing.THB[0].total = amount; };
try {
  process.env.NEXT_PUBLIC_DEMO_MODE = "true"; process.env.CMS_LOCAL_DATA_DIR = directory;
  delete process.env.VERCEL; delete process.env.CMS_STORAGE; delete process.env.CMS_AUTH_MODE;
  const defaults = load("src/lib/cms/defaults.ts"), storage = load("src/lib/cms/storage.ts"), readModel = load("src/lib/cms/published-read-model.ts"), server = load("src/lib/cms/server.ts");
  const { publishedContentProjection } = load("src/lib/cms/public-content.ts");
  const statePath = path.join(directory, "state.json"), projectionPath = path.join(directory, "published.json");
  const realRead = storage.readFile, realVersion = storage.fileVersion;
  let stateReads = 0, projectionReads = 0, metadataReads = 0;
  storage.readFile = async (filename, ...args) => { if (filename === statePath) stateReads++; if (filename === projectionPath) projectionReads++; return realRead(filename, ...args); };
  storage.fileVersion = async (...args) => { metadataReads++; return realVersion(...args); };

  const legacy = defaults.defaultState();
  legacy.published.products[0].price = 480; delete legacy.published.products[0].pricing;
  legacy.published.articles[0].editorialNotes = "PRIVATE EDITOR NOTE";
  legacy.published.articles.push({ ...structuredClone(legacy.published.articles[0]), slug: "hidden-article", id: "hidden-article", status: "draft" });
  legacy.published.slides[0].enabled = false;
  legacy.draft = { deliberately: "invalid draft content must not block public reads" };
  legacy.trash = [{ expiresAt: "2001-01-01T00:00:00.000Z", deliberately: "invalid retained content" }];
  await storage.atomicFile(statePath, JSON.stringify(legacy));
  const originalBytes = fs.readFileSync(statePath, "utf8");
  const first = await server.getPublishedContent();
  assert.ok(first.articles.every((article) => article.status === "published" && !article.editorialNotes));
  assert.ok(first.slides.every((slide) => slide.enabled));
  assert.equal(first.products[0].price, 380, "The exact old honey price upgrades in memory without rewriting the legacy file");
  assert.equal(first.products[0].pricing.THB[0].total, 380);
  assert.equal(fs.readFileSync(statePath, "utf8"), originalBytes); assert.equal(fs.existsSync(projectionPath), false);
  assert.equal(globalThis.__vetraCmsTrashTimer, undefined);
  assert.equal(stateReads, 1);
  const probes = metadataReads; await readModel.readPublishedContent();
  assert.equal(stateReads, 1); assert.ok(metadataReads > probes);
  pass("legacy public reads validate only published content, strip private/hidden records, never expire Trash or write, and cache behind metadata probes");

  legacy.revision++; legacy.published.products[0] = structuredClone(defaults.defaultState().published.products[0]); setThaiBase(legacy.published.products[0], 777);
  await storage.atomicFile(statePath, JSON.stringify(legacy));
  assert.equal((await readModel.readPublishedContent()).products[0].price, 777);
  assert.equal(stateReads, 2);
  pass("authoritative file changes invalidate cached prices, including changes made outside the current worker");

  await storage.atomicFile(statePath, JSON.stringify(defaults.defaultState())); readModel.invalidatePublishedReadModel();
  let state = await server.getCmsState();
  let draft = structuredClone(state.draft); setThaiBase(draft.products[0], 999);
  state = await server.updateCmsContent(state.revision, draft, "save");
  stateReads = 0; projectionReads = 0;
  assert.equal((await readModel.readPublishedContent()).products[0].price, 380);
  assert.equal(stateReads, 0); assert.equal(projectionReads, 1);
  const projection = JSON.parse(fs.readFileSync(projectionPath, "utf8"));
  assert.deepEqual(Object.keys(projection).sort(), ["content", "hash", "sourceVersion", "version"]);
  assert.equal(projection.sourceVersion, (await realVersion(statePath)).version);
  state = await server.publishCmsSelection(state.revision, [{ kind: "product", key: state.draft.products[0].id }]);
  assert.equal((await readModel.readPublishedContent()).products[0].price, 999);
  const copy = await readModel.readPublishedContent(); copy.products[0].price = 1;
  assert.equal((await readModel.readPublishedContent()).products[0].price, 999);
  pass("draft saves keep live prices unchanged; selected publication refreshes the separate projection and callers cannot mutate cached content");

  for (const broken of ["null", "{}", "{", JSON.stringify({ ...projection, sourceVersion: "old-version" })]) {
    await storage.atomicFile(projectionPath, broken); readModel.invalidatePublishedReadModel();
    assert.equal((await readModel.readPublishedContent()).products[0].price, 999);
  }
  draft = structuredClone(state.draft); draft.products[0].status = "archived";
  state = await server.updateCmsContent(state.revision, draft, "save"); state = await server.publishCmsSelection(state.revision, [{ kind: "product", key: draft.products[0].id }]);
  assert.equal((await readModel.readPublishedContent()).products.length, 0);
  pass("missing, invalid or stale sidecars recover from the committed publication and an archived catalog can publish without leaking hidden products");

  const collections = new Map(); let unavailable = false, failProjection = false; const probesSeen = [];
  const matches = (entry, filter) => Object.entries(filter).every(([key, value]) => value && typeof value === "object" && !(value instanceof Date) ? Object.entries(value).every(([operator, compare]) => operator === "$gt" ? entry[key] > compare : operator === "$lte" ? entry[key] <= compare : false) : entry[key] === value);
  const db = { collection(name) {
    if (!collections.has(name)) collections.set(name, new Map());
    const entries = () => collections.get(name), find = (filter) => [...entries().values()].find((entry) => matches(entry, filter));
    return {
      async findOne(filter, options) { if (unavailable) throw new Error("Synthetic database outage"); probesSeen.push({ name, filter, options }); const entry = find(filter); if (!entry) return null; return options?.projection ? Object.fromEntries(Object.keys(options.projection).filter((key) => options.projection[key]).map((key) => [key, structuredClone(entry[key])])) : structuredClone(entry); },
      async insertOne(entry) { if (entries().has(entry._id)) throw Object.assign(new Error("duplicate"), { code: 11000 }); entries().set(entry._id, structuredClone(entry)); },
      async findOneAndUpdate(filter, update) { const entry = find(filter); if (!entry) return null; Object.assign(entry, update.$set); return structuredClone(entry); },
      async updateOne(filter, update) { const entry = find(filter); if (entry) Object.assign(entry, update.$set); },
      async replaceOne(filter, entry) { if (failProjection && entry._id === "published.json") throw new Error("Synthetic projection transaction failure"); entries().set(filter._id, structuredClone(entry)); },
      async deleteOne(filter) { const entry = find(filter); if (entry) entries().delete(entry._id); },
    };
  } };
  const mongo = load("src/lib/db.ts"); mongo.getDb = async () => db;
  mongo.getMongoClient = async () => ({ startSession: () => ({ async withTransaction(task) { const before = structuredClone(collections); try { return await task(); } catch (error) { collections.clear(); for (const [key, entries] of before) collections.set(key, entries); throw error; } }, async endSession() {} }) });
  process.env.CMS_STORAGE = "mongodb";
  const remoteState = defaults.defaultState(); setThaiBase(remoteState.published.products[0], 543); remoteState.published.products[0].pricing.internationalTHB[0].total = 70;
  await storage.withRemoteCmsLock(() => storage.atomicStateAndPublished(statePath, JSON.stringify(remoteState), publishedContentProjection(remoteState.published)));
  stateReads = 0; projectionReads = 0; readModel.invalidatePublishedReadModel();
  assert.equal((await readModel.readPublishedContent()).products[0].price, 543);
  assert.equal((await readModel.readPublishedContent()).products[0].pricing.internationalTHB[0].total, 70);
  assert.equal(stateReads, 0); assert.equal(projectionReads, 1);
  const stateProbes = probesSeen.filter((entry) => entry.filter._id === "state.json");
  assert.ok(stateProbes.length > 0 && stateProbes.every((entry) => entry.options?.projection?.hash === 1 && entry.options.projection.size === 1 && !entry.options.projection.text));
  pass("durable public reads fetch only small state metadata and the published projection, excluding full CMS state text");

  failProjection = true; remoteState.revision++; setThaiBase(remoteState.published.products[0], 876); remoteState.published.products[0].pricing.internationalTHB[0].total = 75;
  await assert.rejects(storage.withRemoteCmsLock(() => storage.atomicStateAndPublished(statePath, JSON.stringify(remoteState), publishedContentProjection(remoteState.published))), /projection transaction failure/);
  failProjection = false;
  assert.equal((await readModel.readPublishedContent()).products[0].price, 543);
  assert.equal(JSON.parse(collections.get("cms_files").get("state.json").text).published.products[0].price, 543);
  await storage.withRemoteCmsLock(() => storage.atomicStateAndPublished(statePath, JSON.stringify(remoteState), publishedContentProjection(remoteState.published)));
  assert.equal((await readModel.readPublishedContent()).products[0].price, 876);
  assert.equal((await readModel.readPublishedContent()).products[0].pricing.internationalTHB[0].total, 75);
  pass("a failed Mongo projection write rolls back state and publication together; a successful retry updates both atomically");

  unavailable = true;
  await assert.rejects(readModel.readPublishedContent(), /database outage/);
  unavailable = false; collections.get("cms_files").delete("state.json");
  await assert.rejects(readModel.readPublishedContent(), (error) => error.code === "ENOENT");
  pass("database outages and missing authoritative records fail closed even after warming the cache; no source or stale prices are returned");
  console.log(`${checks} public read-model checks passed. Temporary storage and mocked MongoDB only.`);
} finally {
  if (globalThis.__vetraCmsTrashTimer) { clearInterval(globalThis.__vetraCmsTrashTimer); delete globalThis.__vetraCmsTrashTimer; }
  for (const key of Object.keys(process.env)) if (!(key in environment)) delete process.env[key];
  Object.assign(process.env, environment);
  const relative = path.relative(output, directory);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) fs.rmSync(directory, { recursive: true, force: true });
}

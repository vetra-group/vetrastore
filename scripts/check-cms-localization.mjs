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
  const record = { exports: {} }; cache.set(filename, record);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const require = (name) => name === "next/cache" ? { revalidatePath() {} } : name.startsWith("@/") ? load(`src/${name.slice(2)}.ts`) : name.startsWith(".") ? load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`))) : nativeRequire(name);
  new Function("require", "module", "exports", compiled)(require, record, record.exports);
  return record.exports;
}
function bilingual(value) {
  if (Array.isArray(value)) return value.map(bilingual);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "ar").map(([key, entry]) => [key, bilingual(entry)]));
}
const output = path.join(root, "output"); fs.mkdirSync(output, { recursive: true });
const directory = fs.mkdtempSync(path.join(output, "cms-localization-"));
const savedEnv = Object.fromEntries(["CMS_LOCAL_DATA_DIR", "NEXT_PUBLIC_DEMO_MODE", "VERCEL", "CMS_STORAGE"].map((key) => [key, process.env[key]]));
try {
  process.env.CMS_LOCAL_DATA_DIR = directory; process.env.NEXT_PUBLIC_DEMO_MODE = "true"; delete process.env.VERCEL; delete process.env.CMS_STORAGE;
  const { defaultState, defaultCopy } = load("src/lib/cms/defaults.ts");
  const { validateCmsState, validateCmsContent, CMS_TRASH_TTL_MS } = load("src/lib/cms/validation.ts");
  const { assertPublicationReady } = load("src/lib/cms/publishing.ts");
  const { productLocaleReady, articleLocaleReady, untranslatedCopyKeys } = load("src/lib/cms/localization.ts");
  const server = load("src/lib/cms/server.ts");
  const current = defaultState(), legacy = bilingual(current), original = structuredClone(legacy);
  const upgraded = validateCmsState(legacy);
  assert.deepEqual(legacy, original, "Language upgrades must not mutate their input");
  assert.deepEqual(upgraded.draft.products[0].name.ar, current.draft.products[0].name.ar);
  assert.deepEqual(upgraded.published.articles[0].content.ar, current.published.articles[0].content.ar);
  assertPublicationReady(upgraded.published);
  const historical = structuredClone(legacy.draft);
  const storySlide = historical.slides.find((slide) => slide.key === "coffeeLandscape");
  storySlide.linkLabel = { en: "Read the VETRA story", th: "อ่านเรื่องราวของ VETRA" };
  const historicalUpgrade = validateCmsContent(historical).slides.find((slide) => slide.key === storySlide.key);
  assert.deepEqual(historicalUpgrade.linkLabel, { ...storySlide.linkLabel, ar: "تعرّف على قصة VETRA" });
  storySlide.linkLabel.en += " with a custom edit";
  assert.equal(validateCmsContent(historical).slides.find((slide) => slide.key === storySlide.key).linkLabel.ar, "");
  console.log("PASS: bilingual seed records receive exact Arabic translations without changing their English or Thai source");

  const edited = structuredClone(legacy);
  edited.draft.products[0].description.en = "A custom product description awaiting translation.";
  edited.published.articles[0].content.en.title = "An independently edited title";
  edited.draft.copy["site.en.announcement"] = "An edited announcement";
  const custom = validateCmsState(edited);
  assert.equal(custom.draft.products[0].description.ar, "");
  assert.equal(custom.published.articles[0].content.ar.title, "");
  assert.equal(productLocaleReady(custom.draft.products[0], "ar"), false);
  assert.equal(articleLocaleReady(custom.published.articles[0], "ar"), false);
  assert.equal(productLocaleReady(custom.draft.products[0], "en"), true);
  assert.equal(articleLocaleReady(custom.published.articles[0], "th"), true);
  assert.deepEqual(untranslatedCopyKeys(custom.draft, defaultCopy), ["site.ar.announcement"]);
  assert.equal(Object.hasOwn(custom.draft.copy, "site.ar.announcement"), false, "Normalization must not introduce blank Arabic website controls");
  const { applyCopy } = load("src/lib/cms/apply-copy.ts");
  const { siteCopy } = load("src/content/site.ts");
  assert.equal(applyCopy(siteCopy.ar, "site.ar", custom.draft.copy).announcement, siteCopy.ar.announcement, "Missing custom Arabic retains the translated base interface");
  assert.throws(() => assertPublicationReady(custom.draft), (error) => error.code === "TRANSLATION_REQUIRED");
  assert.throws(() => assertPublicationReady(custom.published), (error) => error.code === "TRANSLATION_REQUIRED");
  assert.deepEqual(validateCmsState(custom), custom, "Repeated normalization is idempotent");
  const translated = structuredClone(current.draft); translated.products[0].description.ar = "وصف عربي محفوظ بعناية";
  assert.equal(validateCmsContent(translated).products[0].description.ar, translated.products[0].description.ar);
  console.log("PASS: custom content stays editable, missing Arabic is explicit and publication is blocked; existing Arabic survives");

  const deletedAt = new Date().toISOString();
  legacy.trash.push({ id: randomUUID(), kind: "article", position: 0, deletedAt, expiresAt: new Date(Date.parse(deletedAt) + CMS_TRASH_TTL_MS).toISOString(), item: structuredClone(legacy.draft.articles[0]) });
  const stateBytes = JSON.stringify(legacy);
  fs.writeFileSync(path.join(directory, "state.json"), stateBytes);
  const read = await server.getCmsState();
  assert.ok(read.trash[0].item.content.ar.title);
  assert.equal(fs.readFileSync(path.join(directory, "state.json"), "utf8"), stateBytes);
  const history = { revision: 0, at: deletedAt, action: "Initial source content", draft: original.draft, published: original.published };
  history.id = `0-${createHash("sha256").update(JSON.stringify({ draft: history.draft, published: history.published })).digest("hex").slice(0, 16)}`;
  const backup = { format: "vetra-cms-backup", version: 1, createdAt: deletedAt, state: legacy, uploads: { version: 1, submissions: [], expiredFiles: [] }, history: [history] };
  const verified = server.validateCmsBackupMetadata(backup);
  assert.ok(verified.state.draft.articles[0].content.ar.title);
  assert.deepEqual(verified.history[0], history, "Legacy history retains its original hash-bound bytes in backups");
  assert.deepEqual(server.validateCmsBackupMetadata(JSON.parse(JSON.stringify(verified))), verified);
  const tampered = structuredClone(backup); tampered.history[0].draft.products[0].price += 1;
  assert.throws(() => server.validateCmsBackupMetadata(tampered), (error) => error.code === "HISTORY_INVALID");
  console.log("PASS: state and Trash upgrade without writing storage; bilingual backup history remains valid and tampering still fails");
} finally {
  for (const [key, value] of Object.entries(savedEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  const resolved = path.resolve(directory);
  assert.ok(resolved.startsWith(`${path.resolve(output)}${path.sep}cms-localization-`));
  fs.rmSync(resolved, { recursive: true, force: true });
}

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), nativeRequire = createRequire(import.meta.url), modules = new Map();
function load(relative) {
  const filename = path.resolve(root, relative); if (modules.has(filename)) return modules.get(filename).exports;
  const record = { exports: {} }; modules.set(filename, record);
  const require = (name) => name.startsWith("@/") ? load(`src/${name.slice(2)}.ts`) : name.startsWith(".") ? load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`))) : nativeRequire(name);
  new Function("require", "module", "exports", ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText)(require, record, record.exports);
  return record.exports;
}
const previous = { ...process.env }, output = path.join(root, "output"); fs.mkdirSync(output, { recursive: true });
const source = fs.mkdtempSync(path.join(output, "backup-transfer-source-")), recovery = fs.mkdtempSync(path.join(output, "backup-transfer-recovery-"));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex"); let groups = 0;
const pass = (text) => { groups++; console.log(`PASS: ${text}`); };
try {
  Object.assign(process.env, { NEXT_PUBLIC_DEMO_MODE: "true", CMS_AUTH_MODE: "", CMS_STORAGE: "", MONGODB_URI: "", CLOUDINARY_API_SECRET: "", CMS_LOCAL_DATA_DIR: source }); delete process.env.VERCEL;
  const api = load("src/app/api/cms/backup-transfer/route.ts"), session = load("src/app/api/cms/session/route.ts"), server = load("src/lib/cms/server.ts"), transfers = load("src/lib/cms/backup-transfers.ts"), store = load("src/lib/cms/backup-transfer-store.ts"), storage = load("src/lib/cms/storage.ts"), auth = load("src/lib/cms/auth.ts"), format = load("src/lib/cms/backup-format.ts");
  const request = (method = "GET", body, cookie, origin = "http://127.0.0.1:3100") => new Request("http://127.0.0.1:3100/api/cms/backup-transfer", { method, headers: { origin, ...(cookie ? { cookie } : {}), "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.equal((await api.GET(request())).status, 401);
  const login = await session.POST(request("POST", { action: "login" })), cookie = login.headers.get("set-cookie").split(";")[0];
  assert.equal((await api.POST(request("POST", { action: "export", id: randomUUID() }, cookie, "https://untrusted.example"))).status, 403);
  for (const file of [undefined, null, "0", -1, .5]) assert.equal((await api.POST(request("POST", { action: "verify", id: randomUUID(), file }, cookie))).status, 400, "A file index must be an explicit nonnegative integer");
  for (const file of ["", "01", "NaN", "-1", "0.5"]) assert.equal((await api.GET(new Request(`http://127.0.0.1:3100/api/cms/backup-transfer?id=${randomUUID()}&file=${file}&chunk=0`, { headers: { cookie } }))).status, 400);
  let state = await server.getCmsState();
  const capturedPrice = state.draft.products[0].price;
  const image = fs.readFileSync(path.join(root, "public", "images", "honey-product.png"));
  const staged = await server.stageCmsMedia(sha("backup-owner"), randomUUID(), image, "image/png", "backup-test.png");
  const id = randomUUID(), exported = await transfers.startBackupExport(id), manifest = exported.manifest;
  assert.equal(format.validateBackupManifest(manifest).manifestHash, sha(format.manifestPayload(manifest)));
  assert.equal((await transfers.startBackupExport(id)).manifest.manifestHash, manifest.manifestHash);
  assert.ok(manifest.files.some((file) => file.name.endsWith(`${staged.upload.id}.png`)));
  const oldIdentity = auth.cmsStaffId; auth.cmsStaffId = () => "another-owner";
  await assert.rejects(transfers.getBackupTransfer(id), (error) => error.code === "BACKUP_OWNER"); auth.cmsStaffId = oldIdentity;
  pass("transfer APIs require a session, reject cross-origin writes and enforce owner/snapshot identity");

  const mediaIndex = manifest.files.findIndex((file) => file.name.startsWith("media/")), originalRead = storage.readFile;
  let unblock, entered; const enteredPromise = new Promise((resolve) => { entered = resolve; }), blocked = new Promise((resolve) => { unblock = resolve; });
  storage.readFile = async (filename, encoding) => { if (filename === path.join(source, manifest.files[mediaIndex].name)) { entered(); await blocked; } return originalRead(filename, encoding); };
  const downloading = transfers.downloadBackupChunk(id, mediaIndex, 0); await enteredPromise;
  const changed = structuredClone(state.draft); changed.products[0].price = capturedPrice + 49;
  try { state = await Promise.race([server.updateCmsContent(state.revision, changed, "save"), new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error("Export held the content write lock during media transfer")), 3000); timer.unref(); })]); }
  finally { unblock(); storage.readFile = originalRead; }
  const firstChunk = await downloading; assert.equal(firstChunk.bytes.length, format.BACKUP_CHUNK_BYTES);
  assert.deepEqual((await transfers.downloadBackupChunk(id, mediaIndex, 0)).bytes, firstChunk.bytes);
  pass("slow media export does not hold the content mutation lock; interrupted chunk downloads repeat exactly");

  const chunks = new Map();
  for (const [file, entry] of manifest.files.entries()) for (let chunk = 0; chunk < format.chunkCount(entry); chunk++) { const part = await transfers.downloadBackupChunk(id, file, chunk); assert.equal(part.sha256, sha(part.bytes)); chunks.set(`${file}-${chunk}`, part.bytes); }
  const sourceSnapshot = JSON.parse(Buffer.concat([...chunks].filter(([key]) => Number(key.split("-")[0]) === manifest.files.findIndex((file) => file.name === "state.json")).map(([, bytes]) => bytes)).toString());
  assert.equal(sourceSnapshot.draft.products[0].price, capturedPrice, "Export stays at its captured revision after later edits");
  const ledgerPath = path.join(source, "uploads.json"), ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8")); for (const entry of ledger.submissions) entry.updatedAt = "2000-01-01T00:00:00.000Z"; fs.writeFileSync(ledgerPath, JSON.stringify(ledger));
  const extraBytes = Buffer.from("isolated unreferenced cleanup fixture"), extraId = sha(extraBytes); fs.writeFileSync(path.join(source, "media", `${extraId}.png`), extraBytes);
  let transferReads = 0; storage.readFile = async (filename, encoding) => { if (filename.startsWith(path.join(source, "backup-transfers"))) transferReads++; return originalRead(filename, encoding); };
  let cleanup;
  try { cleanup = await server.cleanupCmsMedia(); } finally { storage.readFile = originalRead; }
  assert.ok(cleanup.retainedIds.includes(staged.upload.id), "Active export protects otherwise unreferenced media");
  assert.ok(cleanup.deletedIds.includes(extraId)); assert.equal(transferReads, 1, "One lock-scoped manifest snapshot serves all cleanup candidates");
  pass("manifests keep a consistent snapshot and one locked pin snapshot protects all Cleanup candidates");

  process.env.CMS_LOCAL_DATA_DIR = recovery;
  const importId = randomUUID(), importing = await transfers.startBackupImport(importId, manifest);
  const tampered = structuredClone(manifest); tampered.files[0].bytes += 1;
  await assert.rejects(transfers.startBackupImport(randomUUID(), tampered), (error) => error.code === "BACKUP_MANIFEST_INVALID");
  const traversal = structuredClone(manifest); traversal.files[0].name = "../state.json";
  await assert.rejects(transfers.startBackupImport(randomUUID(), traversal));
  await assert.rejects(transfers.inspectBackupTransfer(importId), (error) => error.code === "BACKUP_INCOMPLETE");
  const first = chunks.get("0-0"); await transfers.uploadBackupChunk(importId, 0, 0, first); await transfers.uploadBackupChunk(importId, 0, 0, first);
  const wrong = Buffer.from(first); wrong[0] ^= 1;
  await assert.rejects(transfers.uploadBackupChunk(importId, 0, 0, wrong), (error) => error.code === "BACKUP_CHUNK_CONFLICT");
  assert.deepEqual((await transfers.getBackupTransfer(importId)).received[0], [0]);
  assert.equal((await transfers.startBackupImport(importId, manifest)).id, importing.id);
  pass("tampered manifests, traversal and incomplete imports fail; duplicate chunks and session resume are idempotent");

  for (const [file, entry] of manifest.files.entries()) {
    for (let chunk = 0; chunk < format.chunkCount(entry); chunk++) await transfers.uploadBackupChunk(importId, file, chunk, chunks.get(`${file}-${chunk}`));
    await transfers.verifyBackupFile(importId, file);
  }
  assert.deepEqual(fs.readFileSync(path.join(recovery, manifest.files[mediaIndex].name)), image);
  assert.ok((await server.cleanupCmsMedia()).retainedIds.includes(staged.upload.id), "Uncommitted imported media is pinned");
  const plan = await transfers.inspectBackupTransfer(importId), before = await server.getCmsState();
  await assert.rejects(transfers.commitBackupTransfer(importId, plan.revision, "wrong"), (error) => error.code === "BACKUP_PLAN_CHANGED");
  const realRestore = server.restorePreparedCmsBackup;
  server.restorePreparedCmsBackup = async (...args) => { await realRestore(...args); throw new Error("Simulated lost acknowledgement after durable commit"); };
  const committed = await transfers.commitBackupTransfer(importId, plan.revision, plan.planHash); server.restorePreparedCmsBackup = realRestore;
  assert.equal(committed.status, "committed"); assert.equal(committed.revision, before.revision + 1);
  const after = await server.getCmsState(); assert.deepEqual(after.published, before.published);
  assert.equal((await transfers.commitBackupTransfer(importId, plan.revision, plan.planHash)).revision, committed.revision);
  assert.equal((await server.getCmsState()).revision, after.revision);
  pass("verified imports restore draft/media with exact plans; lost commit acknowledgement resolves without duplicate revisions or live publication");

  const corruptId = randomUUID(); await transfers.startBackupImport(corruptId, manifest);
  for (let chunk = 0; chunk < format.chunkCount(manifest.files[mediaIndex]); chunk++) { const bytes = Buffer.from(chunks.get(`${mediaIndex}-${chunk}`)); if (chunk === 0) bytes[0] ^= 1; await transfers.uploadBackupChunk(corruptId, mediaIndex, chunk, bytes); }
  await assert.rejects(transfers.verifyBackupFile(corruptId, mediaIndex), (error) => error.code === "BACKUP_INVALID");
  assert.deepEqual(fs.readFileSync(path.join(recovery, manifest.files[mediaIndex].name)), image, "Bad import never overwrites a good existing file");
  const job = await store.ownedBackupTransfer(corruptId); job.status = "committing"; job.commitRevision = after.revision + 2; job.expiresAt = "2000-01-01T00:00:00.000Z";
  await server.cmsBackupTransaction(() => store.saveBackupTransfer(job));
  await assert.rejects(transfers.deleteBackupTransfer(corruptId), (error) => error.code === "SAVE_UNCERTAIN");
  assert.equal(await store.backupTransferReferences(path.basename(manifest.files[mediaIndex].name)), true);
  pass("corrupt imported bytes cannot replace existing media and uncertain expired commits remain protected");

  process.env.CMS_LOCAL_DATA_DIR = source; const sourceJob = await store.ownedBackupTransfer(id); sourceJob.expiresAt = "2000-01-01T00:00:00.000Z";
  await server.cmsBackupTransaction(() => store.saveBackupTransfer(sourceJob));
  await assert.rejects(transfers.downloadBackupChunk(id, mediaIndex, 0), (error) => error.code === "BACKUP_EXPIRED");
  assert.ok((await server.cleanupCmsMedia()).deletedIds.includes(staged.upload.id));
  assert.equal((await transfers.deleteBackupTransfer(id)).removed, true);
  assert.equal((await transfers.listBackupTransfers()).length, 0);
  pass("expired settled transfers stop serving chunks, release only unreferenced pins and support authorized manual removal");

  const large = structuredClone(manifest); large.files = [{ name: "state.json", bytes: 17 * 1024 * 1024, sha256: sha("bounded cleanup") }, { name: "uploads.json", bytes: 2, sha256: sha("{}") }]; large.totalBytes = large.files.reduce((sum, file) => sum + file.bytes, 0); large.manifestHash = sha(format.manifestPayload(large));
  const largeId = randomUUID(); await transfers.startBackupImport(largeId, large);
  const partialRemoval = await transfers.deleteBackupTransfer(largeId);
  assert.deepEqual(partialRemoval, { removed: false, completed: 32, total: 35 });
  assert.equal((await transfers.getBackupTransfer(largeId)).status, "removing");
  await assert.rejects(transfers.startBackupImport(largeId, large), (error) => error.code === "BACKUP_STATE");
  assert.deepEqual(await transfers.deleteBackupTransfer(largeId), { removed: true, completed: 35, total: 35 });
  pass("large transfer removal is bounded and resumes from its durable cursor without accepting new chunks");
  console.log(`PASS: ${groups} resumable backup groups; isolated local data only, no providers.`);
} finally {
  for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key]; Object.assign(process.env, previous);
  for (const directory of [source, recovery]) { const relative = path.relative(output, directory); assert.ok(relative.startsWith("backup-transfer-") && !relative.startsWith("..") && !path.isAbsolute(relative)); fs.rmSync(directory, { recursive: true, force: true }); }
}

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), modules = new Map();
function load(relative) {
  const filename = path.resolve(root, relative); if (modules.has(filename)) return modules.get(filename).exports;
  const record = { exports: {} }; modules.set(filename, record);
  const require = (name) => { assert.ok(name.startsWith(".")); return load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`))); };
  new Function("require", "module", "exports", ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(require, record, record.exports);
  return record.exports;
}
class MemoryFolder {
  constructor(name = "test-backup") { this.name = name; this.files = new Map(); this.directories = new Map(); }
  async getFileHandle(name, options = {}) {
    if (!this.files.has(name)) { if (!options.create) throw new DOMException("Not found", "NotFoundError"); this.files.set(name, new Uint8Array()); }
    return {
      getFile: async () => new Blob([this.files.get(name)]),
      createWritable: async () => {
        let value;
        return { write: async (bytes) => { value = typeof bytes === "string" ? new TextEncoder().encode(bytes) : Uint8Array.from(bytes); }, close: async () => { this.files.set(name, value); }, abort: async () => undefined };
      },
    };
  }
  async getDirectoryHandle(name, options = {}) {
    if (!this.directories.has(name)) { if (!options.create) throw new DOMException("Not found", "NotFoundError"); this.directories.set(name, new MemoryFolder(name)); }
    return this.directories.get(name);
  }
  async removeEntry(name) { if (!this.files.delete(name)) throw new DOMException("Not found", "NotFoundError"); }
}
const previousFetch = globalThis.fetch, previousLocation = globalThis.location;
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex"), origin = "http://127.0.0.1:3100";
const format = load("src/lib/cms/backup-format.ts"), client = load("src/lib/cms/backup-folder.ts");
const media = new Uint8Array(format.BACKUP_CHUNK_BYTES + 97).fill(42), files = new Map([[`media/${sha(media)}.png`, media], ["state.json", new TextEncoder().encode('{"draft":{"test":"private"}}')], ["uploads.json", new TextEncoder().encode('{"submissions":[]}')]]);
const base = { format: "vetra-cms-folder", version: 2, createdAt: new Date().toISOString(), sourceRevision: 2, chunkBytes: format.BACKUP_CHUNK_BYTES, totalBytes: [...files.values()].reduce((sum, bytes) => sum + bytes.length, 0), files: [...files].map(([name, bytes]) => ({ name, bytes: bytes.length, sha256: sha(bytes) })) };
const manifest = { ...base, manifestHash: sha(format.manifestPayload(base)) }, jobs = new Map(), requests = [];
let groups = 0, loseUploadResponse = false;
const pass = (message) => { groups++; console.log(`PASS: ${message}`); };
try {
  globalThis.location = { origin };
  globalThis.fetch = async (url, options = {}) => {
    options.signal?.throwIfAborted(); const target = new URL(url, origin), method = options.method || "GET", body = typeof options.body === "string" ? JSON.parse(options.body) : undefined;
    requests.push({ method, url: target.href, action: body?.action });
    if (body?.action === "export" || body?.action === "import") {
      if (!jobs.has(body.id)) jobs.set(body.id, { id: body.id, manifest, received: {}, verified: [], status: "active" });
      return Response.json(jobs.get(body.id));
    }
    if (body?.action === "verify") { jobs.get(body.id).verified.push(body.file); return Response.json({ verified: true }); }
    const file = Number(target.searchParams.get("file")), chunk = Number(target.searchParams.get("chunk")), entry = manifest.files[file], source = files.get(entry.name), bytes = source.slice(chunk * format.BACKUP_CHUNK_BYTES, (chunk + 1) * format.BACKUP_CHUNK_BYTES);
    if (method === "GET") return new Response(bytes, { headers: { "X-Chunk-Sha256": sha(bytes) } });
    assert.equal(method, "PUT"); assert.deepEqual(options.body, bytes);
    const job = jobs.get(target.searchParams.get("id")); job.received[file] = [...new Set([...(job.received[file] || []), chunk])];
    if (loseUploadResponse) { loseUploadResponse = false; throw new Error("Lost upload acknowledgement"); }
    return Response.json({ sha256: sha(bytes) });
  };
  const folder = new MemoryFolder(), paused = new AbortController();
  await assert.rejects(client.exportBackupFolder(folder, () => paused.abort(), paused.signal), (error) => error.name === "AbortError");
  assert.equal(requests.filter((item) => item.method === "GET").length, 1);
  const exportId = await client.exportBackupFolder(folder, () => undefined, new AbortController().signal);
  assert.equal(requests.filter((item) => item.method === "GET" && item.url.includes("file=0&chunk=0")).length, 1, "Resume skips an intact downloaded part");
  assert.deepEqual(await client.readFolderManifest(folder), manifest);
  assert.deepEqual(await client.readFolderFile(folder, manifest, 0), media);
  pass("folder download pauses and resumes verified chunks without downloading intact parts again");

  const chunks = await folder.getDirectoryHandle("chunks"), corrupted = Uint8Array.from(chunks.files.get("0-0.part")); corrupted[0] ^= 1; chunks.files.set("0-0.part", corrupted);
  await client.exportBackupFolder(folder, () => undefined, new AbortController().signal);
  assert.equal(requests.filter((item) => item.method === "GET" && item.url.includes("file=0&chunk=0")).length, 2);
  assert.deepEqual(await client.readFolderFile(folder, manifest, 0), media);
  pass("changed local chunks are downloaded again and every completed file is verified");
  const intactFirst = chunks.files.get("0-0.part"), intactSecond = chunks.files.get("0-1.part");
  chunks.files.set("0-0.part", intactFirst.slice(0, -1)); chunks.files.set("0-1.part", new Uint8Array([intactFirst.at(-1), ...intactSecond]));
  await assert.rejects(client.readFolderFile(folder, manifest, 0), /chunk size/, "Repartitioning intact bytes still violates the chunk contract");
  chunks.files.set("0-0.part", intactFirst); chunks.files.set("0-1.part", intactSecond);

  loseUploadResponse = true;
  await assert.rejects(client.importBackupFolder(folder, manifest, () => undefined, new AbortController().signal), /Lost upload acknowledgement/);
  const restored = await client.importBackupFolder(folder, manifest, () => undefined, new AbortController().signal);
  assert.equal(restored.committed, false); assert.equal(jobs.get(restored.id).verified.length, manifest.files.length);
  assert.equal(requests.filter((item) => item.method === "PUT" && item.url.includes("file=0&chunk=0")).length, 1, "Server-confirmed chunk survives a lost response");
  assert.ok(!requests.some((item) => item.action === "commit"), "Transferring files never publishes or restores without review");
  pass("folder restore resumes server-confirmed uploads after a lost acknowledgement and stops before commit");

  const job = jobs.get(restored.id); job.status = "committing"; job.inspectRevision = 9; job.inspectHash = "reviewed-plan";
  const uncertain = await client.importBackupFolder(folder, manifest, () => undefined, new AbortController().signal);
  assert.deepEqual(uncertain, { id: job.id, resolving: true, revision: 9, planHash: "reviewed-plan" });
  const receipts = folder.files.get("restore-progress.json");
  assert.equal(await client.clearFolderRestoreProgress(folder, randomUUID()), false); assert.deepEqual(folder.files.get("restore-progress.json"), receipts);
  assert.equal(await client.clearFolderRestoreProgress(folder, job.id), true);
  assert.ok(!folder.files.has("restore-progress.json"));
  assert.ok(folder.files.has("manifest.json") && folder.directories.has("chunks"));
  pass("uncertain outcomes retain their exact review; removing another job never clears the selected restore receipt");

  const invalid = { ...manifest, sourceRevision: 99 }; folder.files.set("manifest.json", new TextEncoder().encode(JSON.stringify(invalid)));
  await assert.rejects(client.readFolderManifest(folder), /checksum/);
  assert.ok(jobs.has(exportId));
  console.log(`PASS: ${groups} browser-folder groups; in-memory handles and mocked transport, no native picker or providers.`);
} finally {
  globalThis.fetch = previousFetch;
  if (previousLocation === undefined) delete globalThis.location; else globalThis.location = previousLocation;
}

import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { emitKeypressEvents } from "node:readline";

const command = process.argv[2], option = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
if (!["export", "restore", "status", "remove"].includes(command) || !option("url") || !option("directory")) throw new Error("Usage: node scripts/cms-backup.mjs export|restore|status|remove --url=https://your-store.example --directory=./private-backup");
const origin = new URL(option("url"));
assert.ok((origin.protocol === "https:" || (origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname))) && origin.pathname === "/" && !origin.username && !origin.password && !origin.search && !origin.hash, "Use a single HTTPS origin or loopback HTTP preview.");
const directory = path.resolve(option("directory")), chunks = path.join(directory, "chunks"), CHUNK = 512 * 1024;
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const filePath = (name) => { const target = path.resolve(directory, name), relative = path.relative(directory, target); assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative)); return target; };
async function json(name) { try { return JSON.parse(await readFile(filePath(name), "utf8")); } catch (error) { if (error.code === "ENOENT") return null; throw error; } }
async function save(name, value) {
  const target = filePath(name), temporary = `${target}.${randomUUID()}.tmp`;
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 }); await writeFile(temporary, value, { mode: 0o600 }); await rename(temporary, target);
}
async function question(prompt) { const input = createInterface({ input: process.stdin, output: process.stdout }); try { return await input.question(prompt); } finally { input.close(); } }
async function password() {
  if (!process.stdin.isTTY) throw new Error("Configured sign-in needs an interactive terminal; credentials are never accepted in command arguments or saved to backup files.");
  process.stdout.write("Password (hidden): "); emitKeypressEvents(process.stdin); process.stdin.setRawMode(true); process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (error) => { process.stdin.off("keypress", key); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write("\n"); if (error) reject(error); else resolve(value); };
    const key = (text, pressed) => { if (pressed?.ctrl && pressed.name === "c") return finish(new Error("Sign-in cancelled.")); if (pressed?.name === "return") return finish(); if (pressed?.name === "backspace") value = value.slice(0, -1); else if (text && !pressed?.ctrl && !pressed?.meta) value += text; };
    process.stdin.on("keypress", key);
  });
}
let cookie = "";
async function call(route, options = {}) {
  const response = await fetch(new URL(route, origin), { redirect: "error", signal: AbortSignal.timeout(120000), ...options, headers: { origin: origin.origin, ...(cookie ? { cookie } : {}), ...options.headers } });
  if (!response.ok) { let error; try { error = await response.json(); } catch { /* Hosting limits can return HTML. */ } throw new Error(error?.error || `Request failed (${response.status}). Your transfer can be resumed from the same folder.`); }
  return response;
}
const api = "/api/cms/backup-transfer";
const post = async (body) => (await call(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
function validateManifest(m) {
  assert.ok(m?.format === "vetra-cms-folder" && m.version === 2 && m.chunkBytes === CHUNK && Array.isArray(m.files) && m.files.length >= 2 && m.files.length <= 10032, "Unsupported backup manifest.");
  const payload = { format: m.format, version: m.version, createdAt: m.createdAt, sourceRevision: m.sourceRevision, chunkBytes: m.chunkBytes, totalBytes: m.totalBytes, files: m.files };
  assert.equal(sha(JSON.stringify(payload)), m.manifestHash, "Manifest checksum failed.");
  const names = new Set(); let total = 0, metadata = 0;
  for (const file of m.files) {
    const media = /^media\/[a-f0-9]{64}\.(jpg|png|webp|gif)$/.test(file.name);
    assert.ok(media || /^(state|uploads)\.json$|^history\/\d{1,16}-[a-f0-9]{16}\.json$/.test(file.name));
    assert.ok(!names.has(file.name) && Number.isSafeInteger(file.bytes) && file.bytes > 0 && file.bytes <= (media ? 5 : 32) * 1024 * 1024 && /^[a-f0-9]{64}$/.test(file.sha256));
    names.add(file.name); total += file.bytes; if (!media) metadata += file.bytes;
  }
  assert.ok(names.has("state.json") && names.has("uploads.json") && total === m.totalBytes && total <= 2 * 1024 ** 3 && metadata <= 128 * 1024 ** 2); return m;
}
const parts = (file) => Math.ceil(file.bytes / CHUNK);
const chunkName = (file, chunk) => `chunks/${file}-${chunk}.part`;
async function verifyFile(manifest, file) {
  const hash = createHash("sha256"); let bytes = 0;
  for (let chunk = 0; chunk < parts(manifest.files[file]); chunk++) { const part = await readFile(filePath(chunkName(file, chunk))); assert.equal(part.length, Math.min(CHUNK, manifest.files[file].bytes - chunk * CHUNK), "Chunk size mismatch"); hash.update(part); bytes += part.length; }
  assert.equal(bytes, manifest.files[file].bytes); assert.equal(hash.digest("hex"), manifest.files[file].sha256, `Backup checksum failed: ${manifest.files[file].name}`);
}
function progress(completed, total, file) { process.stdout.write(`${process.stdout.isTTY ? "\r" : ""}${(100 * completed / total).toFixed(1)}% — ${file}${process.stdout.isTTY ? "                    " : "\n"}`); }

const session = await (await call("/api/cms/session")).json();
const credentials = session.mode === "configured" ? { email: await question("Owner email: "), password: await password() } : {};
if (!["local", "configured"].includes(session.mode)) throw new Error("CMS is unavailable. Restore its configuration before transferring a backup.");
const login = await call("/api/cms/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", ...credentials }) });
cookie = login.headers.get("set-cookie")?.split(";")[0] || ""; credentials.password = "";
assert.ok(cookie, "Sign-in did not create a session.");
try {
  if (command === "status" || command === "remove") {
    const result = await (await call(api)).json();
    if (command === "status") console.log(JSON.stringify(result.transfers, null, 2));
    else {
      const id = option("id"); assert.ok(id && result.transfers.some((job) => job.id === id), "Select your transfer with --id=<id> after checking status.");
      let removed;
      do { removed = await (await call(api, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })).json(); console.log(`Removed ${removed.completed} / ${removed.total} temporary parts`); } while (!removed.removed);
    }
  } else if (command === "export") {
    await mkdir(chunks, { recursive: true, mode: 0o700 });
    let receipt = await json("export-progress.json");
    if (receipt) assert.equal(receipt.origin, origin.origin, "Resume the export from its original origin.");
    else { assert.equal(await json("manifest.json"), null, "Choose an empty folder; this one contains another backup."); receipt = { origin: origin.origin, id: randomUUID(), chunks: {} }; await save("export-progress.json", JSON.stringify(receipt)); }
    const job = await post({ action: "export", id: receipt.id }), manifest = validateManifest(job.manifest);
    if (receipt.manifestHash) assert.equal(receipt.manifestHash, manifest.manifestHash);
    receipt.manifestHash = manifest.manifestHash; await save("manifest.json", JSON.stringify(manifest, null, 2)); let completed = 0;
    for (const [file, entry] of manifest.files.entries()) {
      for (let chunk = 0; chunk < parts(entry); chunk++) {
        const key = `${file}-${chunk}.part`; let bytes;
        if (receipt.chunks[key]) { try { const existing = await readFile(filePath(chunkName(file, chunk))); if (sha(existing) === receipt.chunks[key]) bytes = existing; } catch (error) { if (error.code !== "ENOENT") throw error; } }
        if (!bytes) { const response = await call(`${api}?id=${job.id}&file=${file}&chunk=${chunk}`); bytes = Buffer.from(await response.arrayBuffer()); assert.equal(sha(bytes), response.headers.get("X-Chunk-Sha256")); await save(chunkName(file, chunk), bytes); receipt.chunks[key] = sha(bytes); await save("export-progress.json", JSON.stringify(receipt)); }
        completed += bytes.length;
      }
      try { await verifyFile(manifest, file); }
      catch (error) { for (let chunk = 0; chunk < parts(entry); chunk++) delete receipt.chunks[`${file}-${chunk}.part`]; await save("export-progress.json", JSON.stringify(receipt)); throw error; }
      progress(completed, manifest.totalBytes, entry.name);
    }
    console.log(`\nBackup complete and verified: ${directory}\nKeep manifest.json and every file under chunks. Resume uses this same command and folder.`);
  } else {
    const manifest = validateManifest(await json("manifest.json")); let receipt = await json("restore-progress.json");
    if (!receipt || receipt.origin !== origin.origin || receipt.manifestHash !== manifest.manifestHash || option("new") === "true") { receipt = { origin: origin.origin, id: randomUUID(), manifestHash: manifest.manifestHash }; await save("restore-progress.json", JSON.stringify(receipt)); }
    const job = await post({ action: "import", id: receipt.id, manifest });
    if (job.status === "committed") console.log(`Restore already completed at revision ${job.committedRevision}. It remains a draft until published.`);
    else {
      let inspection;
      if (job.status === "committing") inspection = { revision: job.inspectRevision, planHash: job.inspectHash, changes: [] };
      else {
        let completed = 0;
        for (const [file, entry] of manifest.files.entries()) {
          await verifyFile(manifest, file);
          if (!job.verified.includes(file)) {
            for (let chunk = 0; chunk < parts(entry); chunk++) if (!job.received[file]?.includes(chunk)) { const bytes = await readFile(filePath(chunkName(file, chunk))); const response = await (await call(`${api}?id=${job.id}&file=${file}&chunk=${chunk}`, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: bytes })).json(); assert.equal(response.sha256, sha(bytes)); }
            await post({ action: "verify", id: job.id, file });
          }
          completed += entry.bytes; progress(completed, manifest.totalBytes, entry.name);
        }
        inspection = await post({ action: "inspect", id: job.id });
      }
      console.log(`\nDraft recovery review at revision ${inspection.revision}. Current live content stays unchanged.`);
      for (const change of inspection.changes) console.log(`${change.change}: ${change.title} — ${change.fields.join(", ")}`);
      console.log(`Plan: ${inspection.planHash}`);
      const confirmed = option("confirm-plan") === inspection.planHash || (process.stdin.isTTY && await question("Type RESTORE to apply this reviewed draft recovery: ") === "RESTORE");
      if (!confirmed) console.log("Prepared files retained. Repeat restore with --confirm-plan=<the reviewed plan> to confirm; a changed revision requires another review.");
      else { const result = await post({ action: "commit", id: job.id, revision: inspection.revision, planHash: inspection.planHash }); console.log(`Restore confirmed at revision ${result.revision}. Review the draft in CMS before publishing.`); }
    }
  }
} finally {
  await fetch(new URL("/api/cms/session", origin), { method: "DELETE", headers: { origin: origin.origin, cookie }, signal: AbortSignal.timeout(10000) }).catch(() => undefined);
  cookie = "";
}

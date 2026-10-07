import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), output = path.join(root, "output"), origin = new URL(process.argv[2]);
const data = path.resolve(process.env.CMS_LOCAL_DATA_DIR || "."), relativeData = path.relative(output, data);
assert.ok(process.argv.includes("--isolated") && /^cms-live-[\w-]+$/.test(relativeData) && !path.isAbsolute(relativeData), "Use the owned disposable live runner.");
assert.ok(origin.protocol === "http:" && ["127.0.0.1", "localhost"].includes(origin.hostname));
const directory = await mkdtemp(path.join(output, "backup-cli-"));
async function cli(command, extra = []) {
  const child = spawn(process.execPath, [path.join(root, "scripts", "cms-backup.mjs"), command, `--url=${origin.origin}`, `--directory=${directory}`, ...extra], { cwd: root, env: process.env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let text = ""; child.stdout.on("data", (chunk) => { text += chunk.toString(); }); child.stderr.on("data", (chunk) => { text += chunk.toString(); });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error(`Backup CLI timed out. ${text.slice(-3000)}`)); }, 120000);
    child.once("error", (error) => { clearTimeout(timer); reject(error); }); child.once("exit", (code) => { clearTimeout(timer); if (code === 0) resolve(); else reject(new Error(`Backup CLI exited ${code}: ${text.slice(-3000)}`)); });
  });
  return text;
}
let cookie = "";
async function request(route, body) {
  const response = await fetch(new URL(route, origin), { method: body ? "POST" : "GET", headers: { origin: origin.origin, ...(cookie ? { cookie } : {}), "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000) });
  assert.ok(response.ok, `CMS request failed: ${response.status}`); return response;
}
try {
  const login = await request("/api/cms/session", { action: "login" }); cookie = login.headers.get("set-cookie").split(";")[0];
  const before = (await (await request("/api/cms")).json()).state;
  assert.match(await cli("export"), /Backup complete and verified/);
  const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
  assert.equal(manifest.sourceRevision, before.revision); assert.equal(manifest.format, "vetra-cms-folder");
  assert.match(await cli("export"), /Backup complete and verified/, "Export resumes across separate sign-in sessions");
  const preparation = await cli("restore"), plan = preparation.match(/Plan: ([a-f0-9]{64})/);
  assert.ok(plan, preparation); assert.match(preparation, /Prepared files retained/);
  assert.equal((await (await request("/api/cms")).json()).state.revision, before.revision, "Preparing never saves content");
  const completed = await cli("restore", [`--confirm-plan=${plan[1]}`]); assert.match(completed, /Restore confirmed at revision/);
  const after = (await (await request("/api/cms")).json()).state;
  assert.equal(after.revision, before.revision + 1); assert.deepEqual(after.published, before.published);
  assert.match(await cli("restore"), /Restore already completed/, "Commit acknowledgement is stable across sign-in sessions");
  assert.equal((await (await request("/api/cms")).json()).state.revision, after.revision);
  for (const name of ["export-progress.json", "restore-progress.json"]) { const receipt = JSON.parse(await readFile(path.join(directory, name), "utf8")); assert.match(await cli("remove", [`--id=${receipt.id}`]), /Removed \d+ \/ \d+ temporary parts/); }
  console.log("PASS: actual CLI export/resume, prepared review, draft restore, idempotent acknowledgement and manual removal via authenticated HTTP.");
} finally {
  if (cookie) await fetch(new URL("/api/cms/session", origin), { method: "DELETE", headers: { origin: origin.origin, cookie }, signal: AbortSignal.timeout(10000) }).catch(() => undefined);
  const relative = path.relative(output, directory); assert.ok(/^backup-cli-[\w-]+$/.test(relative) && !path.isAbsolute(relative)); await rm(directory, { recursive: true, force: true });
}

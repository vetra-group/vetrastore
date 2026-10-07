import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const port = Number(option("port") || 3310);
assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535, "Use a local test port between 1024 and 65535.");
const origin = `http://127.0.0.1:${port}`, release = process.argv.includes("--release");
const mediaOnly = process.argv.includes("--media-only");
assert.ok(!mediaOnly || !["--release", "--storefront-only", "--forms-only", "--ui-only", "--backup-only", "--loading-only", "--identity-only"].some((flag) => process.argv.includes(flag)), "Choose --media-only separately from other test scopes.");
const expectedSiteUrl = option("expected-site-url") || process.env.NEXT_PUBLIC_SITE_URL || origin;
const output = path.join(root, "output");
await mkdir(output, { recursive: true });
const directory = await mkdtemp(path.join(output, "cms-live-"));
const relative = path.relative(output, directory);
assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative) && /^cms-live-[\w-]+$/.test(relative), "Disposable CMS data must stay inside the project's output folder.");
// Explicit empty values stop Next's .env files from re-enabling a real provider.
// A temporary filesystem path alone cannot isolate a configured remote CMS.
const env = {
  ...process.env,
  NEXT_PUBLIC_DEMO_MODE: "true", SITE_NOINDEX: "true", CMS_LOCAL_DATA_DIR: directory,
  CMS_STORAGE: "", CMS_AUTH_MODE: "", CMS_SESSION_SECRET: "", CMS_STAFF_ACCOUNTS: "", CMS_CLOUDINARY_FOLDER: "",
  MONGODB_URI: "", MONGODB_DB: "vetra_disposable_test", ORDER_ENQUIRIES_ENABLED: "false",
  CLOUDINARY_MEDIA_ENABLED: "false", CLOUDINARY_CLOUD_NAME: "", CLOUDINARY_API_KEY: "", CLOUDINARY_API_SECRET: "",
};
delete env.VERCEL;
let serverOutput = "", previousServerOutput = "", server, exited = true, serverError;
function startServer() {
  serverOutput = ""; exited = false; serverError = undefined;
  server = spawn(process.execPath, [path.join(root, "node_modules", "next", "dist", "bin", "next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: root, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.on("data", (chunk) => { serverOutput = (serverOutput + chunk.toString()).slice(-10000); });
  server.stderr.on("data", (chunk) => { serverOutput = (serverOutput + chunk.toString()).slice(-10000); });
  server.once("exit", () => { exited = true; });
  server.once("error", (error) => { serverError = error; exited = true; });
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function stopServer() {
  if (!exited) server.kill();
  const deadline = Date.now() + 5000;
  while (!exited && Date.now() < deadline) await delay(50);
  if (!exited) { server.kill("SIGKILL"); await delay(100); }
}
async function checkServer() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (serverError) throw serverError;
    if (exited) throw new Error(`Disposable preview could not start. ${serverOutput}`);
    try {
      const response = await fetch(`${origin}/api/cms/session`, { signal: AbortSignal.timeout(1000) });
      const session = await response.json();
      if (response.status === 200 && session.mode === "local" && serverOutput.includes("Ready")) return;
    } catch { /* The owned preview is still starting. */ }
    await delay(100);
  }
  throw new Error(`Disposable preview did not become ready. ${serverOutput}`);
}
async function run(script, args = []) {
  const child = spawn(process.execPath, [path.join(root, "scripts", script), origin, "--isolated", ...args], { cwd: root, env, windowsHide: true, stdio: "inherit" });
  await new Promise((resolve, reject) => {
    const limit = script.includes("browser") ? 300000 : 180000;
    const timeout = setTimeout(() => { child.kill(); reject(new Error(`${script} exceeded its ${limit / 1000}-second limit.`)); }, limit);
    child.once("error", (error) => { clearTimeout(timeout); reject(error); });
    child.once("exit", (code) => { clearTimeout(timeout); if (code === 0) resolve(); else reject(new Error(`${script} exited with ${code}`)); });
  });
}
try {
  startServer();
  await checkServer();
  if (process.argv.includes("--identity-only")) {
    await run("smoke.mjs");
    await run("check-seo.mjs");
    await run("check-store-identity-browser.mjs");
  } else if (process.argv.includes("--loading-only")) {
    await run("smoke.mjs");
    await run("check-loading-browser.mjs");
  } else if (process.argv.includes("--storefront-only")) {
    await run("check-storefront-browser.mjs");
    await run("check-customer-forms-browser.mjs");
    await run("check-storefront-accessibility.mjs");
  } else if (process.argv.includes("--forms-only")) {
    await run("check-customer-forms-browser.mjs");
  } else if (process.argv.includes("--ui-only")) {
    await run("check-browser.mjs");
    console.log("PASS: automated browser journeys completed against disposable CMS data.");
  } else if (process.argv.includes("--backup-only")) {
    await run("check-backup-cli-http.mjs");
  } else if (mediaOnly) {
    await run("check-cms-media-http.mjs");
  } else {
  if (release) {
    // Run public defaults before mutation tests create their disposable records.
    await run("check-release-http.mjs", [`--expected-site-url=${expectedSiteUrl}`]);
    await run("smoke.mjs");
  }
  await run("check-cms-http.mjs");
  await run("check-cms-media-http.mjs");
  await run("check-workflows-http.mjs");
  await run("check-workspace-http.mjs");
  // The CLI intentionally signs in afresh for each command. Give that separate
  // journey its own server lifecycle instead of consuming the auth throttle
  // already exercised by the other suites. Keep the same disposable content.
  await stopServer();
  if (!exited) throw new Error("The owned preview did not stop before backup CLI isolation.");
  previousServerOutput += `${serverOutput}\n--- Backup CLI process isolation ---\n`;
  startServer(); await checkServer();
  await run("check-backup-cli-http.mjs");
  }
  console.log("PASS: live CMS tests completed against isolated content. Your CMS and trash were not changed.");
  if (release) console.log("PASS: local release rehearsal covers domain/indexing/health, localized public routes and private publication/recovery workflows. No deployment or live-provider connection was performed.");
  if (process.argv.includes("--browser")) {
    console.log(`Browser QA preview: http://localhost:${port}/cms. Press Enter to stop and remove disposable server data.`);
    await new Promise((resolve) => {
      const finish = () => { process.stdin.pause(); process.stdin.off("data", finish); process.stdin.off("end", finish); resolve(); };
      if (process.stdin.destroyed || process.stdin.readableEnded) return finish();
      process.stdin.once("data", finish); process.stdin.once("end", finish); process.stdin.resume();
    });
  }
} finally {
  const logDirectory = process.argv.includes("--identity-only") ? path.join(output, "qa", "store-identity") : process.argv.includes("--loading-only") ? path.join(output, "qa", "loading") : process.argv.includes("--storefront-only") || process.argv.includes("--forms-only") ? path.join(output, "qa", "storefront-polish") : process.argv.includes("--ui-only") ? path.join(output, "qa", "browser-regression") : path.join(output, "qa");
  await mkdir(logDirectory, { recursive: true });
  await writeFile(path.join(logDirectory, process.argv.includes("--ui-only") ? "server.log" : process.argv.includes("--backup-only") ? "cms-backup-server.log" : mediaOnly ? "cms-media-server.log" : "cms-release-server.log"), previousServerOutput + serverOutput);
  await stopServer();
  if (exited) await rm(directory, { recursive: true, force: true });
  else console.warn(`Disposable test data retained because the owned preview did not exit: ${directory}`);
}

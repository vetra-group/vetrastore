#!/usr/bin/env node
// One-time local CMS content migration. Dry-run first; apply only its exact plan.
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);
export const migrationId = "blog-content-v1";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const markerName = `${migrationId}.json`;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function loadMigrationSources(projectRoot = root) {
  const cache = new Map(), files = new Map();
  function load(relative) {
    const filename = path.resolve(projectRoot, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const source = fs.readFileSync(filename, "utf8");
    files.set(path.relative(projectRoot, filename), hash(source));
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const moduleRecord = { exports: {} }; cache.set(filename, moduleRecord);
    const localRequire = (name) => {
      if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
      if (name.startsWith(".")) return load(path.relative(projectRoot, path.resolve(path.dirname(filename), `${name}.ts`)));
      return nativeRequire(name);
    };
    new Function("require", "module", "exports", compiled)(localRequire, moduleRecord, moduleRecord.exports);
    return moduleRecord.exports;
  }
  const { journalArticles: articles } = load("src/content/editorial.ts");
  const baselineText = fs.readFileSync(path.join(projectRoot, "src/content/legacy-journal-articles.json"), "utf8");
  files.set("src/content/legacy-journal-articles.json", hash(baselineText));
  const baseline = JSON.parse(baselineText);
  const { validateCmsState } = load("src/lib/cms/validation.ts");
  const { defaultState } = load("src/lib/cms/defaults.ts");
  const { cmsMode, cmsDirectory } = load("src/lib/cms/auth.ts");
  return { articles, baseline, validateCmsState, defaultState, cmsMode, cmsDirectory, sourceHash: hash(JSON.stringify([...files].sort(([a], [b]) => a.localeCompare(b)))) };
}

function withoutStatus(article) {
  const copy = structuredClone(article); delete copy.status; return copy;
}

export function reconcileArticles(state, source, baseline) {
  const next = structuredClone(state), changes = [], skipped = [];
  const legacy = new Map(baseline.map((article) => [article.slug, article]));
  const current = new Map(source.map((article) => [article.slug, article]));
  if (legacy.size !== baseline.length || current.size !== source.length) throw new Error("Duplicate source or baseline article slugs.");
  if ([...legacy.keys()].some((slug) => !current.has(slug))) throw new Error("A baseline article is missing from the current source; review the migration.");
  const existingAnywhere = new Set([
    ...state.draft.articles.map((article) => article.slug),
    ...state.published.articles.map((article) => article.slug),
    ...(state.trash || []).filter((entry) => entry.kind === "article").map((entry) => entry.item.slug),
  ]);
  for (const snapshot of ["draft", "published"]) {
    next[snapshot].articles = next[snapshot].articles.map((article) => {
      const original = legacy.get(article.slug), replacement = current.get(article.slug);
      if (!original || !replacement) return article;
      if (!isDeepStrictEqual(withoutStatus(article), withoutStatus(original))) {
        skipped.push({ snapshot, slug: article.slug, reason: "CMS content differs from legacy baseline" });
        return article;
      }
      if (isDeepStrictEqual(withoutStatus(article), withoutStatus(replacement))) return article;
      changes.push({ snapshot, slug: article.slug, action: "update", status: article.status });
      return { ...structuredClone(replacement), status: article.status };
    });
    for (const article of source) {
      if (legacy.has(article.slug)) continue;
      if (existingAnywhere.has(article.slug)) {
        skipped.push({ snapshot, slug: article.slug, reason: "Already present in draft, published, or trash" });
        continue;
      }
      next[snapshot].articles.push({ ...structuredClone(article), status: "published" });
      changes.push({ snapshot, slug: article.slug, action: "add", status: "published" });
    }
  }
  return { next, changes, skipped };
}

async function optionalRead(filename) {
  try { return await fsp.readFile(filename, "utf8"); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

function backupPath(directory, basename) {
  if (typeof basename !== "string" || !/^[a-z0-9.-]+\.json$/.test(basename) || basename !== path.basename(basename)) throw new Error("Invalid migration backup reference.");
  return path.join(directory, "backups", basename);
}

async function readPlan(directory, sources) {
  const filename = path.join(directory, "state.json");
  let stateText;
  try {
    if ((await fsp.stat(filename)).size > 32 * 1024 * 1024) throw new Error("CMS state exceeds the supported size.");
    stateText = await fsp.readFile(filename, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") throw new Error("No saved local CMS state exists. Source defaults already provide the blog; no migration is needed.");
    throw error;
  }
  const state = JSON.parse(stateText); sources.validateCmsState(state);
  const stateHash = hash(stateText);
  const markerText = await optionalRead(path.join(directory, "migrations", markerName));
  const marker = markerText === null ? null : JSON.parse(markerText);
  const input = { migrationId, directory: path.resolve(directory), stateHash, sourceHash: sources.sourceHash, markerHash: hash(markerText || "") };
  let disposition = "ready", result;
  if (marker) {
    if (marker.version !== 1 || marker.id !== migrationId || !["prepared", "complete"].includes(marker.phase)) throw new Error("Unrecognized migration receipt; preserved for review.");
    if (marker.phase === "complete") disposition = "complete";
    else if (stateHash === marker.afterHash || state.audit.some((entry) => entry.id === marker.auditId && entry.action === `Applied ${migrationId}`)) disposition = "confirm-complete";
    else if (stateHash === marker.beforeHash && sources.sourceHash === marker.sourceHash) {
      const targetText = await fsp.readFile(backupPath(directory, marker.target), "utf8");
      if (hash(targetText) !== marker.afterHash) throw new Error("Migration target backup does not match its receipt.");
      const target = JSON.parse(targetText); sources.validateCmsState(target);
      disposition = "resume"; result = { next: target, changes: marker.changes, skipped: marker.skipped, targetText };
    } else throw new Error("The interrupted migration has an uncertain outcome or changed source. Preserve its receipt/backups and resolve it before retrying.");
  }
  if (disposition === "ready") result = reconcileArticles(state, sources.articles, sources.baseline);
  const preview = { migration: migrationId, directory, disposition, revision: state.revision, changes: result?.changes || [], skipped: result?.skipped || [], planHash: hash(JSON.stringify(input)) };
  return { preview, state, stateText, stateHash, marker, result };
}

export async function inspectMigration(directory, sources) {
  return (await readPlan(directory, sources)).preview;
}

async function atomicWrite(filename, bytes) {
  await fsp.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
  const temporary = `${filename}.${randomUUID()}.tmp`;
  try {
    const handle = await fsp.open(temporary, "wx", 0o600);
    try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
    await fsp.rename(temporary, filename);
  } finally { await fsp.unlink(temporary).catch((error) => { if (error.code !== "ENOENT") throw error; }); }
}

async function withLock(directory, task, timeoutMs = 5000) {
  const lockfile = path.join(directory, "write.lock"), deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      const handle = await fsp.open(lockfile, "wx", 0o600);
      try { await handle.writeFile(JSON.stringify({ pid: process.pid })); } finally { await handle.close(); }
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      // Do not remove an uncertain or stale server lock from a maintenance script.
      if (Date.now() >= deadline) throw new Error("CMS write.lock is held. Retry after the current save completes.");
      await delay(50);
    }
  }
  try { return await task(); } finally { await fsp.unlink(lockfile); }
}

export async function applyMigration(directory, expectedPlan, sourceProvider = loadMigrationSources, options = {}) {
  if (!/^[a-f0-9]{64}$/.test(expectedPlan || "")) throw new Error("Apply requires --expected-plan followed by the fresh dry-run SHA-256.");
  return withLock(directory, async () => {
    const sources = sourceProvider();
    if (sources.cmsMode && sources.cmsMode() !== "local") throw new Error("This migration supports only the configured local CMS mode.");
    const plan = await readPlan(directory, sources);
    if (plan.preview.planHash !== expectedPlan) throw new Error("Stale migration plan: state, source, or receipt changed. Run a new dry-run and review it.");
    if (plan.preview.disposition === "complete") return { ...plan.preview, applied: false };
    const markerFile = path.join(directory, "migrations", markerName);
    let marker = plan.marker, targetText = plan.result?.targetText;
    if (plan.preview.disposition === "ready") {
      const timestamp = new Date().toISOString(), auditId = randomUUID();
      const next = plan.result.next;
      if (next.audit.length >= 500) throw new Error("CMS audit is full; migration refuses to discard existing activity. Review the audit before migration.");
      next.revision += 1;
      next.audit.unshift({ id: auditId, action: `Applied ${migrationId}`, at: timestamp, actor: "Local content migration" });
      sources.validateCmsState(next);
      targetText = JSON.stringify(next, null, 2);
      if (Buffer.byteLength(targetText) > 32 * 1024 * 1024) throw new Error("Migration result exceeds the CMS snapshot limit.");
      const backupBase = `${migrationId}-${timestamp.replace(/[^0-9]/g, "")}-${auditId}`;
      marker = { version: 1, id: migrationId, phase: "prepared", planHash: expectedPlan, sourceHash: sources.sourceHash, beforeHash: plan.stateHash, afterHash: hash(targetText), auditId, backup: `${backupBase}.before.json`, target: `${backupBase}.after.json`, changes: plan.preview.changes, skipped: plan.preview.skipped, preparedAt: timestamp };
      await atomicWrite(backupPath(directory, marker.backup), plan.stateText);
      await atomicWrite(backupPath(directory, marker.target), targetText);
      // Persist the intent before touching state so later retries cannot revive deleted articles.
      await atomicWrite(markerFile, JSON.stringify(marker, null, 2));
    }
    if (plan.preview.disposition !== "confirm-complete") {
      await (options.writeState || atomicWrite)(path.join(directory, "state.json"), targetText);
      if (hash(await fsp.readFile(path.join(directory, "state.json"), "utf8")) !== marker.afterHash) throw new Error("State readback is uncertain; migration backups and prepared receipt retained.");
    }
    await atomicWrite(markerFile, JSON.stringify({ ...marker, phase: "complete", completedAt: new Date().toISOString() }, null, 2));
    return { ...plan.preview, disposition: "complete", applied: plan.preview.disposition !== "confirm-complete", backup: backupPath(directory, marker.backup) };
  }, options.lockTimeoutMs);
}

async function main() {
  const args = process.argv.slice(2), apply = args.includes("--apply");
  const expectedIndex = args.indexOf("--expected-plan");
  const accepted = args.every((arg, index) => arg === "--apply" || arg === "--expected-plan" || index === expectedIndex + 1 && expectedIndex >= 0);
  if (!accepted || !apply && expectedIndex !== -1) throw new Error("Usage: node scripts/migrate-blog-content.mjs [--apply --expected-plan <sha256>]");
  const { loadEnvConfig } = nativeRequire("@next/env");
  loadEnvConfig(root, false, { info() {}, error() {} });
  const sources = loadMigrationSources();
  if (sources.cmsMode() !== "local") throw new Error("This migration supports only the configured local CMS mode.");
  if (sources.articles.length <= sources.baseline.length) throw new Error("Expanded blog source articles are not ready. Do not complete this migration yet.");
  const directory = sources.cmsDirectory();
  const result = apply ? await applyMigration(directory, args[expectedIndex + 1], loadMigrationSources) : await inspectMigration(directory, sources);
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

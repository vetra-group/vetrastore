import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { applyMigration, inspectMigration, loadMigrationSources, migrationId, reconcileArticles } from "./migrate-blog-content.mjs";

const runtime = loadMigrationSources();
const baseline = structuredClone(runtime.baseline);
const articles = baseline.map((article) => ({ ...structuredClone(article), content: { ...structuredClone(article.content), en: { ...structuredClone(article.content.en), intro: `${article.content.en.intro} Updated selection guidance.` } } }));
articles.push({ ...structuredClone(articles[0]), slug: "new-selection-guide" });
const sources = { ...runtime, baseline, articles, cmsMode: () => "local", sourceHash: "a".repeat(64) };
const fixture = () => {
  const state = runtime.defaultState();
  for (const snapshot of ["draft", "published"]) state[snapshot].articles = baseline.map((article) => ({ ...structuredClone(article), status: "published" }));
  state.draft.settings.storeName = "Unpublished store edit";
  state.published.settings.storeName = "Published store name";
  return state;
};
const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "vetra-blog-migration-"));
let checks = 0;
const pass = (name) => { checks++; console.log(`PASS: ${name}`); };
const file = (directory) => path.join(directory, "state.json");
const receipt = (directory) => path.join(directory, "migrations", `${migrationId}.json`);
async function setup(name, state = fixture()) {
  const directory = path.join(sandbox, name); await fs.mkdir(directory);
  await fs.writeFile(file(directory), JSON.stringify(state, null, 2)); return directory;
}
const plan = (directory, source = sources) => inspectMigration(directory, source);
const apply = (directory, hash, options, source = sources) => applyMigration(directory, hash, () => source, options);
const read = async (directory) => JSON.parse(await fs.readFile(file(directory), "utf8"));

try {
  {
    const state = fixture();
    state.draft.articles[0].content.th.title = "A manual Thai title";
    state.draft.articles[1].status = "archived";
    state.published.articles[1].status = "draft";
    const result = reconcileArticles(state, articles, baseline);
    assert.equal(result.next.draft.articles[0].content.th.title, "A manual Thai title");
    assert.deepEqual(result.next.draft.articles[0], state.draft.articles[0]);
    assert.equal(result.next.published.articles[0].content.en.intro, articles[0].content.en.intro);
    assert.equal(result.next.draft.articles[1].status, "archived");
    assert.equal(result.next.published.articles[1].status, "draft");
    for (const snapshot of ["draft", "published"]) {
      const { articles: beforeArticles, ...before } = state[snapshot];
      const { articles: afterArticles, ...after } = result.next[snapshot];
      assert.ok(afterArticles.length > beforeArticles.length); assert.deepEqual(after, before);
    }
    assert.deepEqual(result.next.trash, state.trash);
    pass("independent draft/published updates preserve custom copy, status and all unrelated content");
  }
  {
    const state = fixture(), time = Date.now();
    state.trash.push({ id: randomUUID(), kind: "article", item: { ...structuredClone(articles.at(-1)), status: "archived" }, position: 0, deletedAt: new Date(time).toISOString(), expiresAt: new Date(time + 30 * 24 * 60 * 60 * 1000).toISOString() });
    state.draft.articles.shift(); state.published.articles.shift();
    const result = reconcileArticles(state, articles, baseline);
    assert.deepEqual(result.next.trash, state.trash);
    assert.equal(result.next.draft.articles.length, baseline.length - 1);
    assert.equal(result.next.published.articles.length, baseline.length - 1);
    const draftOnly = fixture(); draftOnly.draft.articles.push({ ...structuredClone(articles.at(-1)), status: "draft" });
    const separate = reconcileArticles(draftOnly, articles, baseline);
    assert.equal(separate.next.published.articles.some((article) => article.slug === "new-selection-guide"), false);
    pass("deleted legacy articles, trash and draft-only new slugs are never revived or implicitly published");
  }
  {
    const directory = await setup("stale");
    const old = await plan(directory); const current = await read(directory); current.revision++;
    await fs.writeFile(file(directory), JSON.stringify(current)); const exact = await fs.readFile(file(directory), "utf8");
    await assert.rejects(apply(directory, old.planHash), /Stale migration plan/);
    assert.equal(await fs.readFile(file(directory), "utf8"), exact);
    const latest = await plan(directory);
    await assert.rejects(apply(directory, latest.planHash, undefined, { ...sources, sourceHash: "b".repeat(64) }), /Stale migration plan/);
    await assert.rejects(fs.access(receipt(directory)), { code: "ENOENT" });
    pass("stale state or source plan refuses all migration writes");
  }
  {
    const directory = await setup("normal"), before = await fs.readFile(file(directory), "utf8");
    const dry = await plan(directory); const outcome = await apply(directory, dry.planHash);
    assert.equal(outcome.applied, true); assert.equal(await fs.readFile(outcome.backup, "utf8"), before);
    const saved = await read(directory); runtime.validateCmsState(saved);
    assert.equal(saved.revision, 1); assert.equal(saved.audit[0].action, `Applied ${migrationId}`);
    assert.equal(saved.publishedAt, null);
    for (const snapshot of ["draft", "published"]) saved[snapshot].articles = saved[snapshot].articles.filter((article) => article.slug !== "new-selection-guide");
    saved.revision++; saved.audit = []; // Even after later deletion and audit rotation, completion remains durable.
    await fs.writeFile(file(directory), JSON.stringify(saved)); const exact = await fs.readFile(file(directory), "utf8");
    const repeat = await plan(directory); assert.equal(repeat.disposition, "complete");
    assert.equal((await apply(directory, repeat.planHash)).applied, false);
    assert.equal(await fs.readFile(file(directory), "utf8"), exact);
    pass("atomic apply backs up exact original, records audit and permanently prevents repeat seeding");
  }
  {
    const directory = await setup("before-write"), before = await fs.readFile(file(directory), "utf8");
    await assert.rejects(apply(directory, (await plan(directory)).planHash, { writeState: async () => { throw new Error("Interrupted before rename"); } }), /Interrupted/);
    assert.equal(await fs.readFile(file(directory), "utf8"), before);
    const resume = await plan(directory); assert.equal(resume.disposition, "resume");
    await apply(directory, resume.planHash); assert.equal((await read(directory)).revision, 1);
    assert.equal((await plan(directory)).disposition, "complete");
    pass("an interrupted state write resumes the exact prepared target without duplicate revisions");
  }
  {
    const directory = await setup("after-write");
    await assert.rejects(apply(directory, (await plan(directory)).planHash, { writeState: async (filename, text) => { await fs.writeFile(filename, text); throw new Error("Lost completion response"); } }), /Lost completion/);
    const saved = await read(directory); saved.revision++; saved.draft.settings.storeName = "A later CMS edit";
    await fs.writeFile(file(directory), JSON.stringify(saved)); const exact = await fs.readFile(file(directory), "utf8");
    const confirm = await plan(directory); assert.equal(confirm.disposition, "confirm-complete");
    await apply(directory, confirm.planHash); assert.equal(await fs.readFile(file(directory), "utf8"), exact);
    pass("a committed uncertain outcome is confirmed from its audit without replaying over later CMS edits");
  }
  {
    const directory = await setup("uncertain");
    await assert.rejects(apply(directory, (await plan(directory)).planHash, { writeState: async () => { throw new Error("Interrupted"); } }), /Interrupted/);
    const saved = await read(directory); saved.revision++; saved.draft.settings.storeName = "Concurrent change";
    await fs.writeFile(file(directory), JSON.stringify(saved)); const exact = await fs.readFile(file(directory), "utf8");
    await assert.rejects(plan(directory), /uncertain outcome/);
    assert.equal(await fs.readFile(file(directory), "utf8"), exact);
    pass("unresolvable interrupted outcomes preserve state, backups and receipt for review");
  }
  {
    const directory = await setup("lock"), dry = await plan(directory);
    await fs.writeFile(path.join(directory, "write.lock"), JSON.stringify({ pid: process.pid }));
    await assert.rejects(apply(directory, dry.planHash, { lockTimeoutMs: 1 }), /write.lock is held/);
    assert.equal((await read(directory)).revision, 0);
    await fs.access(path.join(directory, "write.lock"));
    pass("existing CMS lock blocks migration without removing the lock or modifying state");
  }
  console.log(`PASS: ${checks} blog migration checks.`);
} finally {
  const resolved = path.resolve(sandbox), temporaryRoot = path.resolve(os.tmpdir());
  assert.ok(resolved.startsWith(`${temporaryRoot}${path.sep}`) && path.basename(resolved).startsWith("vetra-blog-migration-"));
  await fs.rm(resolved, { recursive: true, force: true });
}

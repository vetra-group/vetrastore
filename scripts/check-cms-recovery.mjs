import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url), cache = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const record = { exports: {} }; cache.set(filename, record);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const require = (name) => name.startsWith("@/") ? load(`src/${name.slice(2)}.ts`) : name.startsWith(".") ? load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`))) : nativeRequire(name);
  new Function("require", "module", "exports", code)(require, record, record.exports);
  return record.exports;
}


const { mergeDraft, equalDraft } = load("src/lib/cms/draft-merge.ts");
const base = { records: [{ id: "a", title: "A", body: "Old" }, { id: "b", title: "B" }] };
let mine = structuredClone(base), latest = structuredClone(base);
mine.records[0].title = "Mine"; latest.records[0].body = "Latest body";
let conflicts = [], merged = mergeDraft(base, mine, latest, conflicts);
assert.equal(conflicts.length, 0); assert.equal(merged.records[0].title, "Mine"); assert.equal(merged.records[0].body, "Latest body");
console.log("PASS: independent field edits merge without losing either editor's work");
latest.records[0].title = "Theirs"; conflicts = [];
mergeDraft(base, mine, latest, conflicts); assert.equal(conflicts.length, 1);
const choice = { [JSON.stringify(conflicts[0].path)]: "latest" };
merged = mergeDraft(base, mine, latest, [], [], choice);
assert.equal(merged.records[0].title, "Theirs"); assert.equal(merged.records[0].body, "Latest body");
console.log("PASS: conflicts require explicit per-field choices and preserve independent edits");
mine.records = mine.records.filter(item => item.id !== "a"); conflicts = [];
mergeDraft(base, mine, latest, conflicts); assert.equal(conflicts.length, 1);
merged = mergeDraft(base, mine, latest, [], [], { [JSON.stringify(conflicts[0].path)]: "latest" });
assert.equal(merged.records[0].id, "b"); assert.equal(merged.records[1].title, "Theirs");
console.log("PASS: deletion versus update can restore the latest record");
const original = [{id:"a"},{id:"b"},{id:"c"}], local=[original[1],original[0],original[2]], remote=[original[0],original[2],original[1]];
conflicts=[]; mergeDraft(original,local,remote,conflicts); assert.equal(conflicts.length,1);
assert.deepEqual(mergeDraft(original,local,remote,[],[],{'["order"]':"latest"}), remote);
console.log("PASS: concurrent ordering changes are explicitly resolved");
conflicts = [];
const added = { id: "d", title: "New local record" };
assert.deepEqual(mergeDraft(original, [...original, added], remote, conflicts), [...remote, added]);
assert.equal(conflicts.length, 0);
assert.deepEqual(mergeDraft(original, [original[0], original[2]], [original[2], original[0], original[1]], []), [original[2], original[0]]);
console.log("PASS: local additions and deletions preserve independent remote reordering");
const shared = { copy: { a: "one" }, records: original };
assert.ok(equalDraft(shared, {...shared})); assert.ok(!equalDraft(shared, {...shared, copy:{a:"two"}}));
assert.ok(!equalDraft({x:undefined}, {})); assert.ok(!equalDraft([], {}));
console.log("PASS: dirty tracking respects shared branches, removals and value types");

const { defaultState } = load("src/lib/cms/defaults.ts");
const { workspaceState, hydrateWorkspaceContent, workspaceIds } = load("src/lib/cms/workspace.ts");
const full=defaultState(), projected=workspaceState(full);
assert.equal(projected.draft.articles[0].content.en.sections.length,0);
assert.ok(JSON.stringify(projected).length < JSON.stringify(full).length * 0.7);
const edit=structuredClone(projected.draft); edit.settings.storeName="Recovered store";
const hydrated=hydrateWorkspaceContent(full.draft,edit,[]);
assert.deepEqual(hydrated.articles,full.draft.articles); assert.equal(hydrated.settings.storeName,"Recovered store");
console.log("PASS: compact workspace reduces transfer and never overwrites unloaded article bodies");
const article=full.draft.articles[0], key=article.id??article.slug;
const open=workspaceState(full,[key]); open.draft.articles[0]={...open.draft.articles[0],content:{...open.draft.articles[0].content,en:{...open.draft.articles[0].content.en,intro:"Changed introduction"}}};
assert.equal(hydrateWorkspaceContent(full.draft,open.draft,[key]).articles[0].content.en.intro,"Changed introduction");
console.log("PASS: an explicitly loaded record can save its body while other bodies remain intact");

// A recovered compact checkpoint must not interpret omitted bodies as deletions.
const compactBase = structuredClone(projected.draft), recovered = structuredClone(compactBase), fullLatest = structuredClone(full.draft);
recovered.settings.storeName = "Unsaved recovered name";
fullLatest.articles[0].content.en.intro = "A newer server introduction";
fullLatest.articles[0].editorialNotes = "Private review notes added by another editor";
conflicts = [];
const recoveredMerge = mergeDraft(compactBase, recovered, fullLatest, conflicts);
assert.equal(conflicts.length, 0);
assert.deepEqual(recoveredMerge.articles, fullLatest.articles);
assert.equal(recoveredMerge.settings.storeName, "Unsaved recovered name");
console.log("PASS: compact recovery baselines preserve full newer article bodies and private notes");

const { validateCmsContent } = load("src/lib/cms/validation.ts");
assert.throws(() => validateCmsContent(hydrateWorkspaceContent(full.draft, projected.draft, [key])), /intro|introduction/i);
const tampered = structuredClone(projected.draft);
tampered.articles[0].content.en.title = "Ignored unloaded title";
tampered.articles[0].status = "draft";
tampered.articles[0].featured = false;
const protectedArticle = hydrateWorkspaceContent(full.draft, tampered, []).articles[0];
assert.equal(protectedArticle.content.en.title, full.draft.articles[0].content.en.title);
assert.equal(protectedArticle.status, "draft");
assert.equal(protectedArticle.featured, false);
for (const invalid of [undefined, "article", [""], ["same", "same"], ["a".repeat(121)], Array(501).fill("a")]) assert.throws(() => workspaceIds(invalid));
assert.deepEqual(workspaceIds([key]), [key]);
console.log("PASS: omitted bodies cannot be saved as loaded records; list changes are limited to status and featured");

// Exercise the storage contract with asynchronous transactions and structured
// cloning. Actual reload/browser persistence is covered by browser journeys.
const storageRecords = new Map(), tabStorage = new Map();
let connections = 0, closes = 0;
globalThis.sessionStorage = { getItem: (key) => tabStorage.get(key) ?? null, setItem: (key, value) => tabStorage.set(key, value) };
globalThis.indexedDB = {
  open() {
    connections++;
    const request = { result: {
      close() { closes++; },
      transaction() {
        const tx = { objectStore: () => Object.fromEntries(["get", "put", "delete"].map((operation) => [operation, (value) => {
          const copy = structuredClone(value), action = {};
          queueMicrotask(() => {
            if (operation === "put") storageRecords.set(copy.key, copy);
            if (operation === "delete") storageRecords.delete(copy);
            action.result = operation === "get" ? structuredClone(storageRecords.get(copy)) : undefined;
            tx.oncomplete();
          });
          return action;
        }])) };
        return tx;
      },
    } };
    queueMicrotask(() => request.onsuccess());
    return request;
  },
};
const { checkpointScope, writeCheckpoint, readCheckpoint, deleteCheckpoint, CHECKPOINT_TTL } = load("src/lib/cms/draft-checkpoint.ts");
const ownerA = "staff-a", ownerB = "staff-b", scopeA = checkpointScope(ownerA), scopeB = checkpointScope(ownerB), recoveryKey = `${scopeA}:draft`;
assert.equal(scopeA, checkpointScope(ownerA)); assert.notEqual(scopeA, scopeB);
await writeCheckpoint(recoveryKey, ownerA, { base: compactBase, content: recovered, revision: 7 });
assert.deepEqual((await readCheckpoint(recoveryKey, ownerA)).value.content, recovered);
assert.equal(await readCheckpoint(recoveryKey, ownerB), null);
assert.ok(storageRecords.has(recoveryKey), "A different account cannot delete someone else's recovery record.");
console.log("PASS: private checkpoints survive serialized writes and remain scoped to the original account and tab");
for (const at of [Date.now() - CHECKPOINT_TTL, Date.now() + 120000, NaN, Infinity, undefined]) {
  storageRecords.set(recoveryKey, { key: recoveryKey, owner: ownerA, at, value: {} });
  assert.equal(await readCheckpoint(recoveryKey, ownerA), null);
  assert.ok(!storageRecords.has(recoveryKey));
}
storageRecords.set(recoveryKey, { key: "wrong-key", owner: ownerA, at: Date.now(), value: {} });
assert.equal(await readCheckpoint(recoveryKey, ownerA), null);
await deleteCheckpoint(recoveryKey);
await assert.rejects(writeCheckpoint(recoveryKey, ownerA, { invalid: () => {} }), /clone/i);
assert.equal(closes, connections, "Connections must close after success and structured-clone failures.");
delete globalThis.indexedDB; delete globalThis.sessionStorage;
console.log("PASS: expired, future-dated, malformed, and mismatched checkpoints cannot be recovered; failed writes release storage handles");

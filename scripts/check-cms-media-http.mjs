import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
assert.ok(process.argv.includes("--isolated") && process.argv[2], "Run this mutating media test through test:cms:live or provide an isolated preview origin and --isolated.");
const origin = process.argv[2];
let cookie = "", otherCookie = "", current, baseline, changed = false, checks = 0;
const submissions = new Set(), fixtures = [];
const json = (method, body) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
async function request(endpoint, options = {}, session = cookie) {
  const response = await fetch(origin + endpoint, { ...options, signal: AbortSignal.timeout(20_000), headers: { Origin: origin, ...(session ? { Cookie: session } : {}), ...options.headers } });
  return { response, body: await response.json() };
}
function check(value, message) { assert.ok(value, message); checks++; }
async function save(content, action = "save") {
  const result = await request("/api/cms", json("PUT", { revision: current.revision, content, action }));
  assert.equal(result.response.status, 200, JSON.stringify(result.body)); current = result.body.state; return current;
}
function formFor(submissionId, fixture, fields = {}) {
  const form = new FormData();
  form.set("submissionId", submissionId);
  form.set("file", new Blob([fixture.bytes], { type: fixture.mime }), fixture.file);
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}
async function stage(submissionId, fixture) {
  submissions.add(submissionId);
  const result = await request("/api/cms/media", { method: "POST", body: formFor(submissionId, fixture) });
  assert.equal(result.response.status, 200, JSON.stringify(result.body)); return result.body.upload;
}
const labels = (uploads) => uploads.map((item) => ({ id: item.id, alt: { en: "CMS media verification image", ar: "صورة لاختبار مكتبة وسائط الإدارة", th: "ภาพทดสอบระบบสื่อ CMS" } }));
async function commit(submissionId, uploads, revision = current.revision) {
  const result = await request("/api/cms/media", json("PUT", { submissionId, revision, uploads: labels(uploads) }));
  assert.equal(result.response.status, 200, JSON.stringify(result.body)); current = result.body.state; changed = true; return result.body;
}
try {
  let result = await request("/api/cms/media?submissionId=" + randomUUID(), {}, "");
  check(result.response.status === 401, "Submission status requires authentication");
  result = await request("/api/cms/media/cleanup", json("POST", {}), "");
  check(result.response.status === 401, "Manual cleanup requires authentication");
  for (const name of ["primary", "other"]) {
    const login = await request("/api/cms/session", json("POST", { action: "login" }), "");
    assert.equal(login.response.status, 200, JSON.stringify(login.body));
    const value = login.response.headers.get("set-cookie").split(";")[0];
    if (name === "primary") cookie = value; else otherCookie = value;
  }
  const initial = await request("/api/cms"); assert.equal(initial.response.status, 200); current = initial.body.state;
  baseline = structuredClone(current);
  assert.deepEqual(baseline.draft.media, baseline.published.media, "This disposable fixture requires synchronized media libraries.");
  for (const candidate of [{ file: "honey-product.png", mime: "image/png" }, { file: "coffee-beans.webp", mime: "image/webp" }]) {
    const bytes = await readFile(path.join(root, "public", "images", candidate.file));
    const id = createHash("sha256").update(bytes).digest("hex");
    assert.ok(![...baseline.draft.media, ...baseline.published.media].some((item) => item.id === id) && !baseline.trash.some((entry) => entry.kind === "media" && entry.item.id === id), "Fixture must be unused before mutation.");
    fixtures.push({ ...candidate, bytes, id });
  }
  const submissionId = randomUUID(), beforeStage = structuredClone(current);
  result = await request("/api/cms/media", { method: "POST", body: formFor(submissionId, fixtures[0]) }, "");
  check(result.response.status === 401, "Anonymous image staging is rejected");
  result = await request("/api/cms/media", { method: "POST", body: formFor(submissionId, fixtures[0]), headers: { Origin: "https://foreign.invalid" } });
  check(result.response.status === 403, "Foreign-origin image staging is rejected");
  result = await request("/api/cms/media", { method: "POST", body: formFor("../../private", fixtures[0]) });
  check(result.response.status === 400, "Submission identities cannot contain filesystem paths");
  result = await request("/api/cms/media", { method: "POST", body: formFor(submissionId, fixtures[0], { altTh: "Old combined upload contract" }) });
  check(result.response.status === 400, "Unsupported multipart fields are rejected");
  result = await request("/api/cms/media", { method: "POST", body: formFor(submissionId, { ...fixtures[0], mime: "image/jpeg" }) });
  check(result.response.status === 400, "An image signature must match its declared media type");
  result = await request("/api/cms/media", { method: "POST", body: formFor(submissionId, { file: "invalid.png", mime: "image/png", bytes: new Uint8Array([1, 2, 3]) }) });
  check(result.response.status === 400, "Invalid image bytes cannot be staged");
  result = await request("/api/cms/media", { method: "POST", body: formFor(submissionId, { file: "large.png", mime: "image/png", bytes: new Uint8Array(5 * 1024 * 1024 + 1) }) });
  check(result.response.status === 413, "Oversized submitted files are rejected before staging");
  const unprepared = await readFile(path.join(root, "public", "images", "honey-front.jpg"));
  result = await request("/api/cms/media", { method: "POST", body: formFor(submissionId, { file: "unprepared.jpg", mime: "image/jpeg", bytes: unprepared }) });
  check(result.response.status === 413 && result.body.code === "IMAGE_DIMENSIONS", "Server refuses oversized source dimensions that skipped browser preparation");
  const first = await stage(submissionId, fixtures[0]);
  check(first.id === fixtures[0].id && first.width > 0 && first.height > 0, "Staging returns verified SHA identity and real dimensions");
  check(!("alt" in first), "Staging has not prematurely saved image descriptions");
  assert.deepEqual((await request("/api/cms")).body.state, beforeStage); checks++;
  check((await fetch(origin + first.src, { signal: AbortSignal.timeout(20_000) })).status === 404, "Uncommitted uploads are unavailable through the public image endpoint");
  const status = await request("/api/cms/media?submissionId=" + submissionId);
  check(status.response.status === 200 && status.body.status === "pending" && status.body.uploads.length === 1, "Submission status resolves an upload response without creating a CMS record");
  const uploadRetry = await stage(submissionId, fixtures[0]);
  check(uploadRetry.id === first.id && (await request("/api/cms/media?submissionId=" + submissionId)).body.uploads.length === 1, "Retrying a staged image is idempotent");
  result = await request("/api/cms/media?submissionId=" + submissionId, {}, otherCookie);
  check(result.response.status === 200 && result.body.uploads[0].id === first.id, "A fresh session for the same local staff identity can reconcile its prepared submission");
  result = await request("/api/cms/media?submissionId=" + submissionId, {}, "");
  check(result.response.status === 401, "Reconciliation still requires an authenticated session");
  result = await request("/api/cms/media", { method: "POST", body: formFor(submissionId, { file: "failed.jpg", mime: "image/jpeg", bytes: new Uint8Array([1, 2, 3]) }) });
  check(result.response.status === 400 && (await request("/api/cms/media?submissionId=" + submissionId)).body.uploads.length === 1, "A later failed upload leaves successful uploads staged and the CMS unchanged");
  assert.deepEqual((await request("/api/cms")).body.state, beforeStage); checks++;
  const second = await stage(submissionId, fixtures[1]);
  result = await request("/api/cms/media", json("PUT", { submissionId, revision: current.revision, uploads: [{ id: first.id, alt: { th: "", en: "Missing Thai" } }, ...labels([second])] }));
  check(result.response.status === 400, "Both localized descriptions must validate before any record is saved");
  assert.deepEqual((await request("/api/cms")).body.state, beforeStage); checks++;
  result = await request("/api/cms/media", json("PUT", { submissionId, revision: current.revision, uploads: labels([first]) }));
  check(result.response.status === 400, "A commit cannot silently omit part of its uploaded submission");
  const concurrentDraft = structuredClone(current.draft); concurrentDraft.copy["site.en.announcement"] = "Concurrent media verification edit"; concurrentDraft.copy["site.ar.announcement"] = "تعديل متزامن لاختبار حفظ الوسائط";
  const staleRevision = current.revision; await save(concurrentDraft);
  result = await request("/api/cms/media", json("PUT", { submissionId, revision: staleRevision, uploads: labels([first, second]) }));
  check(result.response.status === 409 && (await request("/api/cms/media?submissionId=" + submissionId)).body.status === "pending", "A stale database save stops while preserving staged uploads for an explicit retry");
  check(!current.draft.media.some((item) => item.id === first.id), "Failed save does not report or expose media success");
  const commitRevision = current.revision, committed = await commit(submissionId, [first, second]);
  check(committed.media.length === 2 && current.revision === commitRevision + 1 && current.draft.media.length === beforeStage.draft.media.length + 2, "Text and both media URLs save together in one revision");
  check(!current.published.media.some((item) => item.id === first.id), "Saving media leaves the published library unchanged");
  const retryCommit = await commit(submissionId, [first, second], commitRevision);
  check(retryCommit.state.revision === commitRevision + 1 && retryCommit.state.draft.media.filter((item) => item.id === first.id).length === 1, "A lost save response can be retried without duplicate records");
  result = await request("/api/cms/media", json("PUT", { submissionId, revision: commitRevision, uploads: [{ id: first.id, alt: { en: "Changed completed save payload", ar: "وصف معدّل بعد اكتمال الحفظ", th: "เปลี่ยนคำอธิบายหลังบันทึก" } }, ...labels([second])] }));
  check(result.response.status === 409 && result.body.code === "SUBMISSION_COMMITTED", "A completed submission cannot disguise different text as an idempotent retry");
  const committedStatus = await request("/api/cms/media?submissionId=" + submissionId);
  check(committedStatus.body.status === "committed" && committedStatus.body.state.revision === current.revision, "Status confirms a committed submission after an uncertain client response");
  const raw = await fetch(origin + first.src, { signal: AbortSignal.timeout(20_000) });
  check(raw.status === 200 && raw.headers.get("content-type") === fixtures[0].mime && raw.headers.get("x-content-type-options") === "nosniff", "Committed public media has its verified type and safe delivery headers");
  check(raw.headers.get("x-robots-tag") === "noindex, nofollow", "Saved draft originals explicitly prevent image indexing");
  check(/max-age=0.*must-revalidate/.test(raw.headers.get("cache-control")), "Original publication status is rechecked on subsequent requests");
  assert.equal(createHash("sha256").update(Buffer.from(await raw.arrayBuffer())).digest("hex"), first.id); checks++;
  const optimized = await fetch(`${origin}/_next/image?url=${encodeURIComponent(first.src)}&w=640&q=75`, { headers: { Accept: "image/webp" }, signal: AbortSignal.timeout(20_000) });
  check(optimized.status === 200 && optimized.headers.get("content-type")?.startsWith("image/") && (await optimized.arrayBuffer()).byteLength > 0, "Next image optimization serves committed uploaded media");
  check(optimized.headers.get("x-robots-tag") === "noindex, nofollow", "Decoded CMS optimizer query receives noindex despite upstream header loss");
  const bundled = await fetch(`${origin}/_next/image?url=${encodeURIComponent("/images/honey-product.png")}&w=640&q=75`, { headers: { Accept: "image/webp" }, signal: AbortSignal.timeout(20_000) });
  check(bundled.status === 200 && (await bundled.arrayBuffer()).byteLength > 0 && !bundled.headers.has("x-robots-tag"), "CMS optimizer header does not block ordinary bundled product images");
  const duplicateId = randomUUID(); await stage(duplicateId, fixtures[0]);
  const abandonSaved = await request("/api/cms/media", json("PATCH", { submissionId: duplicateId }));
  check(abandonSaved.response.status === 200 && (await fetch(origin + first.src)).status === 200, "Abandoning a duplicate submission preserves previously saved media");
  let draft = structuredClone(current.draft); draft.products.find((item) => item.id === "coffee-blossom-honey").image = first.src;
  await save(draft);
  let deletion = await request("/api/cms/media", json("DELETE", { revision: current.revision, id: first.id }));
  check(deletion.response.status === 409 && deletion.body.code === "MEDIA_REFERENCED", "Deleting an image used by the draft is rejected");
  await save(draft, "publish");
  const optimizedPublished = await fetch(`${origin}/_next/image?url=${encodeURIComponent(first.src)}&w=640&q=75`, { headers: { Accept: "image/webp" }, signal: AbortSignal.timeout(20_000) });
  check(optimizedPublished.status === 200 && (await optimizedPublished.arrayBuffer()).byteLength > 0 && optimizedPublished.headers.get("x-robots-tag") === "noindex, nofollow", "Cached CMS optimizer variants remain noindex after publication; originals determine public image indexing");
  const html = await (await fetch(origin + "/coffee-blossom-honey", { signal: AbortSignal.timeout(20_000) })).text();
  check(html.includes(first.src) || html.includes(encodeURIComponent(first.src)), "Published product renders the committed image");
  draft = structuredClone(current.draft); draft.products.find((item) => item.id === "coffee-blossom-honey").image = baseline.draft.products.find((item) => item.id === "coffee-blossom-honey").image;
  await save(draft);
  deletion = await request("/api/cms/media", json("DELETE", { revision: current.revision, id: first.id }));
  check(deletion.response.status === 409 && deletion.body.code === "MEDIA_REFERENCED", "Deleting an image still used by published content is rejected");
} finally {
  if (changed && baseline) {
    // This entire preview is disposable; restore public content while retaining image metadata until each authorized move to Trash.
    current = (await request("/api/cms")).body.state;
    const media = current.draft.media.filter((item) => fixtures.some((fixture) => fixture.id === item.id));
    const restoredPublished = structuredClone(baseline.published); restoredPublished.media.push(...media);
    await save(restoredPublished, "publish");
    const restoredDraft = structuredClone(baseline.draft); restoredDraft.media.push(...media);
    if (JSON.stringify(restoredDraft) !== JSON.stringify(current.draft)) await save(restoredDraft);
    for (const image of media) {
      const deletion = await request("/api/cms/media", json("DELETE", { revision: current.revision, id: image.id }));
      assert.equal(deletion.response.status, 200, JSON.stringify(deletion.body)); current = deletion.body.state;
      const trashed = current.trash.find((entry) => entry.kind === "media" && entry.item.id === image.id);
      check(Boolean(trashed) && Date.parse(trashed.expiresAt) - Date.parse(trashed.deletedAt) === 30 * 24 * 60 * 60 * 1000, "Deleted media has an exact 30-day recovery window");
      check((await fetch(origin + image.src)).status === 404, "Trash-only images remain hidden from the public endpoint");
      const privatePath = "/api/cms/trash-media/" + path.basename(image.src);
      check((await fetch(origin + privatePath)).status === 401, "Trash image preview requires authentication");
      const preview = await fetch(origin + privatePath, { headers: { Cookie: cookie } });
      check(preview.status === 200 && preview.headers.get("cache-control") === "private, no-store", "Authenticated Trash preview privately serves retained image bytes");
      const blocked = await request("/api/cms/media", { method: "POST", body: formFor(randomUUID(), fixtures.find((fixture) => fixture.id === image.id)) });
      check(blocked.response.status === 409 && blocked.body.code === "MEDIA_IN_TRASH", "New upload cannot bypass an existing media Trash entry");
      const cleanup = await request("/api/cms/media/cleanup", json("POST", {}));
      check(cleanup.response.status === 200 && (await fetch(origin + privatePath, { headers: { Cookie: cookie } })).status === 200, "Manual cleanup protects media required for Trash restoration");
      const restore = await request("/api/cms/trash", json("POST", { action: "restore", revision: current.revision, id: trashed.id }));
      assert.equal(restore.response.status, 200, JSON.stringify(restore.body)); current = restore.body.state;
      check(current.draft.media.some((item) => item.id === image.id) && !current.published.media.some((item) => item.id === image.id), "Restored media returns to the draft only");
      check((await fetch(origin + image.src)).status === 200, "Restoration reuses the same retained image URL");
      const returnToTrash = await request("/api/cms/media", json("DELETE", { revision: current.revision, id: image.id }));
      assert.equal(returnToTrash.response.status, 200, JSON.stringify(returnToTrash.body)); current = returnToTrash.body.state;
    }
    assert.deepEqual(current.draft, baseline.draft); assert.deepEqual(current.published, baseline.published); checks++;
  }
  for (const submissionId of submissions) await request("/api/cms/media", json("PATCH", { submissionId }));
  if (otherCookie) await request("/api/cms/session", { method: "DELETE" }, otherCookie);
  if (cookie) await request("/api/cms/session", { method: "DELETE" });
}
console.log(`PASS: ${checks} isolated live media checks covering staged upload, atomic save, authorization, ownership, retries, delivery, references, manual cleanup and Trash restoration. User CMS unchanged.`);

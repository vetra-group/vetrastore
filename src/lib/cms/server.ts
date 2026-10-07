import { createHash, randomUUID } from "node:crypto";
import { open } from "node:fs/promises";
import { mkdir, readFile, readdir, stat, unlink, atomicFile, atomicStateAndPublished, remoteCmsStorage, withRemoteCmsLock } from "./storage";
import path from "node:path";
import { cache } from "react";
import { assertCmsOwner, authorizeCms, cmsActor, cmsDirectory, cmsMode } from "./auth";
import { defaultContent, defaultState } from "./defaults";
import { HONEY_ID } from "@/lib/catalog";
import { CMS_TRASH_LIMIT, CMS_TRASH_TTL_MS, CmsError, cmsImageSources, referencedMedia, validateCmsContent, validateCmsMedia, validateCmsState, validateRevision } from "./validation";
import type { CmsArticle, CmsContent, CmsHistoryEntry, CmsHistorySummary, CmsMedia, CmsProduct, CmsSlide, CmsState, CmsTrashEntry, CmsTrashKind } from "./types";
import { articleIdentity, assertPublicationReady, cmsChanges, normalizeCmsIdentities, preserveCmsRoutes, selectedCmsPublication, validatePublishSelection } from "./publishing";
import { publishedContentProjection } from "./public-content";
import { invalidatePublishedReadModel, readPublishedContent } from "./published-read-model";
import { CMS_MEDIA_STAGE_LEASE_MS, MAX_MEDIA_BATCH, MAX_MEDIA_DIMENSION, MAX_MEDIA_UPLOAD_BYTES } from "./media-policy";
import type { CmsMediaCleanupResult, CmsMediaCleanupSummary, CmsMediaSubmissionResult, CmsStagedUpload } from "./media-policy";
import { backupTransferReferenceSnapshot } from "./backup-transfer-store";

export { cmsMode } from "./auth";
const globalCms = globalThis as typeof globalThis & { __vetraCmsMutation?: Promise<unknown>; __vetraCmsTrashTimer?: ReturnType<typeof setInterval> };
const stateFile = () => path.join(cmsDirectory(), "state.json");
const mediaDirectory = () => path.join(cmsDirectory(), "media");
const uploadsFile = () => path.join(cmsDirectory(), "uploads.json");
const historyDirectory = () => path.join(cmsDirectory(), "history");
const HISTORY_LIMIT = 30;
const historyIdPattern = /^\d{1,16}-[a-f0-9]{16}$/;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
function requireLocal() { if (cmsMode() === "unavailable") throw new CmsError("CMS storage is not configured for this environment.", 503, "CMS_UNAVAILABLE"); }
async function readCmsState(): Promise<CmsState> {
  requireLocal();
  let value: string;
  try { if ((await stat(stateFile())).size > 32 * 1024 * 1024) throw new CmsError("The CMS snapshot exceeds its safe storage limit and has been preserved.", 503, "CMS_STORAGE_INVALID"); value = await readFile(stateFile(), "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return normalizeCmsIdentities(defaultState()); throw error; }
  try { return normalizeCmsIdentities(validateCmsState(JSON.parse(value))); }
  catch { throw new CmsError("The saved CMS file cannot be read. It has been preserved for recovery; do not overwrite it.", 503, "CMS_STORAGE_INVALID"); }
}
function startTrashTimer() {
  if (remoteCmsStorage()) return;
  if (globalCms.__vetraCmsTrashTimer) return;
  const directory = cmsDirectory();
  globalCms.__vetraCmsTrashTimer = setInterval(() => {
    if (cmsMode() !== "unavailable" && cmsDirectory() === directory) void serial(() => prepareState()).catch((error) => console.error("CMS trash maintenance could not complete; saved data and uncertain assets were preserved.", error));
  }, 60_000);
  globalCms.__vetraCmsTrashTimer.unref();
}
export async function getCmsState(): Promise<CmsState> {
  const state = await readCmsState(); startTrashTimer();
  if (state.trash.some((entry) => Date.parse(entry.expiresAt) <= Date.now())) return serial(() => prepareState());
  return state;
}
export async function getCmsPreviewContent(request: Request): Promise<CmsContent> {
  await authorizeCms(request);
  return (await getCmsState()).draft;
}
export const getPublishedContent = cache(async (): Promise<CmsContent> => {
  if (cmsMode() === "unavailable") {
    if (remoteCmsStorage()) throw new CmsError("Published store configuration is incomplete. Try again after the store setup is restored.", 503, "CMS_UNAVAILABLE");
    return publishedContentProjection(defaultContent());
  }
  return readPublishedContent();
});
function historyId(entry: Pick<CmsHistoryEntry, "revision" | "draft" | "published">) {
  return `${entry.revision}-${createHash("sha256").update(JSON.stringify({ draft: entry.draft, published: entry.published })).digest("hex").slice(0, 16)}`;
}
function validateHistory(value: unknown): CmsHistoryEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CmsError("Check the revision snapshot.");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !["id", "revision", "at", "action", "draft", "published"].includes(key)) || typeof record.id !== "string" || !historyIdPattern.test(record.id) || typeof record.at !== "string" || !Number.isFinite(Date.parse(record.at)) || typeof record.action !== "string" || record.action.length > 100) throw new CmsError("Check the revision snapshot.");
  // Hash the original serialized payload before any language upgrade. Legacy
  // history keeps its original identity in backups and on disk.
  validateCmsContent(record.draft); validateCmsContent(record.published);
  const entry = { id: record.id, revision: validateRevision(record.revision), at: record.at, action: record.action, draft: record.draft as CmsContent, published: record.published as CmsContent };
  if (entry.id !== historyId(entry)) throw new CmsError("The revision snapshot does not match its content.", 400, "HISTORY_INVALID");
  return entry;
}
async function historyEntries(): Promise<CmsHistoryEntry[]> {
  let names: string[];
  try { names = (await readdir(historyDirectory())).filter((name) => name.endsWith(".json") && historyIdPattern.test(name.slice(0, -5))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  if (names.length > 100) throw new CmsError("Revision storage needs review before continuing.", 503, "HISTORY_INVALID");
  const entries: CmsHistoryEntry[] = [];
  for (const name of names) {
    try {
      const file = path.join(historyDirectory(), name);
      if ((await stat(file)).size > 32 * 1024 * 1024) throw new Error("snapshot size");
      const entry = validateHistory(JSON.parse(await readFile(file, "utf8")));
      if (`${entry.id}.json` !== name) throw new Error("snapshot identity");
      if (Date.parse(entry.at) + CMS_TRASH_TTL_MS > Date.now()) entries.push(entry);
    } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") continue; throw new CmsError("A revision snapshot is damaged. Its files and images have been preserved for recovery.", 503, "HISTORY_INVALID"); }
  }
  return entries.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.revision - a.revision);
}
async function saveHistory(state: CmsState) {
  const entry: CmsHistoryEntry = { id: "", revision: state.revision, at: new Date().toISOString(), action: state.audit[0]?.action || "Initial source content", draft: structuredClone(state.draft), published: structuredClone(state.published) };
  entry.id = historyId(entry);
  const current = await historyEntries();
  if (!current.some((item) => item.id === entry.id)) await atomicFile(path.join(historyDirectory(), `${entry.id}.json`), JSON.stringify(entry));
  const keep = new Set([entry.id, ...current.map((item) => item.id)].slice(0, HISTORY_LIMIT));
  for (const name of await readdir(historyDirectory())) if (name.endsWith(".json") && historyIdPattern.test(name.slice(0, -5)) && !keep.has(name.slice(0, -5))) await unlink(path.join(historyDirectory(), name));
}
async function historyReferences(src: string): Promise<boolean> {
  return (await historyEntries()).some((entry) => [entry.draft, entry.published].some((content) => referencedMedia(content, src) || content.media.some((media) => media.src === src)));
}
function historySummary(entry: CmsHistoryEntry): CmsHistorySummary { return { id: entry.id, revision: entry.revision, at: entry.at, action: entry.action }; }
export async function getCmsPublishingReview(historyValue?: unknown) {
  const state = await getCmsState(), entries = await historyEntries();
  if (historyValue !== undefined && (typeof historyValue !== "string" || !historyIdPattern.test(historyValue))) throw new CmsError("Choose a revision snapshot.");
  if (typeof historyValue === "string") {
    const entry = entries.find((entry) => entry.id === historyValue);
    if (!entry) throw new CmsError("This revision is no longer available. Revisions are kept for up to 30 days and 30 saves.", 404, "HISTORY_NOT_FOUND");
    const upgraded = { ...entry, draft: validateCmsContent(entry.draft), published: validateCmsContent(entry.published) };
    return { revision: state.revision, entry: upgraded, changes: cmsChanges(state.draft, upgraded.draft) };
  }
  return { revision: state.revision, changes: cmsChanges(state.published, state.draft), history: entries.map(historySummary) };
}
export async function publishCmsSelection(revisionValue: unknown, selectionValue?: unknown): Promise<CmsState> {
  assertCmsOwner();
  const revision = validateRevision(revisionValue), selection = validatePublishSelection(selectionValue);
  const marker = `Published review ${revision}:${createHash("sha256").update(JSON.stringify(selection || "all")).digest("hex").slice(0, 16)}`;
  return serial(async () => {
    const state = await prepareState();
    if (state.revision === revision + 1 && state.audit[0]?.action === marker) return state;
    assertRevision(state, revision);
    const published = selectedCmsPublication(state, selection);
    assertPublicationReady(published);
    await verifyMedia(published, state);
    state.published = published; state.publishedAt = new Date().toISOString(); activity(state, marker);
    return persist(state);
  });
}
export async function restoreCmsHistory(revisionValue: unknown, idValue: unknown): Promise<CmsState> {
  assertCmsOwner();
  const revision = validateRevision(revisionValue);
  if (typeof idValue !== "string" || !historyIdPattern.test(idValue)) throw new CmsError("Choose a revision snapshot.");
  return serial(async () => {
    const state = await prepareState(), marker = `Restored revision ${idValue}`;
    if (state.revision === revision + 1 && state.audit[0]?.action === marker) return state;
    assertRevision(state, revision);
    const entry = (await historyEntries()).find((item) => item.id === idValue);
    if (!entry) throw new CmsError("This revision is no longer available.", 404, "HISTORY_NOT_FOUND");
    const restored = preserveCmsRoutes(entry.draft, state, true);
    await verifyMedia(restored, state, [...entry.draft.media, ...entry.published.media]);
    captureRemoved(state, restored, false, "", true);
    state.draft = restored; activity(state, marker); return persist(state);
  });
}
async function withFileLock<T>(task: () => Promise<T>): Promise<T> {
  if (remoteCmsStorage()) { requireLocal(); return withRemoteCmsLock(task); }
  requireLocal(); await mkdir(cmsDirectory(), { recursive: true, mode: 0o700 });
  const lockfile = path.join(cmsDirectory(), "write.lock");
  const deadline = Date.now() + 5000;
  while (true) {
    try { const handle = await open(lockfile, "wx", 0o600); try { await handle.writeFile(JSON.stringify({ pid: process.pid })); } finally { await handle.close(); } break; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try { const lock = JSON.parse(await readFile(lockfile, "utf8")); if (Number.isInteger(lock.pid) && lock.pid > 0) { try { process.kill(lock.pid, 0); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ESRCH") { await unlink(lockfile).catch(() => undefined); continue; } } } } catch { /* An uncertain lock is retained. */ }
      if (Date.now() > deadline) throw new CmsError("Another CMS save is in progress. Please try again.", 503, "CMS_BUSY");
      await delay(50);
    }
  }
  try { return await task(); } finally { await unlink(lockfile).catch(() => undefined); }
}
function serial<T>(task: () => Promise<T>): Promise<T> {
  const next = (globalCms.__vetraCmsMutation || Promise.resolve()).catch(() => undefined).then(() => withFileLock(task));
  globalCms.__vetraCmsMutation = next;
  return next;
}
function assertRevision(state: CmsState, revision: number) { if (state.revision !== revision) throw new CmsError("Content changed in another session. Reload the latest version before saving.", 409, "REVISION_CONFLICT"); }
function assertCmsSettingsPermission(state: CmsState, next: CmsContent) { if (JSON.stringify(state.draft.settings) !== JSON.stringify(next.settings)) assertCmsOwner(); }
function activity(state: CmsState, action: string) { state.audit = [{ id: randomUUID(), action: action.slice(0, 100), at: new Date().toISOString(), actor: cmsActor() }, ...state.audit].slice(0, 500); }
async function persist(state: CmsState): Promise<CmsState> {
  state.revision += 1; const value = JSON.stringify(state, null, 2);
  if (state.trash.length > CMS_TRASH_LIMIT || Buffer.byteLength(value) > 32 * 1024 * 1024) throw new CmsError("Trash storage is full. Restore items or wait for their 30-day expiry before deleting more.", 409, "TRASH_CAPACITY");
  // Recovery may merge retained media into the draft; validate that final merged
  // snapshot before writing so a capacity conflict cannot corrupt future reads.
  validateCmsState(state);
  await saveHistory(await readCmsState());
  try { await atomicStateAndPublished(stateFile(), value, publishedContentProjection(state.published)); }
  finally { invalidatePublishedReadModel(); }
  return structuredClone(state);
}
async function verifyMedia(content: CmsContent, state: CmsState, additional: CmsMedia[] = []) {
  const available = [...state.draft.media, ...state.published.media, ...additional];
  for (const media of content.media) {
    const existing = available.find((item) => item.id === media.id);
    if (!existing || ["src", "width", "height", "bytes", "createdAt"].some((key) => existing[key as keyof CmsMedia] !== media[key as keyof CmsMedia])) throw new CmsError("Upload images through the media library before adding them to content.");
    try { const file = await stat(path.join(mediaDirectory(), path.basename(media.src))); if (!file.isFile() || file.size !== media.bytes) throw new Error("image mismatch"); }
    catch { throw new CmsError("A selected uploaded image is missing. Upload it again before saving.", 400, "MEDIA_MISSING"); }
  }
  const imageSources = cmsImageSources(content);
  if (imageSources.some((src) => src.startsWith("/api/cms-media/") && !content.media.some((media) => media.src === src))) throw new CmsError("A selected image is missing from the media library.");
  const publicImages = path.join(process.cwd(), "public", "images");
  for (const src of new Set(imageSources.filter((src) => src.startsWith("/images/")))) {
    const filename = path.resolve(process.cwd(), "public", `.${src}`);
    if (!filename.startsWith(`${publicImages}${path.sep}`)) throw new CmsError("Choose a file from the public images folder.");
    try { const file = await stat(filename); if (!file.isFile() || !file.size) throw new Error("missing image"); }
    catch { throw new CmsError(`The image ${src} was not found. Choose an existing image before saving.`, 400, "MEDIA_MISSING"); }
  }
}
type CmsItem = CmsProduct | CmsSlide | CmsArticle | CmsMedia;
const trashKinds: CmsTrashKind[] = ["product", "slide", "article", "media"];
function itemKey(kind: CmsTrashKind, item: CmsItem): string { return kind === "slide" ? (item as CmsSlide).key : kind === "article" ? (item as CmsArticle).slug : (item as CmsProduct | CmsMedia).id; }
function items(content: CmsContent, kind: CmsTrashKind): CmsItem[] { return kind === "product" ? content.products : kind === "slide" ? content.slides : kind === "article" ? content.articles : content.media; }
function replaceItems(content: CmsContent, kind: CmsTrashKind, value: CmsItem[]) { if (kind === "product") content.products = value as CmsProduct[]; else if (kind === "slide") content.slides = value as CmsSlide[]; else if (kind === "article") content.articles = value as CmsArticle[]; else content.media = value as CmsMedia[]; }
function trashReferences(entry: CmsTrashEntry, src: string) {
  if (entry.kind === "media" || entry.kind === "slide") return entry.item.src === src;
  if (entry.item.image === src) return true;
  if (entry.kind === "product") return entry.item.gallery?.some((image) => image.src === src) || false;
  return Object.values(entry.item.content).some((copy) => copy.socialImage === src || copy.sections.some((section) => section.image?.src === src));
}
function contentOrTrashReferences(state: CmsState, src: string) { return referencedMedia(state.draft, src) || referencedMedia(state.published, src) || state.draft.media.some((item) => item.src === src) || state.published.media.some((item) => item.src === src) || state.trash.some((entry) => trashReferences(entry, src)); }
function mediaInUse(state: CmsState, next: CmsContent, src: string, published = state.published) {
  return referencedMedia(next, src) || referencedMedia(published, src) || state.trash.some((entry) => entry.kind !== "media" && trashReferences(entry, src));
}
function addTrash(state: CmsState, kind: CmsTrashKind, item: CmsItem, position: number) {
  if (kind === "product" && (item as CmsProduct).id === HONEY_ID) throw new CmsError("The honey product cannot be deleted. Archive it instead.", 409, "HONEY_PROTECTED");
  if (state.trash.length >= CMS_TRASH_LIMIT) throw new CmsError("Trash is full. Restore items or wait for their 30-day expiry before deleting more.", 409, "TRASH_CAPACITY");
  const deletedTime = Date.now();
  const entry = { id: randomUUID(), deletedAt: new Date(deletedTime).toISOString(), expiresAt: new Date(deletedTime + CMS_TRASH_TTL_MS).toISOString(), position, kind, item: structuredClone(item) } as CmsTrashEntry;
  state.trash.unshift(entry); return entry;
}
function captureRemoved(state: CmsState, next: CmsContent, includePublished: boolean, skip = "", preserveReferencedMedia = false) {
  for (const kind of trashKinds) {
    const target = items(next, kind), old = items(state.draft, kind);
    const identity = (item: CmsItem) => kind === "article" ? articleIdentity(item as CmsArticle) : itemKey(kind, item);
    const removed = old.map((item, position) => ({ item, position })).filter(({ item }) => !target.some((candidate) => identity(candidate) === identity(item)) && `${kind}:${itemKey(kind, item)}` !== skip);
    if (includePublished) items(state.published, kind).forEach((item, position) => { if (!target.some((candidate) => identity(candidate) === identity(item)) && !removed.some((entry) => identity(entry.item) === identity(item)) && !state.trash.some((entry) => entry.kind === kind && identity(entry.item) === identity(item)) && `${kind}:${itemKey(kind, item)}` !== skip) removed.push({ item, position }); });
    for (const { item, position } of removed) {
      if (kind === "media") {
        const media = item as CmsMedia;
        if (mediaInUse(state, next, media.src, includePublished ? next : state.published)) {
          if (preserveReferencedMedia) { next.media.push(structuredClone(media)); continue; }
          throw new CmsError("This image is used by live or retained trash content. Restore or update those records before deleting it.", 409, "MEDIA_REFERENCED");
        }
        state.published.media = state.published.media.filter((entry) => entry.id !== media.id);
      }
      addTrash(state, kind, item, position);
    }
  }
}
async function prepareState(): Promise<CmsState> {
  let state = await readCmsState();
  const expired = state.trash.filter((entry) => Date.parse(entry.expiresAt) <= Date.now());
  if (expired.length) {
    // Record targeted expiry work before removing its only metadata. Leftover
    // uploads are cleaned manually; the timer only handles 30-day Trash expiry.
    const ledger = await readUploads();
    const candidates = expired.filter((entry) => entry.kind === "media").map((entry) => path.basename(entry.item.src));
    ledger.expiredFiles = [...new Set([...ledger.expiredFiles, ...candidates])];
    if (candidates.length) await persistUploads(ledger);
    state.trash = state.trash.filter((entry) => Date.parse(entry.expiresAt) > Date.now()); activity(state, `Expired ${expired.length} trash items`);
    try { state = await persist(state); }
    catch (error) { const saved = await readCmsState(); if (expired.some((entry) => saved.trash.some((retained) => retained.id === entry.id))) throw error; state = saved; }
    const cleaned: string[] = [];
    const transferReferences = candidates.length ? await backupTransferReferenceSnapshot() : new Set<string>();
    for (const filename of candidates) if (await removeUnreferencedFile(state, ledger, filename, transferReferences) === "deleted") cleaned.push(filename);
    if (cleaned.length) { ledger.expiredFiles = ledger.expiredFiles.filter((filename) => !cleaned.includes(filename)); await persistUploads(ledger); }
  }
  return state;
}
export async function updateCmsContent(revisionValue: unknown, contentValue: unknown, actionValue: unknown): Promise<CmsState> {
  const revision = validateRevision(revisionValue);
  if (!["save", "publish", "restore"].includes(actionValue as string)) throw new CmsError("Choose save, publish or restore.");
  const action = actionValue as "save" | "publish" | "restore";
  if (action !== "save") assertCmsOwner();
  const supplied = action === "restore" ? null : validateCmsContent(contentValue);
  return serial(async () => {
    const state = await prepareState();
    const content = supplied ? preserveCmsRoutes(supplied, state) : null;
    if (content) assertCmsSettingsPermission(state, content);
    const label = action === "save" ? "Saved draft" : action === "publish" ? "Published content" : "Restored published content";
    if (state.revision === revision + 1 && state.audit[0]?.action === label && (content ? JSON.stringify(state.draft) === JSON.stringify(content) && (action !== "publish" || JSON.stringify(state.published) === JSON.stringify(content)) : JSON.stringify(state.draft) === JSON.stringify(state.published))) return state;
    assertRevision(state, revision);
    if (content) await verifyMedia(content, state);
    if (action === "publish" && content) assertPublicationReady(content);
    if (action === "restore") { const restored = structuredClone(state.published); captureRemoved(state, restored, false, "", true); state.draft = restored; }
    else { captureRemoved(state, content!, action === "publish"); state.draft = content!; if (action === "publish") { state.published = structuredClone(content!); state.publishedAt = new Date().toISOString(); } }
    activity(state, label);
    return persist(state);
  });
}
export function imageDetails(bytes: Uint8Array, mime: string): { width: number; height: number; extension: string } {
  const data = Buffer.from(bytes);
  let width = 0, height = 0, extension = "";
  if (mime === "image/png" && data.length >= 57 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && data.toString("ascii", 12, 16) === "IHDR" && data.readUInt32BE(8) === 13) {
    let offset = 8, hasData = false, hasEnd = false;
    while (offset + 12 <= data.length) { const length = data.readUInt32BE(offset); if (length > data.length - offset - 12) break; const kind = data.toString("ascii", offset + 4, offset + 8); if (kind === "IDAT" && length > 0) hasData = true; if (kind === "IEND" && length === 0 && offset + 12 === data.length) hasEnd = true; offset += length + 12; }
    if (hasData && hasEnd) { width = data.readUInt32BE(16); height = data.readUInt32BE(20); extension = "png"; }
  }
  else if (mime === "image/gif" && data.length >= 14 && data[data.length - 1] === 0x3b && /^(GIF87a|GIF89a)$/.test(data.toString("ascii", 0, 6))) { width = data.readUInt16LE(6); height = data.readUInt16LE(8); extension = "gif"; }
  else if (mime === "image/jpeg" && data.length >= 4 && data[0] === 0xff && data[1] === 0xd8 && data[data.length - 2] === 0xff && data[data.length - 1] === 0xd9) {
    let offset = 2;
    while (offset + 4 < data.length) { if (data[offset++] !== 0xff) break; while (data[offset] === 0xff) offset++; const marker = data[offset++]; if (marker === 0xd9 || marker === 0xda) break; if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue; const length = data.readUInt16BE(offset); if (length < 2 || offset + length > data.length) break; if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 7) { height = data.readUInt16BE(offset + 3); width = data.readUInt16BE(offset + 5); extension = "jpg"; break; } offset += length; }
  } else if (mime === "image/webp" && data.length >= 30 && data.readUInt32LE(4) + 8 === data.length && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP") {
    const kind = data.toString("ascii", 12, 16);
    if (kind === "VP8X") { width = data.readUIntLE(24, 3) + 1; height = data.readUIntLE(27, 3) + 1; }
    else if (kind === "VP8L" && data[20] === 0x2f) { const bits = data.readUInt32LE(21); width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1; }
    else if (kind === "VP8 " && data[23] === 0x9d && data[24] === 0x01 && data[25] === 0x2a) { width = data.readUInt16LE(26) & 0x3fff; height = data.readUInt16LE(28) & 0x3fff; }
    extension = "webp";
  }
  if (!extension || !width || !height || width > 20000 || height > 20000 || width * height > 80_000_000) throw new CmsError("Choose a valid JPEG, PNG, WebP or GIF image within 20,000 pixels and 80 megapixels.");
  return { width, height, extension };
}
type StagedRecord = { upload: CmsStagedUpload; newlyCreated: boolean; ready: boolean };
type MediaSubmission = {
  id: string; owner: string; status: "pending" | "saving" | "committed" | "abandoned";
  updatedAt: string; uploads: StagedRecord[]; saveRevision?: number; payloadHash?: string;
};
type UploadLedger = { version: 1; submissions: MediaSubmission[]; expiredFiles: string[] };
const mediaFilenamePattern = /^[a-f0-9]{64}\.(jpg|png|webp|gif)$/;
const submissionPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const savedMediaAction = (id: string) => `Saved media submission: ${id}`;
function validateSubmissionId(value: unknown): string {
  if (typeof value !== "string" || !submissionPattern.test(value)) throw new CmsError("Start a new image submission.", 400, "SUBMISSION_INVALID");
  return value.toLowerCase();
}
function withoutAlt(media: CmsMedia): CmsStagedUpload {
  return { id: media.id, src: media.src, name: media.name, width: media.width, height: media.height, bytes: media.bytes, createdAt: media.createdAt };
}
async function readUploads(): Promise<UploadLedger> {
  let value: string;
  try {
    if ((await stat(uploadsFile())).size > 16 * 1024 * 1024) throw new Error("upload ledger is too large");
    value = await readFile(uploadsFile(), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, submissions: [], expiredFiles: [] };
    throw new CmsError("Upload tracking cannot be read. Existing files have been preserved.", 503, "MEDIA_LEDGER_INVALID");
  }
  try { return validateUploadLedger(JSON.parse(value)); }
  catch { throw new CmsError("Upload tracking is invalid. Existing files have been preserved for recovery.", 503, "MEDIA_LEDGER_INVALID"); }
}
function validateUploadLedger(value: unknown): UploadLedger {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new CmsError("Check upload tracking.");
    const ledger = structuredClone(value) as UploadLedger;
    if (ledger.version !== 1 || !Array.isArray(ledger.submissions) || ledger.submissions.length > 5000 || !Array.isArray(ledger.expiredFiles) || ledger.expiredFiles.length > 10000 || ledger.expiredFiles.some((filename) => typeof filename !== "string" || !mediaFilenamePattern.test(filename))) throw new Error("invalid ledger");
    const identities = new Set<string>();
    for (const entry of ledger.submissions) {
      validateSubmissionId(entry.id);
      if (identities.has(entry.id) || !/^[a-f0-9]{64}$/.test(entry.owner) || !["pending", "saving", "committed", "abandoned"].includes(entry.status) || !Number.isFinite(Date.parse(entry.updatedAt)) || !Array.isArray(entry.uploads) || entry.uploads.length > MAX_MEDIA_BATCH) throw new Error("invalid submission");
      identities.add(entry.id);
      if (entry.saveRevision !== undefined) validateRevision(entry.saveRevision);
      if (entry.payloadHash !== undefined && !/^[a-f0-9]{64}$/.test(entry.payloadHash)) throw new Error("invalid save identity");
      const uploads = new Set<string>();
      for (const record of entry.uploads) {
        const upload = withoutAlt(validateCmsMedia({ ...record.upload, alt: { en: "Staged image", ar: "صورة جاهزة للحفظ", th: "Staged image" } }));
        if (uploads.has(upload.id) || typeof record.newlyCreated !== "boolean" || typeof record.ready !== "boolean") throw new Error("invalid staged upload");
        uploads.add(upload.id); record.upload = upload;
      }
    }
    return ledger;
}
async function persistUploads(ledger: UploadLedger) {
  const value = JSON.stringify(ledger, null, 2);
  if (ledger.submissions.length > 5000 || Buffer.byteLength(value) > 16 * 1024 * 1024) throw new CmsError("Upload tracking is full. Run manual Cleanup before starting another submission.", 409, "MEDIA_LEDGER_FULL");
  await atomicFile(uploadsFile(), value);
}
async function findSubmission(ledger: UploadLedger, owner: string, id: string, legacyOwner?: string): Promise<MediaSubmission | undefined> {
  if (!/^[a-f0-9]{64}$/.test(owner)) throw new CmsError("Sign in to the CMS to continue.", 401, "UNAUTHENTICATED");
  const entry = ledger.submissions.find((item) => item.id === id);
  if (entry && entry.owner !== owner) {
    // Only the still-authenticated original session can migrate its legacy
    // receipt. Expired legacy receipts remain protected; never claim by ID.
    if (!legacyOwner || entry.owner !== legacyOwner) throw new CmsError("This image submission belongs to another staff account or an older session. Its files were preserved.", 403, "SUBMISSION_OWNER");
    entry.owner = owner; await persistUploads(ledger);
  }
  return entry;
}
function resolveSaving(entry: MediaSubmission, state: CmsState): MediaSubmission["status"] {
  if (entry.status !== "saving") return entry.status;
  if (state.audit.some((item) => item.action === savedMediaAction(entry.id))) { entry.status = "committed"; return entry.status; }
  // Within this revision window the bounded audit still contains every save.
  // Beyond it the outcome cannot be proven, so assets remain protected.
  if (entry.saveRevision !== undefined && state.revision >= entry.saveRevision && state.revision - entry.saveRevision < 500) { entry.status = "pending"; return entry.status; }
  throw new CmsError("The previous save could not be confirmed. Images are preserved; check the submission again before cleanup.", 503, "SAVE_UNCERTAIN");
}
function activeStagingReference(ledger: UploadLedger, src: string) {
  return ledger.submissions.some((entry) => (entry.status === "saving" || (entry.status === "pending" && Date.now() - Date.parse(entry.updatedAt) < CMS_MEDIA_STAGE_LEASE_MS)) && entry.uploads.some((record) => record.upload.src === src));
}
async function verifiedMediaFile(upload: CmsStagedUpload): Promise<boolean> {
  try {
    const destination = path.join(mediaDirectory(), path.basename(upload.src));
    const file = await stat(destination);
    if (!file.isFile() || file.size !== upload.bytes) return false;
    return createHash("sha256").update(await readFile(destination)).digest("hex") === upload.id;
  } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; }
}
async function removeUnreferencedFile(state: CmsState, ledger: UploadLedger, filename: string, transferReferences: ReadonlySet<string>): Promise<"deleted" | "retained" | "failed"> {
  const src = `/api/cms-media/${filename}`;
  if (!mediaFilenamePattern.test(filename) || contentOrTrashReferences(state, src) || activeStagingReference(ledger, src) || transferReferences.has(filename) || await historyReferences(src)) return "retained";
  try {
    const destination = path.join(mediaDirectory(), filename), file = await stat(destination);
    if (!file.isFile() || file.size > MAX_MEDIA_UPLOAD_BYTES || createHash("sha256").update(await readFile(destination)).digest("hex") !== filename.split(".")[0]) return "failed";
    await unlink(destination); return "deleted";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // The provider object may be absent while its durable upload intent still
      // exists. Remove that confirmed unreferenced intent as well.
      try { await unlink(path.join(mediaDirectory(), filename)); }
      catch (cleanupError) { if ((cleanupError as NodeJS.ErrnoException).code !== "ENOENT") return "failed"; }
      return "deleted";
    }
    console.error("A confirmed unreferenced CMS image could not be deleted; manual Cleanup can retry it.", error); return "failed";
  }
}
export async function stageCmsMedia(owner: string, submissionValue: unknown, bytes: Uint8Array, mime: string, name: string, legacyOwner?: string): Promise<{ upload: CmsStagedUpload }> {
  const submissionId = validateSubmissionId(submissionValue);
  if (!bytes.byteLength || bytes.byteLength > MAX_MEDIA_UPLOAD_BYTES) throw new CmsError("Prepared images must be smaller than 5 MB.", 413, "IMAGE_TOO_LARGE");
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) throw new CmsError("Choose a JPEG, PNG or WebP image.", 415, "IMAGE_TYPE");
  const details = imageDetails(bytes, mime);
  if (details.width > MAX_MEDIA_DIMENSION || details.height > MAX_MEDIA_DIMENSION) throw new CmsError("Resize oversized images in the browser before submitting.", 413, "IMAGE_DIMENSIONS");
  const id = createHash("sha256").update(bytes).digest("hex"), filename = `${id}.${details.extension}`;
  const supplied = withoutAlt(validateCmsMedia({ id, src: `/api/cms-media/${filename}`, name, alt: { en: "Staged image", ar: "صورة جاهزة للحفظ", th: "Staged image" }, width: details.width, height: details.height, bytes: bytes.byteLength, createdAt: new Date().toISOString() }));
  return serial(async () => {
    const state = await prepareState(), ledger = await readUploads();
    let submission = await findSubmission(ledger, owner, submissionId, legacyOwner);
    if (submission) resolveSaving(submission, state);
    if (submission?.status === "abandoned") throw new CmsError("This submission was closed. Start a new submission and upload its images again.", 409, "SUBMISSION_ABANDONED");
    if (submission?.status === "committed") {
      const previous = submission.uploads.find((record) => record.upload.id === id);
      if (!previous) throw new CmsError("A completed submission cannot accept another image.", 409, "SUBMISSION_COMMITTED");
      return { upload: previous.upload };
    }
    if (state.trash.some((entry) => entry.kind === "media" && entry.item.id === id)) throw new CmsError("This image is in Trash. Restore it before uploading it again.", 409, "MEDIA_IN_TRASH");
    if (!submission) {
      submission = { id: submissionId, owner, status: "pending", updatedAt: new Date().toISOString(), uploads: [] }; ledger.submissions.push(submission);
    }
    submission.updatedAt = new Date().toISOString();
    let record = submission.uploads.find((item) => item.upload.id === id);
    const existing = [...state.draft.media, ...state.published.media].find((item) => item.id === id);
    if (!record) {
      if (submission.uploads.length >= MAX_MEDIA_BATCH) throw new CmsError(`Submit no more than ${MAX_MEDIA_BATCH} images together.`, 400, "MEDIA_BATCH_LIMIT");
      let missing = false;
      try { await stat(path.join(mediaDirectory(), filename)); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; missing = true; }
      record = { upload: existing ? withoutAlt(existing) : supplied, newlyCreated: missing && !existing, ready: false };
      submission.uploads.push(record);
    }
    // Write ownership before writing bytes so interrupted uploads remain tracked.
    await persistUploads(ledger);
    if (!await verifiedMediaFile(record.upload)) {
      let missing = false;
      try { await stat(path.join(mediaDirectory(), path.basename(record.upload.src))); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; missing = true; }
      if (!missing) throw new CmsError("An existing image file does not match its verified identity. It was preserved for recovery.", 503, "MEDIA_STORAGE_INVALID");
      await atomicFile(path.join(mediaDirectory(), path.basename(record.upload.src)), bytes);
    }
    record.ready = true; await persistUploads(ledger);
    return { upload: structuredClone(record.upload) };
  });
}
export async function getCmsMediaSubmission(owner: string, submissionValue: unknown, legacyOwner?: string): Promise<CmsMediaSubmissionResult> {
  const id = validateSubmissionId(submissionValue);
  return serial(async () => {
    const state = await prepareState(), ledger = await readUploads(), entry = await findSubmission(ledger, owner, id, legacyOwner);
    if (!entry) return { status: "pending", uploads: [] };
    resolveSaving(entry, state);
    if (entry.status === "pending") entry.updatedAt = new Date().toISOString();
    await persistUploads(ledger);
    return { status: entry.status as CmsMediaSubmissionResult["status"], uploads: entry.uploads.filter((record) => record.ready).map((record) => record.upload), ...(entry.status === "committed" ? { state } : {}) };
  });
}
export async function commitCmsMedia(owner: string, submissionValue: unknown, revisionValue: unknown, uploadsValue: unknown, legacyOwner?: string): Promise<{ state: CmsState; media: CmsMedia[] }> {
  const id = validateSubmissionId(submissionValue), revision = validateRevision(revisionValue);
  if (!Array.isArray(uploadsValue) || !uploadsValue.length || uploadsValue.length > MAX_MEDIA_BATCH) throw new CmsError("Choose the prepared images to save.", 400, "MEDIA_BATCH_INCOMPLETE");
  return serial(async () => {
    const state = await prepareState(), ledger = await readUploads(), entry = await findSubmission(ledger, owner, id, legacyOwner);
    if (!entry) throw new CmsError("Upload this submission's prepared images before saving.", 400, "SUBMISSION_MISSING");
    resolveSaving(entry, state);
    if (entry.status === "abandoned") throw new CmsError("This submission was closed. Upload its images again in a new submission.", 409, "SUBMISSION_ABANDONED");
    const selected = new Set<string>();
    const media = uploadsValue.map((value: unknown) => {
      if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !["id", "alt"].includes(key))) throw new CmsError("Check the image save fields.");
      const item = value as { id: unknown; alt: unknown }, record = entry.uploads.find((record) => record.upload.id === item.id && (record.ready || entry.status === "committed"));
      if (!record || selected.has(record.upload.id)) throw new CmsError("Every image must belong to this submission and be uploaded once.", 400, "MEDIA_BATCH_INCOMPLETE");
      selected.add(record.upload.id); return validateCmsMedia({ ...record.upload, alt: item.alt });
    });
    if (selected.size !== entry.uploads.length) throw new CmsError("Finish uploading every selected image before saving.", 400, "MEDIA_BATCH_INCOMPLETE");
    const payloadHash = createHash("sha256").update(JSON.stringify(media.map((item) => ({ id: item.id, alt: item.alt })).sort((a, b) => a.id.localeCompare(b.id)))).digest("hex");
    if (entry.status === "committed") {
      if (entry.payloadHash !== payloadHash) throw new CmsError("This submission already saved different image details. Start another submission to change them.", 409, "SUBMISSION_COMMITTED");
      return { state, media: entry.uploads.map((record) => [...state.draft.media, ...state.published.media, ...state.trash.filter((item) => item.kind === "media").map((item) => item.item as CmsMedia)].find((item) => item.id === record.upload.id)).filter((item): item is CmsMedia => Boolean(item)) };
    }
    assertRevision(state, revision);
    for (const item of media) {
      if (state.trash.some((entry) => entry.kind === "media" && entry.item.id === item.id)) throw new CmsError("A selected image is in Trash. Restore it before saving.", 409, "MEDIA_IN_TRASH");
      if (!await verifiedMediaFile(item)) throw new CmsError("A staged image is missing or no longer matches. Upload it again before saving.", 400, "MEDIA_MISSING");
    }
    const newMedia = media.filter((item) => !state.draft.media.some((existing) => existing.id === item.id));
    const changedDescriptions = media.filter((item) => {
      const existing = state.draft.media.find((entry) => entry.id === item.id);
      return existing && JSON.stringify(existing.alt) !== JSON.stringify(item.alt);
    });
    if (state.draft.media.length + newMedia.length > 1000) throw new CmsError("The media library has reached its 1,000 image limit.", 400, "MEDIA_LIMIT");
    if (!newMedia.length && !changedDescriptions.length) {
      entry.status = "committed"; entry.payloadHash = payloadHash; entry.updatedAt = new Date().toISOString(); await persistUploads(ledger);
      return { state, media: media.map((item) => state.draft.media.find((existing) => existing.id === item.id)!) };
    }
    entry.status = "saving"; entry.payloadHash = payloadHash; entry.saveRevision = revision; entry.updatedAt = new Date().toISOString();
    await persistUploads(ledger);
    state.draft.media.push(...newMedia);
    for (const item of changedDescriptions) state.draft.media.find((existing) => existing.id === item.id)!.alt = item.alt;
    activity(state, savedMediaAction(id));
    let saved: CmsState;
    try { saved = await persist(state); }
    catch (error) {
      // A transport or rename error can follow a successful atomic save.
      // Read back its submission marker before reporting failure or cleaning.
      try { const readback = await readCmsState(); if (resolveSaving(entry, readback) === "committed") saved = readback; else { await persistUploads(ledger); throw error; } }
      catch (verificationError) { if (verificationError !== error && entry.status === "saving") throw new CmsError("The save outcome could not be verified. Images were retained; check the submission status.", 503, "SAVE_UNCERTAIN"); throw verificationError; }
    }
    entry.status = "committed"; await persistUploads(ledger);
    return { state: saved!, media: media.map((item) => saved!.draft.media.find((existing) => existing.id === item.id)!) };
  });
}
export async function abandonCmsMediaSubmission(owner: string, submissionValue: unknown, legacyOwner?: string): Promise<CmsMediaCleanupResult> {
  const id = validateSubmissionId(submissionValue);
  return serial(async () => {
    const state = await prepareState(), ledger = await readUploads(), entry = await findSubmission(ledger, owner, id, legacyOwner);
    if (!entry) return { status: "abandoned", deletedIds: [], retainedIds: [], failedIds: [] };
    resolveSaving(entry, state);
    if (entry.status === "committed") { await persistUploads(ledger); return { status: "committed", deletedIds: [], retainedIds: entry.uploads.map((record) => record.upload.id), failedIds: [], state }; }
    entry.status = "abandoned"; entry.updatedAt = new Date().toISOString(); await persistUploads(ledger);
    const result: CmsMediaCleanupResult = { status: "abandoned", deletedIds: [], retainedIds: [], failedIds: [] };
    const transferReferences = await backupTransferReferenceSnapshot();
    for (const record of entry.uploads) {
      const outcome = record.newlyCreated ? await removeUnreferencedFile(state, ledger, path.basename(record.upload.src), transferReferences) : "retained";
      result[outcome === "deleted" ? "deletedIds" : outcome === "failed" ? "failedIds" : "retainedIds"].push(record.upload.id);
      if (outcome === "deleted") record.ready = false;
    }
    await persistUploads(ledger); return result;
  });
}
export async function cleanupCmsMedia(): Promise<CmsMediaCleanupSummary> {
  return serial(async () => {
    const state = await prepareState(), ledger = await readUploads();
    for (const entry of ledger.submissions) {
      // Uncertain old saves remain protected, even after their active lease.
      try { resolveSaving(entry, state); } catch (error) { if (!(error instanceof CmsError) || error.code !== "SAVE_UNCERTAIN") throw error; }
      if (entry.status === "pending" && Date.now() - Date.parse(entry.updatedAt) >= CMS_MEDIA_STAGE_LEASE_MS) entry.status = "abandoned";
    }
    await persistUploads(ledger);
    const filenames = new Set(ledger.expiredFiles);
    try { for (const file of await readdir(mediaDirectory(), { withFileTypes: true })) if (file.isFile() && mediaFilenamePattern.test(file.name)) filenames.add(file.name); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const result: CmsMediaCleanupSummary = { deletedIds: [], retainedIds: [], failedIds: [] }, deleted = new Set<string>();
    const transferReferences = await backupTransferReferenceSnapshot();
    for (const filename of filenames) {
      const outcome = await removeUnreferencedFile(state, ledger, filename, transferReferences);
      result[outcome === "deleted" ? "deletedIds" : outcome === "failed" ? "failedIds" : "retainedIds"].push(filename.split(".")[0]);
      if (outcome === "deleted") deleted.add(filename);
    }
    ledger.expiredFiles = ledger.expiredFiles.filter((filename) => !deleted.has(filename));
    for (const entry of ledger.submissions) for (const record of entry.uploads) if (deleted.has(path.basename(record.upload.src))) record.ready = false;
    // Keep retry identities for 30 days, then compact only settled submissions.
    ledger.submissions = ledger.submissions.filter((entry) => entry.status === "saving" || entry.status === "pending" || Date.now() - Date.parse(entry.updatedAt) < CMS_TRASH_TTL_MS || entry.uploads.some((record) => record.ready && record.newlyCreated && !contentOrTrashReferences(state, record.upload.src)));
    await persistUploads(ledger); return result;
  });
}
export async function deleteCmsMedia(revisionValue: unknown, idValue: unknown): Promise<CmsState> {
  const revision = validateRevision(revisionValue);
  if (typeof idValue !== "string" || !/^[a-f0-9]{64}$/.test(idValue)) throw new CmsError("Choose an image from the media library.");
  return serial(async () => {
    const state = await prepareState();
    const media = [...state.draft.media, ...state.published.media].find((entry) => entry.id === idValue);
    if (!media) { if (state.revision === revision + 1 && state.trash.some((entry) => entry.kind === "media" && entry.item.id === idValue)) return state; throw new CmsError("Image was not found.", 404, "MEDIA_NOT_FOUND"); }
    assertRevision(state, revision);
    if (mediaInUse(state, state.draft, media.src)) throw new CmsError("This image is used by live or retained trash content. Replace those references before deleting it.", 409, "MEDIA_REFERENCED");
    const position = state.draft.media.findIndex((item) => item.id === idValue);
    addTrash(state, "media", media, Math.max(0, position));
    state.draft.media = state.draft.media.filter((item) => item.id !== idValue); state.published.media = state.published.media.filter((item) => item.id !== idValue);
    activity(state, `Moved image to trash: ${media.name}`);
    return persist(state);
  });
}
export async function moveCmsItemToTrash(revisionValue: unknown, kindValue: unknown, keyValue: unknown, contentValue: unknown): Promise<CmsState> {
  const revision = validateRevision(revisionValue);
  if (!trashKinds.includes(kindValue as CmsTrashKind) || typeof keyValue !== "string" || keyValue.length > 80 || !keyValue) throw new CmsError("Choose a supported CMS record.");
  const kind = kindValue as CmsTrashKind, key = keyValue;
  const supplied = validateCmsContent(contentValue);
  if (kind === "product" && key === HONEY_ID) throw new CmsError("The honey product cannot be deleted. Archive it instead.", 409, "HONEY_PROTECTED");
  return serial(async () => {
    const state = await prepareState();
    const content = preserveCmsRoutes(supplied, state);
    assertCmsSettingsPermission(state, content);
    const sourceItems = items(content, kind), position = sourceItems.findIndex((item) => itemKey(kind, item) === key), selected = sourceItems[position];
    if (!selected) throw new CmsError("The selected record was not found in your draft.", 404, "TRASH_SOURCE_MISSING");
    const next = structuredClone(content); replaceItems(next, kind, items(next, kind).filter((item) => itemKey(kind, item) !== key));
    const previous = state.trash.find((entry) => entry.kind === kind && itemKey(kind, entry.item) === key && JSON.stringify(entry.item) === JSON.stringify(selected));
    if (state.revision === revision + 1 && previous && JSON.stringify(state.draft) === JSON.stringify(next)) return state;
    assertRevision(state, revision); await verifyMedia(content, state);
    if (kind === "media") {
      captureRemoved(state, next, false, `${kind}:${key}`);
      if (mediaInUse(state, next, (selected as CmsMedia).src)) throw new CmsError("This image is used by live or retained trash content. Replace those references before deleting it.", 409, "MEDIA_REFERENCED");
      addTrash(state, kind, selected, position);
    } else { addTrash(state, kind, selected, position); captureRemoved(state, next, false, `${kind}:${key}`); }
    if (kind === "media") state.published.media = state.published.media.filter((item) => item.id !== key);
    state.draft = next; activity(state, `Moved ${kind} to trash: ${key}`); return persist(state);
  });
}
export async function restoreCmsTrashItem(revisionValue: unknown, idValue: unknown): Promise<CmsState> {
  const revision = validateRevision(revisionValue);
  if (typeof idValue !== "string" || !/^[a-f0-9-]{36}$/i.test(idValue)) throw new CmsError("Choose a record from trash.");
  return serial(async () => {
    const state = await prepareState();
    const entry = state.trash.find((item) => item.id === idValue), label = `Restored trash ${idValue}`;
    if (!entry) { if (state.revision === revision + 1 && state.audit[0]?.action === label) return state; throw new CmsError("This item is no longer in trash. It may have expired or already been restored.", 404, "TRASH_NOT_FOUND"); }
    assertRevision(state, revision);
    const content = structuredClone(state.draft), collection = items(content, entry.kind);
    const key = itemKey(entry.kind, entry.item);
    if (collection.some((item) => itemKey(entry.kind, item) === key || (entry.kind === "product" && (item as CmsProduct).slug === (entry.item as CmsProduct).slug))) throw new CmsError("An item with the same identity or route already exists. Change that item before restoring this one.", 409, "TRASH_RESTORE_CONFLICT");
    collection.splice(Math.min(entry.position, collection.length), 0, structuredClone(entry.item)); replaceItems(content, entry.kind, collection);
    try { const validated = validateCmsContent(content); await verifyMedia(validated, state, entry.kind === "media" ? [entry.item] : []); state.draft = validated; }
    catch (error) { throw new CmsError(error instanceof CmsError ? `Cannot restore this item: ${error.message}` : "The image needed for restoration is unavailable.", 409, "TRASH_RESTORE_CONFLICT"); }
    if (Date.parse(entry.expiresAt) <= Date.now()) throw new CmsError("This item reached its 30-day expiry while being checked and can no longer be restored.", 410, "TRASH_EXPIRED");
    state.trash = state.trash.filter((item) => item.id !== idValue); activity(state, label); return persist(state);
  });
}
export async function readCmsMedia(filename: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (cmsMode() === "unavailable" || !/^[a-f0-9]{64}\.(jpg|png|webp|gif)$/.test(filename)) return null;
  const state = await getCmsState();
  const src = `/api/cms-media/${filename}`;
  if (![...state.draft.media, ...state.published.media].some((entry) => entry.src === src)) return null;
  try { const bytes = await readFile(path.join(mediaDirectory(), filename)); const extension = path.extname(filename).slice(1); return { bytes, mime: ({ jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" } as Record<string, string>)[extension] }; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}
export async function readTrashedCmsMedia(filename: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (cmsMode() === "unavailable" || !/^[a-f0-9]{64}\.(jpg|png|webp|gif)$/.test(filename)) return null;
  const state = await getCmsState(), src = `/api/cms-media/${filename}`;
  if (!state.trash.some((entry) => entry.kind === "media" && entry.item.src === src && Date.parse(entry.expiresAt) > Date.now())) return null;
  try { const bytes = await readFile(path.join(mediaDirectory(), filename)); const extension = path.extname(filename).slice(1); return { bytes, mime: ({ jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" } as Record<string, string>)[extension] }; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}

export const CMS_BACKUP_LIMIT_BYTES = 128 * 1024 * 1024;
type CmsBackupFile = { filename: string; bytes: number; sha256: string; base64: string };
type CmsBackup = { format: "vetra-cms-backup"; version: 1; createdAt: string; state: CmsState; uploads: UploadLedger; history: CmsHistoryEntry[]; files: CmsBackupFile[] };
export type CmsBackupMetadata = Omit<CmsBackup, "files">;
function backupHash(backup: CmsBackup) { return createHash("sha256").update(JSON.stringify(backup)).digest("hex"); }
export function backupReferences(backup: CmsBackupMetadata): Set<string> {
  const filenames = new Set<string>();
  const add = (src: string) => { if (src.startsWith("/api/cms-media/")) filenames.add(path.basename(src)); };
  for (const content of [backup.state.draft, backup.state.published, ...backup.history.flatMap((entry) => [entry.draft, entry.published])]) {
    for (const media of content.media) add(media.src);
    cmsImageSources(content).forEach(add);
  }
  for (const entry of backup.state.trash) {
    if (entry.kind === "media" || entry.kind === "slide") add(entry.item.src);
    else {
      add(entry.item.image);
      if (entry.kind === "product") for (const image of entry.item.gallery || []) add(image.src);
      else for (const copy of Object.values(entry.item.content)) { if (copy.socialImage) add(copy.socialImage); for (const section of copy.sections) if (section.image) add(section.image.src); }
    }
  }
  return filenames;
}
function validateBackup(value: unknown): CmsBackup {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CmsError("Choose a complete VETRA CMS backup.");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !["format", "version", "createdAt", "state", "uploads", "history", "files"].includes(key)) || record.format !== "vetra-cms-backup" || record.version !== 1 || typeof record.createdAt !== "string" || !Number.isFinite(Date.parse(record.createdAt)) || !Array.isArray(record.history) || record.history.length > HISTORY_LIMIT || !Array.isArray(record.files) || record.files.length > 10000) throw new CmsError("Choose a supported complete VETRA CMS backup.");
  const seen = new Set<string>(), dimensions = new Map<string, { width: number; height: number; bytes: number }>(); let total = 0;
  const files = record.files.map((value): CmsBackupFile => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new CmsError("Check backup image files.");
    const file = value as Record<string, unknown>;
    if (Object.keys(file).some((key) => !["filename", "bytes", "sha256", "base64"].includes(key)) || typeof file.filename !== "string" || !mediaFilenamePattern.test(file.filename) || seen.has(file.filename) || typeof file.base64 !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.base64) || file.base64.length > Math.ceil(MAX_MEDIA_UPLOAD_BYTES / 3) * 4) throw new CmsError("Check backup image files.");
    const bytes = Buffer.from(file.base64, "base64"), sha256 = createHash("sha256").update(bytes).digest("hex"); total += bytes.length;
    if (!bytes.length || bytes.length > MAX_MEDIA_UPLOAD_BYTES || bytes.length !== file.bytes || sha256 !== file.sha256 || sha256 !== file.filename.split(".")[0] || total > CMS_BACKUP_LIMIT_BYTES) throw new CmsError("A backup image does not match its checksum or allowed size.", 400, "BACKUP_INVALID");
    const extension = path.extname(file.filename).slice(1), mime = ({ jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" } as Record<string, string>)[extension];
    const details = imageDetails(bytes, mime);
    if (details.extension !== extension) throw new CmsError("A backup image does not match its format.");
    dimensions.set(file.filename, { width: details.width, height: details.height, bytes: bytes.length });
    seen.add(file.filename); return { filename: file.filename, bytes: bytes.length, sha256, base64: file.base64 };
  });
  const backup: CmsBackup = { format: "vetra-cms-backup", version: 1, createdAt: record.createdAt, state: normalizeCmsIdentities(validateCmsState(record.state)), uploads: validateUploadLedger(record.uploads), history: record.history.map(validateHistory), files };
  if (new Set(backup.history.map((entry) => entry.id)).size !== backup.history.length) throw new CmsError("Backup revision IDs must be unique.");
  if ([...backupReferences(backup)].some((name) => !seen.has(name))) throw new CmsError("This backup is missing an image used by content, Trash, or retained history.", 400, "BACKUP_INCOMPLETE");
  const metadata = [...backup.state.draft.media, ...backup.state.published.media, ...backup.state.trash.filter((entry) => entry.kind === "media").map((entry) => entry.item as CmsMedia), ...backup.history.flatMap((entry) => [...entry.draft.media, ...entry.published.media])];
  for (const media of metadata) {
    const details = dimensions.get(path.basename(media.src));
    if (!details || details.width !== media.width || details.height !== media.height || details.bytes !== media.bytes) throw new CmsError("Backup image dimensions or size do not match the stored media details.", 400, "BACKUP_INVALID");
  }
  if (Buffer.byteLength(JSON.stringify(backup)) > CMS_BACKUP_LIMIT_BYTES) throw new CmsError("The backup exceeds the 128 MB local restore limit.", 413, "BACKUP_TOO_LARGE");
  return backup;
}
export async function createCmsBackup(): Promise<CmsBackup> {
  assertCmsOwner();
  return serial(async () => {
    const state = await prepareState(), uploads = await readUploads(), history = (await historyEntries()).slice(0, HISTORY_LIMIT);
    const backup: CmsBackup = { format: "vetra-cms-backup", version: 1, createdAt: new Date().toISOString(), state, uploads, history, files: [] };
    let names: string[] = [];
    try { names = (await readdir(mediaDirectory(), { withFileTypes: true })).filter((file) => file.isFile() && mediaFilenamePattern.test(file.name)).map((file) => file.name); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    let size = Buffer.byteLength(JSON.stringify(backup));
    for (const filename of names.sort()) {
      const destination = path.join(mediaDirectory(), filename), details = await stat(destination);
      if (!details.isFile() || !details.size || details.size > MAX_MEDIA_UPLOAD_BYTES) throw new CmsError("An image needs repair before a complete backup can be created.", 503, "BACKUP_INCOMPLETE");
      size += Math.ceil(details.size / 3) * 4 + 300;
      if (size > CMS_BACKUP_LIMIT_BYTES) throw new CmsError("The complete backup exceeds the 128 MB local transfer limit. Use the configured storage backup process.", 413, "BACKUP_TOO_LARGE");
      const bytes = await readFile(destination), sha256 = createHash("sha256").update(bytes).digest("hex");
      if (sha256 !== filename.split(".")[0]) throw new CmsError("An image checksum failed. Existing files have been preserved.", 503, "BACKUP_INCOMPLETE");
      backup.files.push({ filename, bytes: bytes.length, sha256, base64: bytes.toString("base64") });
    }
    return validateBackup(backup);
  });
}
export async function inspectCmsBackup(value: unknown) {
  assertCmsOwner();
  const backup = validateBackup(value), state = await getCmsState();
  return { planHash: backupHash(backup), revision: state.revision, createdAt: backup.createdAt, products: backup.state.draft.products.length, articles: backup.state.draft.articles.length, images: backup.files.length, revisions: backup.history.length, changes: cmsChanges(state.draft, backup.state.draft), restoreMode: "draft" as const };
}
export async function restoreCmsBackup(revisionValue: unknown, planValue: unknown, value: unknown): Promise<CmsState> {
  assertCmsOwner();
  const revision = validateRevision(revisionValue), backup = validateBackup(value), hash = backupHash(backup);
  if (typeof planValue !== "string" || planValue !== hash) throw new CmsError("Inspect this exact backup before restoring it.", 409, "BACKUP_PLAN_CHANGED");
  return restorePreparedCmsBackup(revision, hash, backup, backup.files);
}
/** Internal transfer services call this only after their manifest and every file are verified. */
export async function restorePreparedCmsBackup(revisionValue: unknown, hash: string, backup: CmsBackupMetadata, files: CmsBackupFile[] = []): Promise<CmsState> {
  assertCmsOwner();
  const revision = validateRevision(revisionValue);
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new CmsError("Check the verified backup identity.");
  return serial(async () => {
    const state = await prepareState(), marker = `Restored backup ${hash.slice(0, 24)}`;
    if (state.revision === revision + 1 && state.audit[0]?.action === marker) return state;
    assertRevision(state, revision);
    const restored = preserveCmsRoutes(backup.state.draft, state, true), currentMedia = [...state.draft.media, ...state.published.media];
    restored.media = restored.media.map((media) => { const existing = currentMedia.find((item) => item.id === media.id); return existing ? { ...existing, alt: media.alt, name: media.name } : media; });
    // Plan all content/Trash changes before any bytes or upload tracking are written.
    captureRemoved(state, restored, false, "", true);
    state.draft = restored;
    for (const entry of backup.state.trash) if (Date.parse(entry.expiresAt) > Date.now() && !state.trash.some((current) => current.id === entry.id)) state.trash.push(structuredClone(entry));
    if (state.trash.length > CMS_TRASH_LIMIT || Buffer.byteLength(JSON.stringify(state)) > 32 * 1024 * 1024) throw new CmsError("There is not enough retained-content capacity to restore this backup safely.", 409, "TRASH_CAPACITY");
    validateCmsState(state);
    const ledger = await readUploads();
    for (const entry of backup.uploads.submissions) if (!ledger.submissions.some((current) => current.id === entry.id)) {
      const imported = structuredClone(entry);
      try { resolveSaving(imported, backup.state); } catch { /* Uncertain outcomes remain protected. */ }
      if (imported.status === "pending") imported.status = "abandoned";
      ledger.submissions.push(imported);
    }
    ledger.expiredFiles = [...new Set([...ledger.expiredFiles, ...backup.uploads.expiredFiles])];
    // Track imported uploads before restoring bytes; an interrupted transfer can be retried safely.
    await persistUploads(ledger);
    for (const file of files) {
      const destination = path.join(mediaDirectory(), file.filename);
      try { const existing = await readFile(destination); if (createHash("sha256").update(existing).digest("hex") !== file.sha256) throw new CmsError("A different existing media file was preserved. Repair it before restoring this backup.", 409, "BACKUP_MEDIA_CONFLICT"); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; await atomicFile(destination, Buffer.from(file.base64, "base64")); }
    }
    await verifyMedia(restored, state, restored.media);
    const knownHistory = await historyEntries();
    for (const entry of backup.history) if (Date.parse(entry.at) + CMS_TRASH_TTL_MS > Date.now() && !knownHistory.some((current) => current.id === entry.id)) await atomicFile(path.join(historyDirectory(), `${entry.id}.json`), JSON.stringify(entry));
    activity(state, marker); return persist(state);
  });
}

export function cmsBackupTransaction<T>(task: () => Promise<T>) { assertCmsOwner(); return serial(task); }
export async function captureCmsBackupMetadata(): Promise<CmsBackupMetadata> {
  assertCmsOwner();
  return { format: "vetra-cms-backup", version: 1, createdAt: new Date().toISOString(), state: await readCmsState(), uploads: await readUploads(), history: (await historyEntries()).slice(0, HISTORY_LIMIT) };
}
export function validateCmsBackupMetadata(value: unknown): CmsBackupMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CmsError("Check backup metadata.");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !["format", "version", "createdAt", "state", "uploads", "history"].includes(key)) || record.format !== "vetra-cms-backup" || record.version !== 1 || typeof record.createdAt !== "string" || !Number.isFinite(Date.parse(record.createdAt)) || !Array.isArray(record.history) || record.history.length > HISTORY_LIMIT) throw new CmsError("Unsupported backup metadata.");
  const result: CmsBackupMetadata = { format: "vetra-cms-backup", version: 1, createdAt: record.createdAt, state: normalizeCmsIdentities(validateCmsState(record.state)), uploads: validateUploadLedger(record.uploads), history: record.history.map(validateHistory) };
  if (new Set(result.history.map((entry) => entry.id)).size !== result.history.length) throw new CmsError("Backup revision IDs must be unique.");
  return result;
}

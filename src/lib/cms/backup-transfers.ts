import path from "node:path";
import { assertCmsOwner, cmsDirectory } from "./auth";
import { atomicFile, listFileMetadata, readFile } from "./storage";
import { CmsError } from "./validation";
import { cmsChanges } from "./publishing";
import { backupReferences, captureCmsBackupMetadata, cmsBackupTransaction, getCmsState, imageDetails, restorePreparedCmsBackup, validateCmsBackupMetadata, type CmsBackupMetadata } from "./server";
import { BACKUP_CHUNK_BYTES, BACKUP_TRANSFER_TTL_MS, backupMediaName, chunkBytes, chunkCount, manifestPayload, validateBackupManifest, type BackupManifest } from "./backup-format";
import { backupDigest, backupTransfers, ownedBackupTransfer, readBackupTransfer, removeBackupTransfer, saveBackupTransfer, transferId, transferOwner, transferPartPath, type BackupTransfer } from "./backup-transfer-store";

const mediaPath = (name: string) => path.join(cmsDirectory(), name);
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";
let cachedExportMedia: { key: string; expires: number; bytes: Promise<Buffer> } | undefined;
async function exportMedia(entry: BackupManifest["files"][number]) {
  const key = `${mediaPath(entry.name)}:${entry.sha256}:${entry.bytes}`;
  if (cachedExportMedia?.key === key && cachedExportMedia.expires > Date.now()) return cachedExportMedia.bytes;
  // One immutable image (at most 5 MiB) per worker. Consecutive chunks do not
  // repeatedly download the whole image from Cloudinary; owner checks still
  // run before every request reaches this cache.
  const bytes = readFile(mediaPath(entry.name)).then((source) => {
    if (source.length !== entry.bytes || backupDigest(source) !== entry.sha256) throw new CmsError("An export image failed its checksum. Existing files were preserved.", 503, "BACKUP_INVALID");
    return source;
  });
  const cached = { key, expires: Date.now() + 30_000, bytes }; cachedExportMedia = cached;
  try { return await bytes; } catch (error) { if (cachedExportMedia === cached) cachedExportMedia = undefined; throw error; }
}
function checkedManifest(value: unknown) {
  try { const manifest = validateBackupManifest(value); if (backupDigest(manifestPayload(manifest)) !== manifest.manifestHash) throw new Error(); return manifest; }
  catch { throw new CmsError("This manifest is damaged or exceeds the supported backup limits.", 400, "BACKUP_MANIFEST_INVALID"); }
}
async function existingTransfer(id: string, direction: BackupTransfer["direction"], hash?: string) {
  try { const job = await ownedBackupTransfer(id); if (job.status === "removing") throw new CmsError("Finish removing this transfer before starting a new one.", 409, "BACKUP_STATE"); if (job.direction !== direction || (hash && job.manifest.manifestHash !== hash)) throw new CmsError("This transfer ID already belongs to a different backup.", 409, "BACKUP_ID_CONFLICT"); return job; }
  catch (error) { if (missing(error)) return null; throw error; }
}
async function ensureCapacity() {
  if ((await backupTransfers()).length >= 8) throw new CmsError("Remove finished or expired backup transfers before starting another.", 409, "BACKUP_TRANSFER_CAPACITY");
}
function newTransfer(id: string, direction: BackupTransfer["direction"], manifest: BackupManifest): BackupTransfer {
  return { id, owner: transferOwner(), direction, manifest, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + BACKUP_TRANSFER_TTL_MS).toISOString(), status: "active", received: {}, verified: [], images: {} };
}
export function backupTransferStatus(job: BackupTransfer) {
  return { id: job.id, direction: job.direction, manifest: job.manifest, expiresAt: job.expiresAt, status: job.status, received: job.received, verified: job.verified, committedRevision: job.committedRevision, inspectRevision: job.inspectRevision, inspectHash: job.inspectHash };
}
export async function startBackupExport(idValue: unknown) {
  assertCmsOwner(); const id = transferId(idValue);
  return cmsBackupTransaction(async () => {
    const existing = await existingTransfer(id, "export"); if (existing) return backupTransferStatus(existing);
    await ensureCapacity();
    const metadata = await captureCmsBackupMetadata();
    const snapshots = new Map<string, Buffer>([["state.json", Buffer.from(JSON.stringify(metadata.state))], ["uploads.json", Buffer.from(JSON.stringify(metadata.uploads))], ...metadata.history.map((entry): [string, Buffer] => [`history/${entry.id}.json`, Buffer.from(JSON.stringify(entry))])]);
    const files = [...snapshots].map(([name, bytes]) => ({ name, bytes: bytes.length, sha256: backupDigest(bytes) }));
    for (const file of await listFileMetadata(path.join(cmsDirectory(), "media"))) {
      if (!backupMediaName.test(`media/${file.name}`) || !file.ready) continue;
      const sha256 = file.name.split(".")[0];
      if (file.hash && file.hash !== sha256) throw new CmsError("A saved image has an unexpected identity. It was preserved.", 503, "BACKUP_INVALID");
      files.push({ name: `media/${file.name}`, bytes: file.bytes, sha256 });
    }
    files.sort((a, b) => a.name < b.name ? -1 : 1);
    const base = { format: "vetra-cms-folder" as const, version: 2 as const, createdAt: metadata.createdAt, sourceRevision: metadata.state.revision, chunkBytes: BACKUP_CHUNK_BYTES, totalBytes: files.reduce((total, file) => total + file.bytes, 0), files };
    const manifest = checkedManifest({ ...base, manifestHash: backupDigest(manifestPayload(base)) });
    if ([...backupReferences(metadata)].some((name) => !files.some((file) => file.name === `media/${name}`))) throw new CmsError("The backup is missing a referenced image. Resolve pending uploads first.", 409, "BACKUP_INCOMPLETE");
    const job = newTransfer(id, "export", manifest);
    // Pin immutable media before releasing the lock. Media bytes are transferred
    // later, one bounded request at a time, without holding the mutation lock.
    await saveBackupTransfer(job);
    for (const [index, file] of files.entries()) {
      const bytes = snapshots.get(file.name); if (!bytes) continue;
      for (let chunk = 0; chunk < chunkCount(file); chunk++) await atomicFile(transferPartPath(id, index, chunk), JSON.stringify({ base64: bytes.subarray(chunk * BACKUP_CHUNK_BYTES, (chunk + 1) * BACKUP_CHUNK_BYTES).toString("base64") }));
      job.verified.push(index);
    }
    await saveBackupTransfer(job); return backupTransferStatus(job);
  });
}
export async function startBackupImport(idValue: unknown, manifestValue: unknown) {
  assertCmsOwner(); const id = transferId(idValue), manifest = checkedManifest(manifestValue);
  return cmsBackupTransaction(async () => {
    const existing = await existingTransfer(id, "import", manifest.manifestHash); if (existing) return backupTransferStatus(existing);
    await ensureCapacity(); const job = newTransfer(id, "import", manifest); await saveBackupTransfer(job); return backupTransferStatus(job);
  });
}
function transferFile(job: BackupTransfer, fileValue: unknown) {
  if (!Number.isInteger(fileValue) || Number(fileValue) < 0 || Number(fileValue) >= job.manifest.files.length) throw new CmsError("Choose a valid backup file.");
  return job.manifest.files[Number(fileValue)];
}
function transferChunk(job: BackupTransfer, file: number, value: unknown) {
  const entry = transferFile(job, file);
  try { return chunkBytes(entry, Number(value)); } catch { throw new CmsError("Choose a valid backup chunk."); }
}
async function partBytes(id: string, file: number, chunk: number) {
  const record = JSON.parse(await readFile(transferPartPath(id, file, chunk), "utf8"));
  if (typeof record.base64 !== "string" || record.base64.length > Math.ceil(BACKUP_CHUNK_BYTES / 3) * 4) throw new CmsError("Backup chunk is damaged.", 409, "BACKUP_CHUNK_INVALID");
  return Buffer.from(record.base64, "base64");
}
async function assembled(job: BackupTransfer, file: number) {
  const entry = transferFile(job, file), parts: Buffer[] = [];
  for (let chunk = 0; chunk < chunkCount(entry); chunk++) { const bytes = await partBytes(job.id, file, chunk); if (bytes.length !== chunkBytes(entry, chunk)) throw new CmsError("Upload the missing backup chunks first.", 409, "BACKUP_INCOMPLETE"); parts.push(bytes); }
  const bytes = Buffer.concat(parts);
  if (bytes.length !== entry.bytes || backupDigest(bytes) !== entry.sha256) throw new CmsError("Backup file checksum failed. Start a new import with an intact backup folder.", 409, "BACKUP_INVALID");
  return bytes;
}
export async function downloadBackupChunk(id: unknown, file: number, chunk: number) {
  assertCmsOwner(); const job = await ownedBackupTransfer(id), entry = transferFile(job, file); transferChunk(job, file, chunk);
  if (job.direction !== "export" || job.status !== "active") throw new CmsError("Choose an active export transfer.");
  let bytes: Buffer;
  if (backupMediaName.test(entry.name)) {
    const source = await exportMedia(entry);
    bytes = source.subarray(chunk * BACKUP_CHUNK_BYTES, (chunk + 1) * BACKUP_CHUNK_BYTES);
  } else {
    if (!job.verified.includes(file)) throw new CmsError("Snapshot preparation did not finish. Remove this transfer and start again.", 409, "BACKUP_INCOMPLETE");
    bytes = await partBytes(job.id, file, chunk);
  }
  if (bytes.length !== chunkBytes(entry, chunk)) throw new CmsError("Backup chunk size is invalid.", 503, "BACKUP_INVALID");
  return { bytes, sha256: backupDigest(bytes) };
}
export async function uploadBackupChunk(id: unknown, file: number, chunk: number, bytes: Uint8Array) {
  assertCmsOwner();
  return cmsBackupTransaction(async () => {
    const job = await ownedBackupTransfer(id); if (job.direction !== "import" || job.status !== "active") throw new CmsError("This restore transfer is not accepting files.", 409, "BACKUP_STATE");
    if (bytes.byteLength !== transferChunk(job, file, chunk)) throw new CmsError("The backup chunk has the wrong size.", 400, "BACKUP_CHUNK_INVALID");
    try { if (backupDigest(await partBytes(job.id, file, chunk)) !== backupDigest(bytes)) throw new CmsError("A different chunk was already received. Start a new transfer.", 409, "BACKUP_CHUNK_CONFLICT"); }
    catch (error) { if (!missing(error)) throw error; await atomicFile(transferPartPath(job.id, file, chunk), JSON.stringify({ base64: Buffer.from(bytes).toString("base64") })); }
    job.received[file] = [...new Set([...(job.received[file] || []), chunk])].sort((a, b) => a - b); await saveBackupTransfer(job);
    return { received: true, sha256: backupDigest(bytes) };
  });
}
export async function verifyBackupFile(id: unknown, file: number) {
  assertCmsOwner();
  return cmsBackupTransaction(async () => {
    const job = await ownedBackupTransfer(id); if (job.direction !== "import" || job.status !== "active") throw new CmsError("Choose an active restore transfer.", 409, "BACKUP_STATE");
    const entry = transferFile(job, file), bytes = await assembled(job, file);
    if (backupMediaName.test(entry.name)) {
      const extension = path.extname(entry.name).slice(1), mime = ({ jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" } as Record<string, string>)[extension];
      const dimensions = imageDetails(bytes, mime);
      if (dimensions.extension !== extension) throw new CmsError("An image does not match its original format.");
      try { if (backupDigest(await readFile(mediaPath(entry.name))) !== entry.sha256) throw new CmsError("A conflicting image was preserved.", 409, "BACKUP_MEDIA_CONFLICT"); }
      catch (error) { if (!missing(error)) throw error; await atomicFile(mediaPath(entry.name), bytes); }
      job.images[entry.name] = { width: dimensions.width, height: dimensions.height, bytes: bytes.length };
    } else { try { JSON.parse(bytes.toString("utf8")); } catch { throw new CmsError("Backup metadata is not valid JSON."); } }
    job.verified = [...new Set([...job.verified, file])]; delete job.inspectHash; delete job.inspectRevision; await saveBackupTransfer(job);
    return { verified: true };
  });
}
async function transferMetadata(job: BackupTransfer): Promise<CmsBackupMetadata> {
  if (job.direction !== "import" || job.verified.length !== job.manifest.files.length) throw new CmsError("Transfer and verify every file before inspecting the restore.", 409, "BACKUP_INCOMPLETE");
  const json = new Map<string, unknown>();
  for (const [index, file] of job.manifest.files.entries()) if (!backupMediaName.test(file.name)) json.set(file.name, JSON.parse((await assembled(job, index)).toString("utf8")));
  const metadata = validateCmsBackupMetadata({ format: "vetra-cms-backup", version: 1, createdAt: job.manifest.createdAt, state: json.get("state.json"), uploads: json.get("uploads.json"), history: [...json].filter(([name]) => name.startsWith("history/")).map(([, entry]) => entry) });
  if (metadata.state.revision !== job.manifest.sourceRevision || [...backupReferences(metadata)].some((name) => !job.manifest.files.some((file) => file.name === `media/${name}`))) throw new CmsError("The backup manifest does not cover its saved content.", 409, "BACKUP_INCOMPLETE");
  for (const [name, value] of json) if (name.startsWith("history/") && name !== `history/${(value as { id: string }).id}.json`) throw new CmsError("Backup history identity does not match the manifest.");
  const media = [...metadata.state.draft.media, ...metadata.state.published.media, ...metadata.state.trash.filter((entry) => entry.kind === "media").map((entry) => entry.item), ...metadata.history.flatMap((entry) => [...entry.draft.media, ...entry.published.media])];
  for (const image of media) {
    const actual = job.images[`media/${path.basename(image.src)}`];
    if (!actual || actual.width !== image.width || actual.height !== image.height || actual.bytes !== image.bytes) throw new CmsError("Backup image dimensions do not match its saved metadata.", 409, "BACKUP_INVALID");
  }
  return metadata;
}
export async function inspectBackupTransfer(id: unknown) {
  assertCmsOwner(); const job = await ownedBackupTransfer(id), metadata = await transferMetadata(job), state = await getCmsState();
  const planHash = backupDigest(`${job.manifest.manifestHash}:${state.revision}`);
  await cmsBackupTransaction(async () => { const current = await ownedBackupTransfer(id); if (current.status !== "active") throw new CmsError("This restore is already being committed.", 409, "BACKUP_STATE"); current.inspectRevision = state.revision; current.inspectHash = planHash; await saveBackupTransfer(current); });
  return { revision: state.revision, planHash, products: metadata.state.draft.products.length, articles: metadata.state.draft.articles.length, images: Object.keys(job.images).length, changes: cmsChanges(state.draft, metadata.state.draft), restoreMode: "draft" };
}
async function resolveCommit(job: BackupTransfer) {
  if (job.commitRevision === undefined) return null;
  const state = await getCmsState(), distance = state.revision - job.commitRevision;
  if (distance > 0 && distance <= state.audit.length && state.audit[distance - 1]?.action === `Restored backup ${job.manifest.manifestHash.slice(0, 24)}`) return state;
  if (distance >= 500 || distance < 0) throw new CmsError("The previous restore outcome is uncertain. Its media remains protected; recover the audit before removing this transfer.", 503, "SAVE_UNCERTAIN");
  return null;
}
async function recordCommit(job: BackupTransfer, revision: number) {
  return cmsBackupTransaction(async () => {
    let current: BackupTransfer;
    try { current = await ownedBackupTransfer(job.id, true); } catch (error) { if (missing(error)) return; throw error; }
    // Another request may already have confirmed and manually removed this
    // transfer. Never resurrect it or overwrite a newer recovery attempt.
    if (current.status === "removing" || current.commitRevision !== job.commitRevision) return;
    current.status = "committed"; current.committedRevision = revision; await saveBackupTransfer(current);
  });
}
export async function commitBackupTransfer(id: unknown, revision: unknown, planHash: unknown) {
  assertCmsOwner(); let job = await ownedBackupTransfer(id);
  if (job.status === "removing") throw new CmsError("This transfer is being removed.", 409, "BACKUP_STATE");
  if (job.status === "committed") return { status: "committed", revision: job.committedRevision };
  if (job.status === "committing") {
    const confirmed = await resolveCommit(job);
    if (confirmed) { const savedRevision = job.commitRevision! + 1; await recordCommit(job, savedRevision); return { status: "committed", revision: savedRevision }; }
  }
  const metadata = await transferMetadata(job);
  if (revision !== job.inspectRevision || planHash !== job.inspectHash || typeof planHash !== "string") throw new CmsError("Inspect this exact restore against the current draft first.", 409, "BACKUP_PLAN_CHANGED");
  const alreadyCommitted = await cmsBackupTransaction(async () => { const current = await ownedBackupTransfer(id); if (current.status === "committed") return current.committedRevision; if (current.status === "removing" || current.inspectRevision !== revision || current.inspectHash !== planHash) throw new CmsError("Inspect the backup again.", 409, "BACKUP_PLAN_CHANGED"); current.status = "committing"; current.commitRevision = Number(revision); await saveBackupTransfer(current); job = current; });
  if (alreadyCommitted !== undefined) return { status: "committed", revision: alreadyCommitted };
  try {
    const state = await restorePreparedCmsBackup(revision, job.manifest.manifestHash, metadata);
    await recordCommit(job, state.revision);
    return { status: "committed", revision: state.revision };
  } catch (error) {
    const confirmed = await resolveCommit(job);
    if (confirmed) { const savedRevision = job.commitRevision! + 1; await recordCommit(job, savedRevision); return { status: "committed", revision: savedRevision }; }
    await cmsBackupTransaction(async () => { const current = await ownedBackupTransfer(job.id, true); if (current.status !== "committing" || current.commitRevision !== job.commitRevision) return; current.status = "active"; delete current.inspectRevision; delete current.inspectHash; await saveBackupTransfer(current); });
    throw error;
  }
}
export async function getBackupTransfer(id: unknown) { assertCmsOwner(); return backupTransferStatus(await ownedBackupTransfer(id)); }
export async function listBackupTransfers() { assertCmsOwner(); return (await backupTransfers()).filter((job) => job.owner === transferOwner()).map((job) => ({ id: job.id, direction: job.direction, status: job.status, expiresAt: job.expiresAt, bytes: job.manifest.totalBytes })); }
export async function deleteBackupTransfer(id: unknown) {
  assertCmsOwner(); const job = await ownedBackupTransfer(id, true);
  if (job.status === "committing") {
    const confirmed = await resolveCommit(job); if (!confirmed) throw new CmsError("Retry or resolve the restore before removing its transfer.", 409, "SAVE_UNCERTAIN");
    job.status = "committed"; job.committedRevision = job.commitRevision! + 1;
  }
  return cmsBackupTransaction(async () => { const latest = await readBackupTransfer(job.id); if (latest.status === "committing" && (job.status !== "committed" || latest.commitRevision !== job.commitRevision)) throw new CmsError("Resolve this restore first.", 409, "SAVE_UNCERTAIN"); return removeBackupTransfer({ ...latest, status: latest.status === "committing" ? "committed" : latest.status }); });
}

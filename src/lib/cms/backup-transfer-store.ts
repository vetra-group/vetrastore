import path from "node:path";
import { createHash } from "node:crypto";
import { cmsDirectory, cmsStaffId } from "./auth";
import { atomicFile, readFile, readdir, unlink } from "./storage";
import { CmsError } from "./validation";
import { chunkCount, validateBackupManifest, manifestPayload, type BackupManifest } from "./backup-format";

export type BackupTransfer = {
  id: string; owner: string; direction: "export" | "import"; manifest: BackupManifest;
  createdAt: string; expiresAt: string; status: "active" | "committing" | "committed" | "removing";
  received: Record<string, number[]>; verified: number[];
  images: Record<string, { width: number; height: number; bytes: number }>;
  inspectRevision?: number; inspectHash?: string; commitRevision?: number; committedRevision?: number;
  deleteCursor?: number;
};
export const transferDirectory = () => path.join(cmsDirectory(), "backup-transfers");
export const transferPartPath = (id: string, file: number, chunk: number) => path.join(cmsDirectory(), "backup-parts", id, `${file}-${chunk}.json`);
export const backupDigest = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
export const transferOwner = () => { const identity = cmsStaffId(); if (!identity) throw new CmsError("Sign in to continue.", 401, "UNAUTHENTICATED"); return backupDigest(identity); };
export function transferId(value: unknown) {
  if (typeof value !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)) throw new CmsError("Choose a valid backup transfer.");
  return value;
}
export async function readBackupTransfer(id: string): Promise<BackupTransfer> {
  const value = JSON.parse(await readFile(path.join(transferDirectory(), `${transferId(id)}.json`), "utf8")) as BackupTransfer;
  const manifest = validateBackupManifest(value.manifest);
  if (value.id !== id || !/^[a-f0-9]{64}$/.test(value.owner) || !["export", "import"].includes(value.direction) || !["active", "committing", "committed", "removing"].includes(value.status) || !Number.isFinite(Date.parse(value.expiresAt)) || !value.received || !Array.isArray(value.verified) || (value.deleteCursor !== undefined && (!Number.isSafeInteger(value.deleteCursor) || value.deleteCursor < 0)) || manifest.manifestHash !== backupDigest(manifestPayload(manifest))) throw new CmsError("Backup transfer needs repair. Its images were preserved.", 503, "BACKUP_TRANSFER_INVALID");
  return { ...value, manifest };
}
export async function ownedBackupTransfer(value: unknown, allowExpired = false) {
  const job = await readBackupTransfer(transferId(value));
  if (job.owner !== transferOwner()) throw new CmsError("This backup transfer belongs to another owner.", 403, "BACKUP_OWNER");
  if (!allowExpired && job.status !== "committing" && Date.parse(job.expiresAt) <= Date.now()) throw new CmsError("This backup transfer expired. Start a new transfer using the same verified local folder.", 410, "BACKUP_EXPIRED");
  return job;
}
export async function saveBackupTransfer(job: BackupTransfer) { await atomicFile(path.join(transferDirectory(), `${job.id}.json`), JSON.stringify(job)); }
export async function backupTransfers() {
  let names: string[];
  try { names = await readdir(transferDirectory()); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  const jobs = [];
  for (const name of names) if (/^[a-f0-9-]{36}\.json$/.test(name)) jobs.push(await readBackupTransfer(name.slice(0, -5)));
  return jobs;
}
/** Called inside the existing mutation lock before any media deletion. */
export async function backupTransferReferences(filename: string) {
  return (await backupTransferReferenceSnapshot()).has(filename);
}
/** One snapshot per locked deletion operation, never shared across requests. */
export async function backupTransferReferenceSnapshot(): Promise<ReadonlySet<string>> {
  const references = new Set<string>(), now = Date.now();
  for (const job of await backupTransfers()) if (job.status === "committing" || Date.parse(job.expiresAt) > now) {
    for (const file of job.manifest.files) if (file.name.startsWith("media/")) references.add(file.name.slice(6));
  }
  return references;
}
export async function removeBackupTransfer(job: BackupTransfer) {
  if (job.status === "committing") throw new CmsError("Resolve this restore outcome before removing its transfer.", 409, "SAVE_UNCERTAIN");
  // Bound each authorized cleanup request. A stopped removal resumes from the
  // saved cursor and never keeps the shared content lock for a whole archive.
  const parts = job.manifest.files.flatMap((entry, file) => Array.from({ length: chunkCount(entry) }, (_, chunk) => transferPartPath(job.id, file, chunk)));
  job.status = "removing";
  const start = job.deleteCursor || 0, end = Math.min(start + 32, parts.length);
  await saveBackupTransfer(job);
  for (let index = start; index < end; index++) {
    try { await unlink(parts[index]); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  job.deleteCursor = end;
  if (end < parts.length) { await saveBackupTransfer(job); return { removed: false, completed: end, total: parts.length }; }
  await unlink(path.join(transferDirectory(), `${job.id}.json`));
  return { removed: true, completed: end, total: parts.length };
}

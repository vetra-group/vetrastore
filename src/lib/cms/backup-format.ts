/** Shared, deterministic archive contract. Contains no server data or credentials. */
export const BACKUP_CHUNK_BYTES = 512 * 1024;
export const BACKUP_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;
export const BACKUP_METADATA_BYTES = 128 * 1024 * 1024;
export const BACKUP_FILE_BYTES = 32 * 1024 * 1024;
export const BACKUP_TRANSFER_TTL_MS = 24 * 60 * 60 * 1000;
export type BackupEntry = { name: string; bytes: number; sha256: string };
export type BackupManifest = { format: "vetra-cms-folder"; version: 2; createdAt: string; sourceRevision: number; chunkBytes: number; totalBytes: number; files: BackupEntry[]; manifestHash: string };
export const backupMediaName = /^media\/[a-f0-9]{64}\.(jpg|png|webp|gif)$/;
export const backupMetadataName = /^(state|uploads)\.json$|^history\/\d{1,16}-[a-f0-9]{16}\.json$/;
export function manifestPayload(value: Omit<BackupManifest, "manifestHash"> | BackupManifest) {
  return JSON.stringify({ format: value.format, version: value.version, createdAt: value.createdAt, sourceRevision: value.sourceRevision, chunkBytes: value.chunkBytes, totalBytes: value.totalBytes, files: value.files });
}
export function validateBackupManifest(value: unknown): BackupManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Choose a VETRA backup manifest.");
  const m = value as BackupManifest;
  if (Object.keys(m).some((key) => !["format", "version", "createdAt", "sourceRevision", "chunkBytes", "totalBytes", "files", "manifestHash"].includes(key)) || m.format !== "vetra-cms-folder" || m.version !== 2 || !Number.isFinite(Date.parse(m.createdAt)) || !Number.isSafeInteger(m.sourceRevision) || m.sourceRevision < 0 || m.chunkBytes !== BACKUP_CHUNK_BYTES || !/^[a-f0-9]{64}$/.test(m.manifestHash) || !Array.isArray(m.files) || m.files.length < 2 || m.files.length > 10032) throw new Error("Unsupported backup manifest.");
  const names = new Set<string>(); let total = 0, metadata = 0;
  const files = m.files.map((file) => {
    if (!file || typeof file !== "object" || Object.keys(file).some((key) => !["name", "bytes", "sha256"].includes(key)) || typeof file.name !== "string" || (!backupMediaName.test(file.name) && !backupMetadataName.test(file.name)) || names.has(file.name) || !Number.isSafeInteger(file.bytes) || file.bytes < 1 || file.bytes > (backupMediaName.test(file.name) ? 5 * 1024 * 1024 : BACKUP_FILE_BYTES) || !/^[a-f0-9]{64}$/.test(file.sha256) || (backupMediaName.test(file.name) && file.sha256 !== file.name.slice(6, 70))) throw new Error("Invalid or duplicate backup file.");
    names.add(file.name); total += file.bytes; if (!backupMediaName.test(file.name)) metadata += file.bytes;
    return { name: file.name, bytes: file.bytes, sha256: file.sha256 };
  });
  if (!names.has("state.json") || !names.has("uploads.json") || [...names].filter((name) => name.startsWith("history/")).length > 30 || total !== m.totalBytes || total > BACKUP_TOTAL_BYTES || metadata > BACKUP_METADATA_BYTES) throw new Error("Backup size or metadata is incomplete.");
  if (files.some((file, index) => index > 0 && files[index - 1].name >= file.name)) throw new Error("Backup files must be in their original manifest order.");
  return { format: m.format, version: m.version, createdAt: m.createdAt, sourceRevision: m.sourceRevision, chunkBytes: m.chunkBytes, totalBytes: total, files, manifestHash: m.manifestHash };
}
export function chunkCount(file: BackupEntry) { return Math.ceil(file.bytes / BACKUP_CHUNK_BYTES); }
export function chunkBytes(file: BackupEntry, chunk: number) {
  if (!Number.isInteger(chunk) || chunk < 0 || chunk >= chunkCount(file)) throw new Error("Choose a valid backup chunk.");
  return Math.min(BACKUP_CHUNK_BYTES, file.bytes - chunk * BACKUP_CHUNK_BYTES);
}
export function folderChunkName(file: number, chunk: number) { return `${file}-${chunk}.part`; }

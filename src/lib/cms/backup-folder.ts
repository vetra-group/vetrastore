import { chunkBytes, chunkCount, folderChunkName, manifestPayload, validateBackupManifest, type BackupManifest } from "./backup-format";

export type FolderProgress = { completed: number; total: number; file: string; phase: "download" | "upload" | "verify" };
type TransferStatus = { id: string; manifest: BackupManifest; received: Record<string, number[]>; verified: number[]; status: string; inspectRevision?: number; inspectHash?: string };
type DownloadReceipt = { origin: string; id: string; manifestHash?: string; chunks: Record<string, string> };
const endpoint = "/api/cms/backup-transfer";
export async function browserDigest(bytes: Uint8Array) { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)))].map((value) => value.toString(16).padStart(2, "0")).join(""); }
export async function backupRequest(body: Record<string, unknown>, signal?: AbortSignal) {
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || "Backup request failed."); return data;
}
async function readJson<T>(folder: FileSystemDirectoryHandle, name: string): Promise<T | null> {
  try { return JSON.parse(await (await (await folder.getFileHandle(name)).getFile()).text()) as T; }
  catch (error) { if (error instanceof DOMException && error.name === "NotFoundError") return null; throw error; }
}
async function write(folder: FileSystemDirectoryHandle, name: string, value: Uint8Array | string) {
  const stream = await (await folder.getFileHandle(name, { create: true })).createWritable();
  try { await stream.write(typeof value === "string" ? value : new Uint8Array(value)); await stream.close(); }
  catch (error) { await stream.abort().catch(() => undefined); throw error; }
}
async function readChunk(folder: FileSystemDirectoryHandle, file: number, chunk: number) {
  return new Uint8Array(await (await (await folder.getFileHandle(folderChunkName(file, chunk))).getFile()).arrayBuffer());
}
export async function readFolderManifest(folder: FileSystemDirectoryHandle) {
  const manifest = validateBackupManifest(await readJson(folder, "manifest.json"));
  if (await browserDigest(new TextEncoder().encode(manifestPayload(manifest))) !== manifest.manifestHash) throw new Error("The backup manifest failed its checksum.");
  return manifest;
}
export async function readFolderFile(folder: FileSystemDirectoryHandle, manifest: BackupManifest, file: number) {
  const entry = manifest.files[file], chunks = await folder.getDirectoryHandle("chunks"), result = new Uint8Array(entry.bytes); let offset = 0;
  for (let part = 0; part < chunkCount(entry); part++) { const bytes = await readChunk(chunks, file, part); if (bytes.length !== chunkBytes(entry, part)) throw new Error("Backup chunk size is invalid."); result.set(bytes, offset); offset += bytes.length; }
  if (offset !== entry.bytes || await browserDigest(result) !== entry.sha256) throw new Error(`Backup checksum failed: ${entry.name}`);
  return result;
}
export async function exportBackupFolder(folder: FileSystemDirectoryHandle, progress: (value: FolderProgress) => void, signal: AbortSignal) {
  let receipt = await readJson<DownloadReceipt>(folder, "export-progress.json");
  if (receipt && (receipt.origin !== location.origin || typeof receipt.id !== "string" || !receipt.chunks || typeof receipt.chunks !== "object")) throw new Error("Resume this export from its original website, or choose an empty backup folder.");
  if (!receipt) {
    if (await readJson(folder, "manifest.json")) throw new Error("This folder already holds another backup. Choose an empty folder.");
    receipt = { origin: location.origin, id: crypto.randomUUID(), chunks: {} }; await write(folder, "export-progress.json", JSON.stringify(receipt));
  }
  const job = await backupRequest({ action: "export", id: receipt.id }, signal) as TransferStatus;
  const manifest = validateBackupManifest(job.manifest);
  if (await browserDigest(new TextEncoder().encode(manifestPayload(manifest))) !== manifest.manifestHash || (receipt.manifestHash && receipt.manifestHash !== manifest.manifestHash)) throw new Error("The export snapshot changed. Choose a new backup folder.");
  receipt.manifestHash = manifest.manifestHash;
  await write(folder, "manifest.json", JSON.stringify(manifest, null, 2));
  const chunks = await folder.getDirectoryHandle("chunks", { create: true }); let completed = 0;
  for (const [file, entry] of manifest.files.entries()) {
    for (let chunk = 0; chunk < chunkCount(entry); chunk++) {
      signal.throwIfAborted(); const key = folderChunkName(file, chunk); let bytes: Uint8Array | undefined;
      if (receipt.chunks[key]) {
        try { const saved = await readChunk(chunks, file, chunk); if (await browserDigest(saved) === receipt.chunks[key]) bytes = saved; } catch { /* Re-download a missing or changed local part. */ }
      }
      if (!bytes) {
        const response = await fetch(`${endpoint}?id=${job.id}&file=${file}&chunk=${chunk}`, { cache: "no-store", signal });
        if (!response.ok) { const error = await response.json(); throw new Error(error.error || "Backup download failed."); }
        bytes = new Uint8Array(await response.arrayBuffer()); const sha = await browserDigest(bytes);
        if (sha !== response.headers.get("X-Chunk-Sha256")) throw new Error("The downloaded chunk failed its checksum.");
        await write(chunks, key, bytes); receipt.chunks[key] = sha; await write(folder, "export-progress.json", JSON.stringify(receipt));
      }
      completed += bytes.length; progress({ completed, total: manifest.totalBytes, file: entry.name, phase: "download" });
    }
    progress({ completed, total: manifest.totalBytes, file: entry.name, phase: "verify" });
    try { await readFolderFile(folder, manifest, file); }
    catch (error) { for (let chunk = 0; chunk < chunkCount(entry); chunk++) delete receipt.chunks[folderChunkName(file, chunk)]; await write(folder, "export-progress.json", JSON.stringify(receipt)); throw error; }
  }
  return job.id;
}
export async function importBackupFolder(folder: FileSystemDirectoryHandle, manifest: BackupManifest, progress: (value: FolderProgress) => void, signal: AbortSignal) {
  let receipt = await readJson<{ origin: string; id: string; manifestHash: string }>(folder, "restore-progress.json");
  if (receipt && (receipt.origin !== location.origin || receipt.manifestHash !== manifest.manifestHash)) receipt = null;
  if (!receipt) { receipt = { origin: location.origin, id: crypto.randomUUID(), manifestHash: manifest.manifestHash }; await write(folder, "restore-progress.json", JSON.stringify(receipt)); }
  const job = await backupRequest({ action: "import", id: receipt.id, manifest }, signal) as TransferStatus;
  if (job.status === "committed") return { id: job.id, committed: true };
  if (job.status === "committing") return { id: job.id, resolving: true, revision: job.inspectRevision, planHash: job.inspectHash };
  let completed = 0; const chunks = await folder.getDirectoryHandle("chunks");
  for (const [file, entry] of manifest.files.entries()) {
    signal.throwIfAborted(); progress({ completed, total: manifest.totalBytes, file: entry.name, phase: "verify" });
    await readFolderFile(folder, manifest, file);
    if (!job.verified.includes(file)) {
      for (let chunk = 0; chunk < chunkCount(entry); chunk++) {
        signal.throwIfAborted(); const bytes = await readChunk(chunks, file, chunk);
        if (!job.received[file]?.includes(chunk)) {
          const response = await fetch(`${endpoint}?id=${job.id}&file=${file}&chunk=${chunk}`, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: new Uint8Array(bytes), signal });
          const data = await response.json(); if (!response.ok || data.sha256 !== await browserDigest(bytes)) throw new Error(data.error || "Backup upload failed its checksum.");
        }
        completed += bytes.length; progress({ completed, total: manifest.totalBytes, file: entry.name, phase: "upload" });
      }
      await backupRequest({ action: "verify", id: job.id, file }, signal);
    } else { completed += entry.bytes; progress({ completed, total: manifest.totalBytes, file: entry.name, phase: "upload" }); }
  }
  return { id: job.id, committed: false };
}
export async function clearFolderRestoreProgress(folder: FileSystemDirectoryHandle, id: string) {
  if ((await readJson<{ id: string }>(folder, "restore-progress.json"))?.id !== id) return false;
  await folder.removeEntry("restore-progress.json").catch((error) => { if (!(error instanceof DOMException) || error.name !== "NotFoundError") throw error; });
  return true;
}

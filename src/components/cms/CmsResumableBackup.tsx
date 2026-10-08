"use client";

import { cmsArabicUi } from "@/content/cms-ar-ui";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Download, FolderOpen, Pause, RotateCcw, Trash2, Upload, X } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { CmsChange, CmsContent, CmsState } from "@/lib/cms/types";
import type { BackupManifest } from "@/lib/cms/backup-format";
import { backupRequest, clearFolderRestoreProgress, exportBackupFolder, importBackupFolder, readFolderFile, readFolderManifest, type FolderProgress } from "@/lib/cms/backup-folder";
import { CmsDialog } from "./CmsDialog";
import { ChangeList } from "./CmsPublishing";
import styles from "./CmsResumableBackup.module.css";
import dialogStyles from "./CmsPublishing.module.css";

type PickerWindow = Window & { showDirectoryPicker?: (options: { mode: "readwrite" }) => Promise<FileSystemDirectoryHandle> };
type Review = { id: string; revision: number; planHash: string; changes: CmsChange[]; draft: CmsContent; resolving?: boolean };
type Job = { id: string; direction: "export" | "import"; status: string; expiresAt: string; bytes: number };
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const subscribe = () => () => undefined;

export function CmsResumableBackup({ locale, state, disabled, onState, onMessage }: { locale: Locale; state: CmsState; disabled: boolean; onState: (state: CmsState) => void; onMessage: (text: string, error?: boolean) => void }) {
  const th = locale === "th", folder = useRef<FileSystemDirectoryHandle | null>(null), controller = useRef<AbortController | null>(null);
  const available = useSyncExternalStore(subscribe, () => typeof (window as PickerWindow).showDirectoryPicker === "function", () => false);
  const currentOrigin = useSyncExternalStore(subscribe, () => window.location.origin, () => "http://127.0.0.1:3100");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [folderName, setFolderName] = useState("");
  const [progress, setProgress] = useState<FolderProgress | null>(null), [manifest, setManifest] = useState<BackupManifest | null>(null), [review, setReview] = useState<Review | null>(null);
  const [jobs, setJobs] = useState<Job[] | null>(null), [attempts, setAttempts] = useState(0), [removeId, setRemoveId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string>("");
  useEffect(() => () => controller.current?.abort(), []);
  async function pick() {
    const picker = (window as PickerWindow).showDirectoryPicker;
    if (!picker) throw new Error(locale === "ar" ? cmsArabicUi["Folder access is unavailable. Use Chrome/Edge or the backup CLI."] : th ? "เบราว์เซอร์นี้ไม่รองรับการเลือกโฟลเดอร์ ใช้ Chrome/Edge หรือเครื่องมือ CLI" : "Folder access is unavailable. Use Chrome/Edge or the backup CLI.");
    return picker.call(window, { mode: "readwrite" });
  }
  async function work(task: (signal: AbortSignal) => Promise<void>) {
    if (busy || disabled) return;
    setBusy(true); setError(""); controller.current = new AbortController();
    try { await task(controller.current.signal); }
    catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") setError(locale === "ar" ? cmsArabicUi["Paused. Choose the same folder to continue."] : th ? "หยุดไว้แล้ว เลือกโฟลเดอร์เดิมเพื่อทำต่อ" : "Paused. Choose the same folder to continue.");
      else { setAttempts((count) => count + 1); setError(cause instanceof Error ? cause.message : (locale === "ar" ? cmsArabicUi["Transfer failed. Existing data was preserved."] : th ? "ทำรายการไม่สำเร็จ ข้อมูลเดิมยังอยู่" : "Transfer failed. Existing data was preserved.")); }
    } finally { setBusy(false); controller.current = null; }
  }
  async function exportFolder() {
    let selected: FileSystemDirectoryHandle;
    try { selected = await pick(); } catch (cause) { if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(String(cause)); return; }
    setAttempts(0);
    await work(async (signal) => { await exportBackupFolder(selected, setProgress, signal); onMessage(locale === "ar" ? cmsArabicUi["Backup complete. Every file was verified; keep the entire folder in a safe place."] : th ? "สำรองข้อมูลครบและตรวจสอบไฟล์ทุกชิ้นแล้ว เก็บโฟลเดอร์นี้ไว้ในที่ปลอดภัย" : "Backup complete. Every file was verified; keep the entire folder in a safe place."); setProgress(null); });
  }
  async function chooseRestore() {
    try { const selected = await pick(); const next = await readFolderManifest(selected); folder.current = selected; setFolderName(selected.name); setManifest(next); setReview(null); setProgress(null); setError(""); setAttempts(0); }
    catch (cause) { if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : String(cause)); }
  }
  async function refreshAfterRestore() {
    const response = await fetch("/api/cms", { cache: "no-store" }), result = await response.json();
    if (!response.ok || !result.state) throw new Error(locale === "ar" ? cmsArabicUi["Restore succeeded, but the latest content could not load. Reload the CMS."] : th ? "กู้คืนสำเร็จแล้ว แต่ยังโหลดข้อมูลล่าสุดไม่ได้ กรุณาโหลดหน้าอีกครั้ง" : "Restore succeeded, but the latest content could not load. Reload the CMS.");
    onState(result.state); setReview(null); setProgress(null); onMessage(locale === "ar" ? cmsArabicUi["Restored as a draft. Review and publish separately."] : th ? "กู้คืนเป็นฉบับร่างแล้ว ตรวจสอบและเผยแพร่แยกต่างหาก" : "Restored as a draft. Review and publish separately.");
  }
  async function prepare() {
    if (!folder.current || !manifest || attempts >= 3) return;
    const selected = folder.current;
    await work(async (signal) => {
      const result = await importBackupFolder(selected, manifest, setProgress, signal);
      if (result.committed) { await refreshAfterRestore(); return; }
      const file = manifest.files.findIndex((entry) => entry.name === "state.json");
      const archived = JSON.parse(new TextDecoder().decode(await readFolderFile(selected, manifest, file))) as CmsState;
      if (result.resolving) {
        if (result.revision === undefined || !result.planHash) throw new Error("The previous restore needs administrator review. Its media was preserved.");
        setReview({ id: result.id, revision: result.revision, planHash: result.planHash, draft: archived.draft, changes: [], resolving: true });
      } else { const inspection = await backupRequest({ action: "inspect", id: result.id }, signal); setReview({ ...inspection, id: result.id, draft: archived.draft }); }
    });
  }
  async function commit() {
    if (!review || attempts >= 3) return;
    await work(async (signal) => { await backupRequest({ action: "commit", id: review.id, revision: review.revision, planHash: review.planHash }, signal); await refreshAfterRestore(); });
  }
  async function showTransfers() {
    await work(async (signal) => { const response = await fetch("/api/cms/backup-transfer", { cache: "no-store", signal }), result = await response.json(); if (!response.ok) throw new Error(result.error); setJobs(result.transfers); });
  }
  async function removeTransfer(id: string) {
    await work(async (signal) => {
      for (;;) {
        signal.throwIfAborted();
        const response = await fetch("/api/cms/backup-transfer", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }), signal }), result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setRemoving(`${result.completed} / ${result.total}`);
        if (result.removed) break;
      }
      setJobs((current) => current?.filter((job) => job.id !== id) || []); setRemoveId(null); setRemoving("");
      if (folder.current && await clearFolderRestoreProgress(folder.current, id)) { setManifest(null); setReview(null); setFolderName(""); folder.current = null; }
    });
  }
  return <section className={styles.panel}>
    <h3>{locale === "ar" ? cmsArabicUi["Resumable folder backup"] : th ? "สำรองข้อมูลขนาดใหญ่และทำต่อได้" : "Resumable folder backup"}</h3>
    <p>{locale === "ar" ? cmsArabicUi["Save to a folder in 512 KB parts, up to 2 GB. Pause and choose the same folder to resume within 24 hours. Every file is checked against its manifest."] : th ? "บันทึกเป็นโฟลเดอร์ ส่งข้อมูลทีละส่วนขนาด 512 KB สูงสุด 2 GB หยุดแล้วเลือกโฟลเดอร์เดิมเพื่อทำต่อภายใน 24 ชั่วโมง ทุกไฟล์มีการตรวจสอบความถูกต้อง" : "Save to a folder in 512 KB parts, up to 2 GB. Pause and choose the same folder to resume within 24 hours. Every file is checked against its manifest."}</p>
    <div className={styles.actions}><button type="button" disabled={disabled || busy || !available} onClick={() => void exportFolder()}><Download aria-hidden="true" />{locale === "ar" ? cmsArabicUi["Export / resume"] : th ? "สำรอง / ทำต่อ" : "Export / resume"}</button><button type="button" disabled={disabled || busy || !available} onClick={() => void chooseRestore()}><FolderOpen aria-hidden="true" />{locale === "ar" ? cmsArabicUi["Choose restore folder"] : th ? "เลือกโฟลเดอร์เพื่อกู้คืน" : "Choose restore folder"}</button><button type="button" disabled={disabled || busy} onClick={() => void showTransfers()}><RotateCcw aria-hidden="true" />{locale === "ar" ? cmsArabicUi["Manage transfers"] : th ? "จัดการรายการถ่ายโอน" : "Manage transfers"}</button></div>
    {!available && <p>{locale === "ar" ? cmsArabicUi["Folder access is unavailable in this browser. Use Chrome/Edge, the small-archive controls above, or the documented backup CLI."] : th ? "เบราว์เซอร์นี้ไม่รองรับโฟลเดอร์ ใช้ Chrome/Edge, ไฟล์สำรองขนาดเล็กด้านบน หรือคำสั่ง CLI ในคู่มือโครงการ" : "Folder access is unavailable in this browser. Use Chrome/Edge, the small-archive controls above, or the documented backup CLI."}</p>}
    <details><summary>{locale === "ar" ? cmsArabicUi["CLI alternative"] : th ? "วิธีใช้ CLI" : "CLI alternative"}</summary><p>{locale === "ar" ? cmsArabicUi["Run locally and sign in when prompted. Credentials are not placed in command arguments. Keep manifest.json and the complete chunks folder together."] : th ? "ใช้โฟลเดอร์ในเครื่องและลงชื่อเข้าใช้เมื่อระบบถาม รหัสผ่านไม่อยู่ในคำสั่ง เก็บทั้ง manifest.json และโฟลเดอร์ chunks" : "Run locally and sign in when prompted. Credentials are not placed in command arguments. Keep manifest.json and the complete chunks folder together."}</p><code>node scripts/cms-backup.mjs export --url={currentOrigin} --directory=./backup</code><code>node scripts/cms-backup.mjs restore --url={currentOrigin} --directory=./backup</code></details>
    {manifest && <div className={styles.selection}><strong>{locale === "ar" ? cmsArabicUi["Selected folder"] : th ? "โฟลเดอร์ที่เลือก" : "Selected folder"}: {folderName}</strong><p>{manifest.files.length} {locale === "ar" ? cmsArabicUi["files"] : th ? "ไฟล์" : "files"} · {mb(manifest.totalBytes)} · {locale === "ar" ? cmsArabicUi["revision"] : th ? "ฉบับ" : "revision"} {manifest.sourceRevision}</p><p>{locale === "ar" ? cmsArabicUi["Selection does not upload. Prepare the restore to transfer and verify files, then review before confirming the draft recovery."] : th ? "การเลือกโฟลเดอร์ยังไม่อัปโหลด กดเตรียมกู้คืนเพื่อส่งไฟล์และตรวจสอบ ก่อนยืนยันการกู้คืนเป็นฉบับร่าง" : "Selection does not upload. Prepare the restore to transfer and verify files, then review before confirming the draft recovery."}</p><button type="button" disabled={disabled || busy || attempts >= 3} onClick={() => void prepare()}><Upload aria-hidden="true" />{locale === "ar" ? cmsArabicUi["Prepare restore / resume"] : th ? "เตรียมกู้คืน / ทำต่อ" : "Prepare restore / resume"}</button></div>}
    {progress && <div className={styles.progress} role="status" aria-live="polite"><progress max={progress.total} value={progress.completed} aria-label={locale === "ar" ? cmsArabicUi["Backup transfer progress"] : th ? "ความคืบหน้าการสำรองข้อมูล" : "Backup transfer progress"} /><span>{mb(progress.completed)} / {mb(progress.total)}</span><span>{progress.phase === "verify" ? (locale === "ar" ? cmsArabicUi["Verifying"] : th ? "ตรวจสอบ" : "Verifying") : progress.phase === "download" ? (locale === "ar" ? cmsArabicUi["Downloading"] : th ? "ดาวน์โหลด" : "Downloading") : (locale === "ar" ? cmsArabicUi["Uploading"] : th ? "อัปโหลด" : "Uploading")}: {progress.file}</span></div>}
    {busy && <button type="button" onClick={() => controller.current?.abort()}><Pause aria-hidden="true" />{locale === "ar" ? cmsArabicUi["Pause transfer"] : th ? "หยุดหลังส่วนปัจจุบัน" : "Pause transfer"}</button>}
    {removing && <p role="status">{locale === "ar" ? cmsArabicUi["Removing temporary parts"] : th ? "นำส่วนข้อมูลชั่วคราวออก" : "Removing temporary parts"}: {removing}</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}{attempts >= 3 && <p>{locale === "ar" ? cmsArabicUi["Retry allowance reached. Review the transfer status, then choose the folder to begin another attempt."] : th ? "ครบจำนวนการลองแล้ว ตรวจรายการถ่ายโอนก่อนเลือกโฟลเดอร์เพื่อเริ่มรอบใหม่" : "Retry allowance reached. Review the transfer status, then choose the folder to begin another attempt."}</p>}
    {jobs && <div className={styles.jobs}><h4>{locale === "ar" ? cmsArabicUi["Your transfers"] : th ? "รายการถ่ายโอนของคุณ" : "Your transfers"}</h4>{jobs.length === 0 && <p>{locale === "ar" ? cmsArabicUi["No transfers."] : th ? "ไม่มีรายการ" : "No transfers."}</p>}{jobs.map((job) => <article key={job.id}><p><strong>{job.direction === "export" ? (locale === "ar" ? cmsArabicUi["Export"] : th ? "สำรอง" : "Export") : (locale === "ar" ? cmsArabicUi["Restore"] : th ? "กู้คืน" : "Restore")}</strong> · {mb(job.bytes)} · {job.status}<br /><span>{job.id}</span><br />{locale === "ar" ? cmsArabicUi["Expires"] : th ? "หมดอายุ" : "Expires"}: {new Date(job.expiresAt).toLocaleString(locale)}</p><button type="button" disabled={busy} onClick={() => setRemoveId(job.id)}><Trash2 aria-hidden="true" />{locale === "ar" ? cmsArabicUi["Remove transfer"] : th ? "นำรายการออก" : "Remove transfer"}</button></article>)}</div>}
    {removeId && <CmsDialog label={locale === "ar" ? cmsArabicUi["Remove transfer"] : th ? "นำรายการถ่ายโอนออก" : "Remove transfer"} className={dialogStyles.dialog} onClose={() => { if (!busy) setRemoveId(null); }}><h2>{locale === "ar" ? cmsArabicUi["Remove this transfer?"] : th ? "นำรายการนี้ออก?" : "Remove this transfer?"}</h2><p>{locale === "ar" ? cmsArabicUi["This removes temporary transfer data. An uncertain restore is protected. Saved content and Trash images remain; confirmed unreferenced leftover images can be removed through Cleanup."] : th ? "จะลบเฉพาะข้อมูลถ่ายโอนชั่วคราว การกู้คืนที่ยังไม่ทราบผลจะถูกป้องกันไว้ เนื้อหาที่บันทึกและภาพในถังขยะยังอยู่ ภาพที่เหลือและไม่มีการอ้างอิงลบได้ด้วย Cleanup" : "This removes temporary transfer data. An uncertain restore is protected. Saved content and Trash images remain; confirmed unreferenced leftover images can be removed through Cleanup."}</p><div className={styles.actions}><button type="button" disabled={busy} onClick={() => setRemoveId(null)}>{locale === "ar" ? cmsArabicUi["Cancel"] : th ? "ยกเลิก" : "Cancel"}</button><button type="button" disabled={busy} onClick={() => void removeTransfer(removeId)}>{locale === "ar" ? cmsArabicUi["Remove transfer"] : th ? "นำรายการออก" : "Remove transfer"}</button></div></CmsDialog>}
    {review && <CmsDialog label={locale === "ar" ? cmsArabicUi["Review folder restore"] : th ? "ตรวจสอบก่อนกู้คืน" : "Review folder restore"} className={dialogStyles.dialog} onClose={() => { if (!busy) setReview(null); }}><header className={dialogStyles.toolbar}><h2>{locale === "ar" ? cmsArabicUi["Review folder restore"] : th ? "ตรวจสอบก่อนกู้คืน" : "Review folder restore"}</h2><button className={dialogStyles.iconButton} disabled={busy} type="button" aria-label={locale === "ar" ? cmsArabicUi["Close"] : th ? "ปิด" : "Close"} onClick={() => setReview(null)}><X aria-hidden="true" /></button></header><p>{review.resolving ? (locale === "ar" ? cmsArabicUi["The previous outcome needs confirmation. Retry the same reviewed request without re-uploading."] : th ? "กำลังยืนยันผลครั้งก่อน ลองคำขอเดิมอีกครั้งโดยไม่อัปโหลดซ้ำ" : "The previous outcome needs confirmation. Retry the same reviewed request without re-uploading.") : (locale === "ar" ? cmsArabicUi["Every file is verified. Restore changes only the draft; the website changes after a separate publication."] : th ? "ไฟล์ทั้งหมดผ่านการตรวจสอบแล้ว กู้คืนเฉพาะฉบับร่าง เว็บไซต์ยังไม่เปลี่ยนจนกว่าจะเผยแพร่" : "Every file is verified. Restore changes only the draft; the website changes after a separate publication.")}</p><ChangeList changes={review.changes} before={state.draft} after={review.draft} locale={locale} />{error && <p className={styles.error} role="alert">{error}</p>}<footer className={dialogStyles.toolbar}><button className={dialogStyles.button} disabled={busy} type="button" onClick={() => setReview(null)}>{locale === "ar" ? cmsArabicUi["Cancel"] : th ? "ยกเลิก" : "Cancel"}</button><button className={dialogStyles.primary} disabled={disabled || busy || attempts >= 3} type="button" onClick={() => void commit()}>{review.resolving ? (locale === "ar" ? cmsArabicUi["Confirm restore outcome"] : th ? "ยืนยันผลการกู้คืน" : "Confirm restore outcome") : (locale === "ar" ? cmsArabicUi["Restore as draft"] : th ? "กู้คืนเป็นฉบับร่าง" : "Restore as draft")}</button></footer></CmsDialog>}
  </section>;
}

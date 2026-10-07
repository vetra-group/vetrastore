"use client";

import { cmsArabicUi } from "@/content/cms-ar-ui";

import { useRef, useState } from "react";
import { Download, Upload, X } from "lucide-react";
import type { CmsChange, CmsState } from "@/lib/cms/types";
import type { Locale } from "@/lib/i18n";
import { CmsDialog } from "./CmsDialog";
import { ChangeList } from "./CmsPublishing";
import { CmsResumableBackup } from "./CmsResumableBackup";
import styles from "./CmsPublishing.module.css";
import editorStyles from "./CmsEditor.module.css";

type Inspection = { planHash: string; revision: number; createdAt: string; products: number; articles: number; images: number; revisions: number; changes: CmsChange[] };

export function CmsBackupTools({ locale, state, disabled, onState, onMessage }: { locale: Locale; state: CmsState; disabled: boolean; onState: (state: CmsState) => void; onMessage: (message: string, error?: boolean) => void }) {
  const th = locale === "th";
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState<{ name: string; backup: { state: CmsState }; inspection: Inspection } | null>(null);
  async function download() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/cms/backup", { cache: "no-store" }); if (!response.ok) throw new Error();
      const url = URL.createObjectURL(await response.blob()); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `vetra-complete-backup-${new Date().toISOString().slice(0, 10)}.json`; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      onMessage(locale === "ar" ? cmsArabicUi["Backup prepared. Check your downloads folder."] : th ? "จัดเตรียมไฟล์สำรองเรียบร้อย ตรวจโฟลเดอร์ดาวน์โหลด" : "Backup prepared. Check your downloads folder.");
    } catch { setError(locale === "ar" ? cmsArabicUi["Backup failed. Check storage availability and try again."] : th ? "สำรองข้อมูลไม่สำเร็จ โปรดตรวจพื้นที่จัดเก็บและลองอีกครั้ง" : "Backup failed. Check storage availability and try again."); }
    finally { setBusy(false); }
  }
  async function inspect(file?: File) {
    if (!file) return; setBusy(true); setError("");
    try {
      if (file.size > 128 * 1024 * 1024) throw new Error();
      const backup = JSON.parse(await file.text());
      const response = await fetch("/api/cms/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "inspect", backup }) });
      const inspection = await response.json(); if (!response.ok || !inspection.planHash || !backup.state) throw new Error();
      setReview({ name: file.name, backup, inspection });
    } catch { setError(locale === "ar" ? cmsArabicUi["This backup could not be verified or exceeds the supported size. Choose a complete CMS backup."] : th ? "ไฟล์สำรองไม่สมบูรณ์หรือเกินขนาดที่รองรับ กรุณาเลือกไฟล์สำรองแบบครบชุดจาก CMS" : "This backup could not be verified or exceeds the supported size. Choose a complete CMS backup."); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }
  async function restore() {
    if (!review || busy || disabled) return; setBusy(true); setError("");
    try {
      const response = await fetch("/api/cms/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restore", backup: review.backup, revision: review.inspection.revision, planHash: review.inspection.planHash }) });
      const result = await response.json(); if (!response.ok || !result.state) throw new Error(); onState(result.state); setReview(null); onMessage(locale === "ar" ? cmsArabicUi["Draft and media restored. Review before publishing."] : th ? "กู้คืนฉบับร่างและรูปภาพแล้ว ตรวจสอบก่อนเผยแพร่" : "Draft and media restored. Review before publishing.");
    } catch { setError(locale === "ar" ? cmsArabicUi["Restoration could not be confirmed. Reload the latest content and inspect the backup again."] : th ? "ยังยืนยันการกู้คืนไม่ได้ กรุณาโหลดข้อมูลล่าสุดและตรวจไฟล์อีกครั้ง" : "Restoration could not be confirmed. Reload the latest content and inspect the backup again."); }
    finally { setBusy(false); }
  }
  return <section className={editorStyles.panel}><h2>{locale === "ar" ? cmsArabicUi["Complete backup"] : th ? "สำรองข้อมูลครบชุด" : "Complete backup"}</h2><p className={styles.hint}>{locale === "ar" ? cmsArabicUi["Includes content, drafts, uploaded images, revision history, and Trash. Bundled website assets remain in the project. Keep backups in secure storage."] : th ? "รวมเนื้อหา ฉบับร่าง รูปภาพที่อัปโหลด ประวัติ และถังขยะ ไฟล์ภาพที่มากับโครงการยังเก็บในโครงการเดิม เก็บไฟล์สำรองไว้ในที่ปลอดภัย" : "Includes content, drafts, uploaded images, revision history, and Trash. Bundled website assets remain in the project. Keep backups in secure storage."}</p><div className={styles.toolbar}><button type="button" className={styles.button} disabled={disabled || busy} onClick={() => void download()}><Download aria-hidden="true" />{locale === "ar" ? cmsArabicUi["Download backup"] : th ? "ดาวน์โหลดข้อมูลสำรอง" : "Download backup"}</button><button type="button" className={styles.button} disabled={disabled || busy} onClick={() => fileRef.current?.click()}><Upload aria-hidden="true" />{locale === "ar" ? cmsArabicUi["Inspect backup to restore"] : th ? "ตรวจไฟล์เพื่อกู้คืน" : "Inspect backup to restore"}</button><input ref={fileRef} className="srOnly" type="file" accept="application/json,.json" aria-label={locale === "ar" ? cmsArabicUi["Choose backup"] : th ? "เลือกไฟล์สำรอง" : "Choose backup"} onChange={(event) => void inspect(event.target.files?.[0])} /></div>{busy && <p role="status">{locale === "ar" ? cmsArabicUi["Processing…"] : th ? "กำลังประมวลผล…" : "Processing…"}</p>}{disabled && <p className={styles.hint}>{locale === "ar" ? cmsArabicUi["Save current edits before managing backups."] : th ? "บันทึกงานที่แก้ไขก่อนจัดการข้อมูลสำรอง" : "Save current edits before managing backups."}</p>}{error && <p role="alert" className={styles.error}>{error}</p>}
    {review && <CmsDialog label={locale === "ar" ? cmsArabicUi["Review backup"] : th ? "ตรวจข้อมูลสำรอง" : "Review backup"} className={styles.dialog} onClose={() => { if (!busy) setReview(null); }}><header className={styles.toolbar}><h2>{locale === "ar" ? cmsArabicUi["Review backup"] : th ? "ตรวจข้อมูลสำรอง" : "Review backup"}</h2><button className={styles.iconButton} type="button" disabled={busy} aria-label={locale === "ar" ? cmsArabicUi["Close"] : th ? "ปิด" : "Close"} onClick={() => setReview(null)}><X aria-hidden="true" /></button></header><p className={styles.hint}>{review.name}</p><p>{locale === "ar" ? `${review.inspection.products} منتجات · ${review.inspection.articles} مقالات · ${review.inspection.images} صور · ${review.inspection.revisions} إصدارات` : th ? `สินค้า ${review.inspection.products} · บทความ ${review.inspection.articles} · รูปภาพ ${review.inspection.images} · ฉบับเนื้อหา ${review.inspection.revisions}` : `${review.inspection.products} products · ${review.inspection.articles} articles · ${review.inspection.images} uploaded images · ${review.inspection.revisions} revisions`}</p><p>{locale === "ar" ? cmsArabicUi["Restore into the draft. The current website changes only when you review and publish."] : th ? "กู้คืนเข้าในฉบับร่าง เว็บไซต์ปัจจุบันจะเปลี่ยนเมื่อคุณตรวจและเผยแพร่เท่านั้น" : "Restore into the draft. The current website changes only when you review and publish."}</p><ChangeList changes={review.inspection.changes} before={state.draft} after={review.backup.state.draft} locale={locale} />{error && <p className={styles.error} role="alert">{error}</p>}<footer className={styles.toolbar}><button className={styles.button} disabled={busy} type="button" onClick={() => setReview(null)}>{locale === "ar" ? cmsArabicUi["Cancel"] : th ? "ยกเลิก" : "Cancel"}</button><button className={styles.primary} disabled={busy || disabled} type="button" onClick={() => void restore()}><Upload aria-hidden="true" />{locale === "ar" ? cmsArabicUi["Restore as draft"] : th ? "กู้คืนเป็นฉบับร่าง" : "Restore as draft"}</button></footer></CmsDialog>}
    <CmsResumableBackup locale={locale} state={state} disabled={disabled || busy} onState={onState} onMessage={onMessage} />
  </section>;
}

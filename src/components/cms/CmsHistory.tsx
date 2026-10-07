"use client";

import { cmsAuditLabel } from "@/lib/cms/labels";
import { cmsArabicUi } from "@/content/cms-ar-ui";

import { useEffect, useState } from "react";
import { History, Undo2, X } from "lucide-react";
import type { CmsChange, CmsHistoryEntry, CmsHistorySummary, CmsState } from "@/lib/cms/types";
import type { Locale } from "@/lib/i18n";
import { CmsDialog } from "./CmsDialog";
import { ChangeList } from "./CmsPublishing";
import styles from "./CmsPublishing.module.css";
import editorStyles from "./CmsEditor.module.css";

export function CmsHistory({ locale, state, disabled, canRestore = true, onState, onMessage }: { locale: Locale; state: CmsState; disabled: boolean; canRestore?: boolean; onState: (state: CmsState) => void; onMessage: (message: string, error?: boolean) => void }) {
  const th = locale === "th";
  const [history, setHistory] = useState<CmsHistorySummary[]>([]);
  const [review, setReview] = useState<{ entry: CmsHistoryEntry; changes: CmsChange[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/cms/publishing", { cache: "no-store", signal: controller.signal }).then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(); setHistory(result.history ?? []); }).catch(() => { if (!controller.signal.aborted) setError(locale === "ar" ? cmsArabicUi["Unable to load revision history."] : th ? "โหลดประวัติไม่สำเร็จ" : "Unable to load revision history."); });
    return () => controller.abort();
  }, [state.revision, th, locale]);
  async function inspect(id: string) {
    setBusy(true); setError("");
    try { const response = await fetch(`/api/cms/publishing?history=${encodeURIComponent(id)}`, { cache: "no-store" }); const result = await response.json(); if (!response.ok || !result.entry) throw new Error(); setReview(result); }
    catch { setError(locale === "ar" ? cmsArabicUi["Unable to inspect this revision. Reload the latest content."] : th ? "ตรวจฉบับนี้ไม่สำเร็จ กรุณาโหลดข้อมูลล่าสุด" : "Unable to inspect this revision. Reload the latest content."); }
    finally { setBusy(false); }
  }
  async function restore() {
    if (!review || busy || disabled) return; setBusy(true); setError("");
    try { const response = await fetch("/api/cms/publishing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restore-history", revision: state.revision, id: review.entry.id }) }); const result = await response.json(); if (!response.ok || !result.state) throw new Error(); onState(result.state); setReview(null); onMessage(locale === "ar" ? cmsArabicUi["Draft restored. Review and publish when ready."] : th ? "กู้คืนฉบับร่างแล้ว ตรวจสอบและเผยแพร่เมื่อพร้อม" : "Draft restored. Review and publish when ready."); }
    catch { setError(locale === "ar" ? cmsArabicUi["Restoration could not be confirmed. Reload the latest content before retrying."] : th ? "กู้คืนไม่สำเร็จ กรุณาโหลดข้อมูลล่าสุดก่อนลองอีกครั้ง" : "Restoration could not be confirmed. Reload the latest content before retrying."); }
    finally { setBusy(false); }
  }
  const formatted = (at: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(at));
  return <section className={editorStyles.panel}><h2>{locale === "ar" ? cmsArabicUi["Content revision history"] : th ? "ประวัติฉบับเนื้อหา" : "Content revision history"}</h2><p className={styles.hint}>{locale === "ar" ? cmsArabicUi["Compare earlier revisions with the current draft. Restoring changes the draft; publication is a separate step."] : th ? "เปรียบเทียบฉบับเดิมกับร่างปัจจุบัน การกู้คืนจะเปลี่ยนเฉพาะร่าง ต้องเผยแพร่แยกต่างหาก" : "Compare earlier revisions with the current draft. Restoring changes the draft; publication is a separate step."}</p>
    {disabled && <p className={styles.hint}>{locale === "ar" ? cmsArabicUi["Save current edits before restoring a revision."] : th ? "บันทึกงานที่กำลังแก้ไขก่อนกู้คืน" : "Save current edits before restoring a revision."}</p>}{error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.history}>{history.map((entry) => <article key={entry.id}><div><p><strong>{locale === "ar" ? cmsArabicUi["Revision"] : th ? "ฉบับ" : "Revision"} {entry.revision}</strong> · {cmsAuditLabel(entry.action, locale)}</p><time dateTime={entry.at}>{formatted(entry.at)}</time></div><button type="button" disabled={busy} className={styles.button} onClick={() => void inspect(entry.id)}><History aria-hidden="true" />{locale === "ar" ? cmsArabicUi["Compare"] : th ? "เปรียบเทียบ" : "Compare"}</button></article>)}</div>{!history.length && <p className={styles.hint}>{locale === "ar" ? cmsArabicUi["Revision history appears after changes are saved."] : th ? "ประวัติจะปรากฏหลังบันทึกการเปลี่ยนแปลง" : "Revision history appears after changes are saved."}</p>}
    {review && <CmsDialog label={locale === "ar" ? cmsArabicUi["Compare revision"] : th ? "เปรียบเทียบฉบับเนื้อหา" : "Compare revision"} className={styles.dialog} onClose={() => { if (!busy) setReview(null); }}><header className={styles.toolbar}><h2>{locale === "ar" ? cmsArabicUi["Revision"] : th ? "ฉบับ" : "Revision"} {review.entry.revision}</h2><button className={styles.iconButton} disabled={busy} type="button" aria-label={locale === "ar" ? cmsArabicUi["Close"] : th ? "ปิด" : "Close"} onClick={() => setReview(null)}><X aria-hidden="true" /></button></header><p className={styles.hint}>{formatted(review.entry.at)} · {cmsAuditLabel(review.entry.action, locale)}</p><p>{locale === "ar" ? cmsArabicUi["The current draft is on the left; the revision to restore is on the right."] : th ? "ด้านซ้ายคือร่างปัจจุบัน ด้านขวาคือฉบับที่จะกู้คืน" : "The current draft is on the left; the revision to restore is on the right."}</p><ChangeList changes={review.changes} before={state.draft} after={review.entry.draft} locale={locale} />{error && <p className={styles.error} role="alert">{error}</p>}<footer className={styles.toolbar}><button className={styles.button} disabled={busy} type="button" onClick={() => setReview(null)}>{locale === "ar" ? cmsArabicUi["Cancel"] : th ? "ยกเลิก" : "Cancel"}</button><button className={styles.primary} disabled={busy || disabled || !canRestore} type="button" onClick={() => void restore()}><Undo2 aria-hidden="true" />{locale === "ar" ? cmsArabicUi["Restore as draft"] : th ? "กู้คืนเป็นฉบับร่าง" : "Restore as draft"}</button></footer></CmsDialog>}
  </section>;
}

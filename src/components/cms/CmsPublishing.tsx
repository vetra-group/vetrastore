"use client";

import { cmsArabicUi } from "@/content/cms-ar-ui";

import { useEffect, useState } from "react";
import { Check, CloudUpload, LoaderCircle, X } from "lucide-react";
import type { CmsChange, CmsContent, CmsPublishSelection, CmsState } from "@/lib/cms/types";
import type { Locale } from "@/lib/i18n";
import { CmsDialog } from "./CmsDialog";
import styles from "./CmsPublishing.module.css";

export function changeValue(content: CmsContent, change: CmsChange): unknown {
  if (change.kind === "article") return content.articles.find((item) => (item.id ?? item.slug) === change.key || item.slug === change.key);
  if (change.kind === "product") return content.products.find((item) => item.id === change.key);
  return content[change.kind];
}

function titleFor(change: CmsChange, content: CmsContent, locale: Locale) {
  if (change.kind === "article") return content.articles.find((item) => (item.id ?? item.slug) === change.key || item.slug === change.key)?.content[locale].title || change.title;
  if (change.kind === "product") return content.products.find((item) => item.id === change.key)?.name[locale] || change.title;
  return ({ ar: { slides: "شرائح الصفحة الرئيسية", copy: "نصوص الصفحات", settings: "إعدادات المتجر", media: "مكتبة الوسائط" }, th: { slides: "สไลด์หน้าแรก", copy: "ข้อความบนหน้าเว็บ", settings: "ข้อมูลร้าน", media: "คลังรูปภาพ" }, en: { slides: "Homepage slides", copy: "Page copy", settings: "Store settings", media: "Media library" } })[locale][change.kind];
}

function readableValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export function ChangeList({ changes, before, after, locale }: { changes: CmsChange[]; before: CmsContent; after: CmsContent; locale: Locale }) {
  const th = locale === "th";
  return <div className={styles.changes}>{changes.map((change) => <details key={`${change.kind}-${change.key}`} className={styles.change}>
    <summary><span>{titleFor(change, change.change === "removed" ? before : after, locale)}</span><span className={styles.badge}>{change.change === "added" ? (locale === "ar" ? cmsArabicUi["Added"] : th ? "เพิ่ม" : "Added") : change.change === "removed" ? (locale === "ar" ? cmsArabicUi["Removed"] : th ? "นำออก" : "Removed") : (locale === "ar" ? cmsArabicUi["Updated"] : th ? "แก้ไข" : "Updated")}</span></summary>
    {(change.details ?? [{ field: change.fields.join(", "), before: changeValue(before, change), after: changeValue(after, change) }]).map((detail, index) => <div className={styles.fieldChange} key={index}><p>{detail.field.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll(".", " · ")}</p><div className={styles.comparison}><div><h3>{locale === "ar" ? cmsArabicUi["Before"] : th ? "ก่อน" : "Before"}</h3><pre>{readableValue(detail.before)}</pre></div><div><h3>{locale === "ar" ? cmsArabicUi["After"] : th ? "หลัง" : "After"}</h3><pre>{readableValue(detail.after)}</pre></div></div></div>)}
  </details>)}</div>;
}

export function CmsPublishing({ locale, state, onClose, onState, onMessage }: { locale: Locale; state: CmsState; onClose: () => void; onState: (state: CmsState) => void; onMessage: (message: string, error?: boolean) => void }) {
  const th = locale === "th";
  const [changes, setChanges] = useState<CmsChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [selected, setSelected] = useState<CmsPublishSelection[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/cms/publishing", { cache: "no-store", signal: controller.signal }).then(async (response) => { const result = await response.json(); if (!response.ok || !Array.isArray(result.changes) || result.revision !== state.revision) throw new Error("Review unavailable"); setChanges(result.changes); }).catch(() => { if (!controller.signal.aborted) setError(locale === "ar" ? cmsArabicUi["Unable to review this revision. Close and reload the latest content."] : th ? "ไม่สามารถตรวจการเปลี่ยนแปลงได้ กรุณาปิดและโหลดข้อมูลล่าสุด" : "Unable to review this revision. Close and reload the latest content."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [state.revision, th, locale]);
  async function publish() {
    if (busy) return; setBusy(true); setError("");
    try {
      const response = await fetch("/api/cms/publishing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "publish", revision: state.revision, ...(scope === "selected" ? { selection: selected } : {}) }) });
      const result = await response.json();
      if (!response.ok || !result.state) throw new Error(result.code ?? "Publish failed");
      onState(result.state); onMessage(locale === "ar" ? cmsArabicUi["Reviewed changes published."] : th ? "เผยแพร่รายการที่ตรวจแล้วเรียบร้อย" : "Reviewed changes published."); onClose();
    } catch (failure) {
      const code = failure instanceof Error ? failure.message : "";
      setError(code === "TRANSLATION_REQUIRED" ? (locale === "ar" ? "أكمل ترجمة المحتوى إلى الإنجليزية والعربية والتايلاندية قبل النشر. يمكنك حفظ المسودة والمتابعة لاحقًا." : th ? "กรอกคำแปลภาษาอังกฤษ อาหรับ และไทยให้ครบก่อนเผยแพร่ บันทึกฉบับร่างเพื่อกลับมาทำต่อได้" : "Complete English, Arabic, and Thai translations before publishing. Save the draft to continue later.") : code === "EDITORIAL_REVIEW_REQUIRED" ? (locale === "ar" ? cmsArabicUi["An article still requires factual review. Return to its editorial notes and finish the review before publishing."] : th ? "มีบทความที่ยังต้องตรวจข้อมูล กรุณากลับไปตรวจบันทึกบรรณาธิการก่อนเผยแพร่" : "An article still requires factual review. Return to its editorial notes and finish the review before publishing.") : code === "FORBIDDEN" ? (locale === "ar" ? cmsArabicUi["An owner account is required to publish."] : th ? "บัญชีเจ้าของร้านเท่านั้นที่เผยแพร่ได้" : "An owner account is required to publish.") : (locale === "ar" ? cmsArabicUi["Publishing could not be confirmed. Reload the latest content before trying again."] : th ? "เผยแพร่ไม่สำเร็จ กรุณาตรวจสถานะล่าสุดก่อนลองอีกครั้ง" : "Publishing could not be confirmed. Reload the latest content before trying again."));
    }
    finally { setBusy(false); }
  }
  const selectable = changes.filter((change): change is CmsChange & { kind: "article" | "product" } => change.kind === "article" || change.kind === "product");
  return <CmsDialog label={locale === "ar" ? cmsArabicUi["Review before publishing"] : th ? "ตรวจสอบก่อนเผยแพร่" : "Review before publishing"} className={styles.dialog} onClose={() => { if (!busy) onClose(); }}>
    <header className={styles.toolbar}><div><p className={styles.eyebrow}>VETRA / CMS</p><h2>{locale === "ar" ? cmsArabicUi["Review before publishing"] : th ? "ตรวจสอบก่อนเผยแพร่" : "Review before publishing"}</h2></div><button className={styles.iconButton} type="button" disabled={busy} aria-label={locale === "ar" ? cmsArabicUi["Close"] : th ? "ปิด" : "Close"} onClick={onClose}><X aria-hidden="true" /></button></header>
    <p className={styles.hint}>{locale === "ar" ? cmsArabicUi["Compare the saved draft with the current website. Each record’s status still determines whether it appears publicly."] : th ? "เปรียบเทียบฉบับร่างที่บันทึกกับเว็บไซต์ปัจจุบัน สถานะของแต่ละรายการยังมีผลต่อการแสดงบนเว็บไซต์" : "Compare the saved draft with the current website. Each record’s status still determines whether it appears publicly."}</p>
    {loading && <p role="status">{locale === "ar" ? cmsArabicUi["Loading…"] : th ? "กำลังโหลด…" : "Loading…"}</p>}{error && <p className={styles.error} role="alert">{error}</p>}
    {!loading && !error && <><fieldset className={styles.scope} disabled={busy}><legend>{locale === "ar" ? cmsArabicUi["Publishing scope"] : th ? "ขอบเขตการเผยแพร่" : "Publishing scope"}</legend><label><input type="radio" name="publishing-scope" checked={scope === "all"} onChange={() => setScope("all")} />{locale === "ar" ? cmsArabicUi["All saved changes"] : th ? "ทั้งหมด" : "All saved changes"}</label><label><input type="radio" name="publishing-scope" checked={scope === "selected"} disabled={!selectable.length} onChange={() => setScope("selected")} />{locale === "ar" ? cmsArabicUi["Selected articles or products"] : th ? "เลือกบทความหรือสินค้า" : "Selected articles or products"}</label></fieldset>
      {scope === "selected" && <div className={styles.selection}>{selectable.map((change) => <label key={`${change.kind}-${change.key}`}><input type="checkbox" checked={selected.some((item) => item.kind === change.kind && item.key === change.key)} onChange={(event) => setSelected(event.target.checked ? [...selected, { kind: change.kind, key: change.key }] : selected.filter((item) => item.kind !== change.kind || item.key !== change.key))} /><span>{titleFor(change, change.change === "removed" ? state.published : state.draft, locale)}</span></label>)}<p className={styles.hint}>{locale === "ar" ? cmsArabicUi["Other edits stay in draft. Media required by selected records is preserved."] : th ? "การแก้ไขส่วนอื่นจะอยู่ในฉบับร่างต่อไป รูปภาพที่รายการนี้ใช้อยู่จะได้รับการเก็บรักษา" : "Other edits stay in draft. Media required by selected records is preserved."}</p></div>}
      <ChangeList changes={scope === "selected" ? changes.filter((change) => selected.some((item) => item.kind === change.kind && item.key === change.key)) : changes} before={state.published} after={state.draft} locale={locale} />
      {!changes.length && <p><Check aria-hidden="true" />{locale === "ar" ? cmsArabicUi["No changes waiting to publish."] : th ? "ไม่มีการเปลี่ยนแปลงรอเผยแพร่" : "No changes waiting to publish."}</p>}
    </>}
    <footer className={styles.toolbar}><button className={styles.button} disabled={busy} type="button" onClick={onClose}>{locale === "ar" ? cmsArabicUi["Back to editing"] : th ? "กลับไปแก้ไข" : "Back to editing"}</button><button className={styles.primary} type="button" disabled={busy || loading || !!error || !changes.length || (scope === "selected" && !selected.length)} onClick={() => void publish()}>{busy ? <LoaderCircle aria-hidden="true" /> : <CloudUpload aria-hidden="true" />}{locale === "ar" ? cmsArabicUi["Publish reviewed changes"] : th ? "เผยแพร่รายการที่ตรวจแล้ว" : "Publish reviewed changes"}</button></footer>
  </CmsDialog>;
}

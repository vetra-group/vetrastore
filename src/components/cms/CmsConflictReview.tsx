"use client";

import { cmsArabicUi } from "@/content/cms-ar-ui";

import { useState } from "react";
import { X } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { DraftConflict } from "@/lib/cms/draft-merge";
import { CmsDialog } from "./CmsDialog";
import styles from "./CmsRecovery.module.css";

export function CmsConflictReview({ locale, conflicts, onApply, onClose }: { locale: Locale; conflicts: DraftConflict[]; onApply: (choices: Record<string, "mine" | "latest">) => void; onClose: () => void }) {
  const [choices, setChoices] = useState<Record<string, "mine" | "latest">>({});
  const th = locale === "th";
  const title = locale === "ar" ? cmsArabicUi["Review conflicting edits"] : th ? "เลือกข้อมูลที่ต้องการเก็บ" : "Review conflicting edits";
  const value = (item: unknown) => item === undefined ? (locale === "ar" ? cmsArabicUi["Deleted"] : th ? "ลบรายการ" : "Deleted") : typeof item === "string" ? item || "—" : JSON.stringify(item, null, 2);
  return <CmsDialog label={title} className={styles.dialog} onClose={onClose}><header><h2>{title}</h2><button type="button" aria-label={locale === "ar" ? cmsArabicUi["Close"] : th ? "ปิด" : "Close"} onClick={onClose}><X aria-hidden="true" /></button></header><p>{locale === "ar" ? cmsArabicUi["Choose a version for each field. Independent edits will be kept automatically."] : th ? "เลือกแต่ละช่องก่อนรวมข้อมูล การแก้ไขที่ไม่ขัดแย้งกันจะเก็บไว้ทั้งหมด" : "Choose a version for each field. Independent edits will be kept automatically."}</p><div className={styles.fields}>{conflicts.map((conflict) => { const key = JSON.stringify(conflict.path); return <fieldset key={key}><legend>{conflict.path.join(" / ")}</legend><div className={styles.choices}>{(["mine", "latest"] as const).map((choice) => <label key={choice} data-selected={choices[key] === choice}><span><input type="radio" name={key} checked={choices[key] === choice} onChange={() => setChoices({ ...choices, [key]: choice })} />{choice === "mine" ? (locale === "ar" ? cmsArabicUi["My edit"] : th ? "ของฉัน" : "My edit") : (locale === "ar" ? cmsArabicUi["Latest saved"] : th ? "ล่าสุดที่บันทึก" : "Latest saved")}</span><pre>{value(conflict[choice])}</pre></label>)}</div></fieldset>; })}</div><footer><button type="button" onClick={onClose}>{locale === "ar" ? cmsArabicUi["Keep editing"] : th ? "กลับไปแก้ไข" : "Keep editing"}</button><button className="button" type="button" disabled={conflicts.some((entry) => !choices[JSON.stringify(entry.path)])} onClick={() => onApply(choices)}>{locale === "ar" ? cmsArabicUi["Apply selected versions"] : th ? "รวมข้อมูลที่เลือก" : "Apply selected versions"}</button></footer></CmsDialog>;
}

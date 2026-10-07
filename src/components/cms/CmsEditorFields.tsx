"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { cmsCopy } from "@/content/cms";
import type { CmsContent, CmsStatus } from "@/lib/cms/types";
import { validImageSource } from "@/lib/cms/validation";
import type { Locale } from "@/lib/i18n";
import { Field } from "./CmsField";
export { Field } from "./CmsField";
const MediaPicker = dynamic(() => import("./CmsMedia").then((module) => module.MediaPicker));
import styles from "./CmsEditor.module.css";

export function StatusField({ locale, value, onChange }: { locale: Locale; value: CmsStatus; onChange: (value: CmsStatus) => void }) {
  const t = cmsCopy[locale];
  return <Field label={t.status}><select value={value} onChange={(event) => onChange(event.target.value as CmsStatus)}><option value="draft">{t.draft}</option><option value="published">{t.published}</option><option value="archived">{t.archived}</option></select></Field>;
}

export function ImageField({ locale, content, src, onChange }: { locale: Locale; content: CmsContent; src: string; onChange: (src: string) => void }) {
  const t = cmsCopy[locale];
  const [picker, setPicker] = useState(false);
  let safeSrc = "";
  try { safeSrc = validImageSource(src); } catch { /* An incomplete path stays editable without requesting an unsafe URL. */ }
  return <><div className={styles.imageLayout}><div className={styles.imageFrame}>{safeSrc ? <Image src={safeSrc} alt="" fill unoptimized sizes="12rem" /> : <ImageIcon aria-hidden="true" />}</div><div className={styles.imageControls}><Field label={t.imagePath}><input dir="ltr" value={src} onChange={(event) => onChange(event.target.value)} required maxLength={1200} placeholder="/images/…" /></Field><button className={styles.button} type="button" onClick={() => setPicker(true)}><ImageIcon aria-hidden="true" />{t.chooseImage}</button></div></div>{picker && <MediaPicker locale={locale} content={content} selected={src} onSelect={onChange} onClose={() => setPicker(false)} />}</>;
}


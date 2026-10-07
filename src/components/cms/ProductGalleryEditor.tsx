"use client";

import { cmsArabicUi } from "@/content/cms-ar-ui";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { CmsContent, CmsProduct } from "@/lib/cms/types";
import { locales, localeSettings, type Locale } from "@/lib/i18n";
import { defaultHoneyGallery } from "@/lib/product-gallery";
import { HONEY_ID, type ProductGalleryImage } from "@/lib/catalog";
import { Field, ImageField } from "./CmsEditorFields";
import styles from "./CmsEditor.module.css";

export function ProductGalleryEditor({ locale, content, product, onChange }: { locale: Locale; content: CmsContent; product: CmsProduct; onChange: (product: CmsProduct) => void }) {
  const th = locale === "th";
  const gallery = product.gallery ?? (product.id === HONEY_ID ? defaultHoneyGallery(product) : []);
  const set = (next: readonly ProductGalleryImage[]) => onChange({ ...product, gallery: next });
  const update = (id: string, change: Partial<ProductGalleryImage>) => set(gallery.map((entry) => entry.id === id ? { ...entry, ...change } : entry));
  const move = (index: number, delta: number) => { const next = [...gallery]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; set(next); };
  return <section className={styles.panel}>
    <div className={styles.toolbar}><h2>{locale === "ar" ? cmsArabicUi["Product gallery"] : th ? "แกลเลอรีสินค้า" : "Product gallery"}</h2><button type="button" className={styles.button} disabled={gallery.length >= 16} onClick={() => set([...gallery, { id: crypto.randomUUID(), src: "", alt: { en: "", ar: "", th: "" }, caption: { en: "", ar: "", th: "" } }])}><Plus aria-hidden="true" />{locale === "ar" ? cmsArabicUi["Add image"] : th ? "เพิ่มภาพ" : "Add image"}</button></div>
    <p className={styles.hint}>{locale === "ar" ? cmsArabicUi["Arrange images in display order. The main product image is managed separately and is shown when the gallery is empty."] : th ? "เรียงภาพตามลำดับที่ต้องการ รูปหลักของสินค้าใช้แยกจากแกลเลอรี หากไม่มีภาพแกลเลอรี จะแสดงรูปหลัก" : "Arrange images in display order. The main product image is managed separately and is shown when the gallery is empty."}</p>
    {gallery.map((entry, index) => <div className={styles.section} key={entry.id}>
      <div className={styles.toolbar}><strong>{locale === "ar" ? cmsArabicUi["Image"] : th ? "ภาพ" : "Image"} {index + 1}</strong><div className={styles.toolbar}>
        <button type="button" className={styles.iconButton} disabled={index === 0} aria-label={locale === "ar" ? cmsArabicUi["Move image up"] : th ? "เลื่อนภาพขึ้น" : "Move image up"} onClick={() => move(index, -1)}><ArrowUp aria-hidden="true" /></button>
        <button type="button" className={styles.iconButton} disabled={index === gallery.length - 1} aria-label={locale === "ar" ? cmsArabicUi["Move image down"] : th ? "เลื่อนภาพลง" : "Move image down"} onClick={() => move(index, 1)}><ArrowDown aria-hidden="true" /></button>
        <button type="button" className={styles.iconButton} aria-label={locale === "ar" ? cmsArabicUi["Remove image from gallery"] : th ? "นำภาพออกจากแกลเลอรี" : "Remove image from gallery"} onClick={() => set(gallery.filter((item) => item.id !== entry.id))}><Trash2 aria-hidden="true" /></button>
      </div></div>
      <ImageField locale={locale} content={content} src={entry.src} onChange={(src) => update(entry.id, { src })} />
      <div className={styles.languages}>{locales.map((language) => <div key={language} className={styles.language} lang={language} dir={localeSettings(language).direction}>
        <Field label={`${locale === "ar" ? cmsArabicUi["Image description"] : th ? "คำอธิบายภาพ" : "Image description"} · ${language.toUpperCase()}`}><input required maxLength={500} value={entry.alt[language]} onChange={(event) => update(entry.id, { alt: { ...entry.alt, [language]: event.target.value } })} /></Field>
        <Field label={`${locale === "ar" ? cmsArabicUi["Caption (optional)"] : th ? "คำบรรยาย (ไม่บังคับ)" : "Caption (optional)"} · ${language.toUpperCase()}`}><input maxLength={500} value={entry.caption?.[language] ?? ""} onChange={(event) => update(entry.id, { caption: { en: "", ar: "", th: "", ...entry.caption, [language]: event.target.value } })} /></Field>
      </div>)}</div>
    </div>)}
  </section>;
}

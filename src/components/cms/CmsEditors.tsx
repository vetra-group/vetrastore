"use client";

import { cmsArabicUi } from "@/content/cms-ar-ui";

import { useState } from "react";
import { Plus, Trash2, Undo2 } from "lucide-react";
import { cmsCopy } from "@/content/cms";
import { HONEY_ID, MAX_QUANTITY, type PriceTier } from "@/lib/catalog";
import { editableCopy as defaultCopy } from "@/lib/cms/defaults";
import { untranslatedCopyKeys } from "@/lib/cms/localization";
import type { CmsContent, CmsProduct, CmsSlide } from "@/lib/cms/types";
import { locales, localeSettings, isLocale, type Locale } from "@/lib/i18n";
import { Field, ImageField, StatusField } from "./CmsEditorFields";
import { ProductGalleryEditor } from "./ProductGalleryEditor";
export { Field } from "./CmsEditorFields";
import styles from "./CmsEditor.module.css";

type PriceCurrency = "THB" | "internationalTHB";
const pricingLabels = {
  en: { legacy: "Add separate THB bundle totals for Thailand and international delivery.", enable: "Add quantity prices", help: "Enter the total THB price for each listed bundle. International totals include worldwide shipping.", THB: "Thailand · THB", internationalTHB: "Outside Thailand · THB", quantity: "Bottles", total: "Bundle total", add: "Add bundle", remove: "Remove bundle" },
  ar: { legacy: "أضف إجمالي الباقات بالبات التايلاندي للتوصيل داخل تايلاند وخارجها.", enable: "إضافة أسعار الكميات", help: "أدخل إجمالي كل باقة بالبات التايلاندي. يشمل السعر الدولي الشحن العالمي.", THB: "تايلاند · بات تايلاندي", internationalTHB: "خارج تايلاند · بات تايلاندي", quantity: "العبوات", total: "إجمالي الباقة", add: "إضافة باقة", remove: "حذف باقة" },
  th: { legacy: "เพิ่มราคารวมเป็นบาทสำหรับการจัดส่งในไทยและต่างประเทศ", enable: "เพิ่มราคาตามจำนวน", help: "ระบุราคารวมเป็นบาทของแต่ละชุด ราคาต่างประเทศรวมค่าจัดส่งทั่วโลก", THB: "ราคาไทย · บาท", internationalTHB: "ราคาต่างประเทศ · บาท", quantity: "จำนวนขวด", total: "ราคารวม", add: "เพิ่มชุด", remove: "ลบชุด" },
} satisfies Record<Locale, Record<string, string>>;

export function ProductEditor({ locale, content, product, onChange }: { locale: Locale; content: CmsContent; product: CmsProduct; onChange: (product: CmsProduct) => void }) {
  const t = cmsCopy[locale];
  const p = pricingLabels[locale];
  const [searchTerms, setSearchTerms] = useState(product.searchTerms.join(", "));
  const set = <K extends keyof CmsProduct>(key: K, value: CmsProduct[K]) => onChange({ ...product, [key]: value });
  const updatePricing = (currency: PriceCurrency, rows: PriceTier[]) => {
    if (!product.pricing) return;
    const pricing = { ...product.pricing, [currency]: rows };
    onChange({ ...product, pricing, price: pricing.THB[0]?.total ?? product.price });
  };
  const addTier = (currency: PriceCurrency) => {
    const rows = product.pricing?.[currency];
    if (!rows?.length || rows[rows.length - 1].quantity >= MAX_QUANTITY) return;
    const next = [2, 4, 6, 12, 24, 48, 96, 192].find((quantity) => quantity > rows[rows.length - 1].quantity) ?? rows[rows.length - 1].quantity + 1;
    updatePricing(currency, [...rows, { quantity: next, total: 0 }]);
  };
  return <form className={styles.form} id="cms-editor-form" onSubmit={(event) => event.preventDefault()}>
    <section className={styles.panel}><h2>{t.identity}</h2><div className={styles.fields}>
      <Field label={t.fields.id}><input dir="ltr" value={product.id} disabled /></Field>
      <Field label={t.fields.slug} hint={product.id === HONEY_ID ? t.protectedSlug : t.slugHelp}><input dir="ltr" value={product.slug} disabled={product.id === HONEY_ID} pattern="[a-z0-9]+(-[a-z0-9]+)*" required maxLength={80} onChange={(event) => set("slug", event.target.value)} /></Field>
      <Field label={t.fields.brand}><input value={product.brand} maxLength={100} required onChange={(event) => set("brand", event.target.value)} /></Field>
      <Field label={t.fields.category}><select value={product.category} onChange={(event) => set("category", event.target.value as CmsProduct["category"])}><option value="honey">{t.fields.honey}</option><option value="coffee">{t.fields.coffee}</option></select></Field>
      <StatusField locale={locale} value={product.status} onChange={(value) => set("status", value)} />
      <label className={styles.check}><input type="checkbox" checked={product.featured} onChange={(event) => set("featured", event.target.checked)} />{t.featured}</label>
    </div></section>
    <section className={styles.panel}><h2>{t.pricing}</h2>
      {product.pricing ? <><p className={styles.hint}>{p.help}</p><div className={styles.pricingGrid}>{(["THB", "internationalTHB"] as const).map((currency) => { const rows = product.pricing?.[currency] ?? [{ quantity: 1, total: 0 }]; return <div className={styles.pricingCurrency} key={currency}><h3>{p[currency]}</h3><div className={styles.pricingRows}>{rows.map((row, index) => <div className={styles.pricingRow} key={`${currency}-${index}`}>
        <Field label={p.quantity}><input type="number" min={1} max={MAX_QUANTITY} step={1} required readOnly={index === 0} value={row.quantity || ""} onChange={(event) => updatePricing(currency, rows.map((entry, rowIndex) => rowIndex === index ? { ...entry, quantity: Number(event.target.value) } : entry))} /></Field>
        <Field label={`${p.total} (THB)`}><input type="number" min={0.01} max={10000000} step="0.01" required value={row.total || ""} onChange={(event) => updatePricing(currency, rows.map((entry, rowIndex) => rowIndex === index ? { ...entry, total: Number(event.target.value) } : entry))} /></Field>
        {index > 0 && <button className={styles.iconButton} type="button" aria-label={`${p.remove} ${row.quantity}`} onClick={() => updatePricing(currency, rows.filter((_, rowIndex) => rowIndex !== index))}><Trash2 aria-hidden="true" /></button>}
      </div>)}</div><button className={styles.button} type="button" disabled={rows.length >= MAX_QUANTITY || rows.at(-1)!.quantity >= MAX_QUANTITY} onClick={() => currency === "internationalTHB" && !product.pricing?.internationalTHB ? updatePricing(currency, [{ quantity: 1, total: 0 }]) : addTier(currency)}><Plus aria-hidden="true" />{p.add}</button></div>; })}</div></> : <div className={styles.legacyPricing}><p className={styles.hint}>{p.legacy}</p><div className={styles.fields}><Field label={t.fields.price}><input type="number" value={product.price} min={0} max={10000000} step="0.01" required onChange={(event) => set("price", Number(event.target.value))} /></Field></div><button className={styles.button} type="button" onClick={() => onChange({ ...product, pricing: { THB: [{ quantity: 1, total: product.price }], internationalTHB: [{ quantity: 1, total: 0 }] } })}><Plus aria-hidden="true" />{p.enable}</button></div>}
      <div className={styles.fields}>
      <Field label={t.fields.weight}><input type="number" value={product.weight} min={1} max={1000000} step={1} required onChange={(event) => set("weight", Number(event.target.value))} /></Field>
      <Field label={t.fields.stock} hint={t.stockHelp}><input type="number" value={product.stock ?? ""} min={0} max={1000000} step={1} onChange={(event) => set("stock", event.target.value === "" ? null : Number(event.target.value))} /></Field>
      <Field label={t.fields.searchTerms} hint={t.searchTermsHelp}><input value={searchTerms} maxLength={3000} onChange={(event) => { setSearchTerms(event.target.value); set("searchTerms", event.target.value.split(",").map((term) => term.trim()).filter(Boolean)); }} /></Field>
    </div></section>
    <section className={styles.panel}><h2>{t.translated}</h2><div className={styles.languages}>{locales.map((language) => <div className={styles.language} key={language} lang={language} dir={localeSettings(language).direction}><h3>{localeSettings(language).label}</h3>
      <Field label={t.fields.name}><input required={language !== "ar"} maxLength={200} value={product.name[language]} onChange={(event) => set("name", { ...product.name, [language]: event.target.value })} /></Field>
      <Field label={t.fields.description}><textarea required={language !== "ar"} maxLength={5000} value={product.description[language]} onChange={(event) => set("description", { ...product.description, [language]: event.target.value })} /></Field>
      <Field label={t.fields.captionPrefix}><input required={language !== "ar"} maxLength={300} value={product.card[language].captionPrefix} onChange={(event) => set("card", { ...product.card, [language]: { ...product.card[language], captionPrefix: event.target.value } })} /></Field>
      <Field label={t.fields.imageAlt} hint={t.altHelp}><input required={language !== "ar"} maxLength={500} value={product.card[language].imageAlt} onChange={(event) => set("card", { ...product.card, [language]: { ...product.card[language], imageAlt: event.target.value } })} /></Field>
      <Field label={t.fields.cta}><input required={language !== "ar"} maxLength={100} value={product.card[language].cta} onChange={(event) => set("card", { ...product.card, [language]: { ...product.card[language], cta: event.target.value } })} /></Field>
    </div>)}</div></section>
    <section className={styles.panel}><h2>{t.image}</h2><ImageField locale={locale} content={content} src={product.image} onChange={(value) => set("image", value)} /></section>
    <ProductGalleryEditor locale={locale} content={content} product={product} onChange={onChange} />
  </form>;
}

export function SlideEditor({ locale, content, slide, onChange }: { locale: Locale; content: CmsContent; slide: CmsSlide; onChange: (slide: CmsSlide) => void }) {
  const t = cmsCopy[locale];
  const set = <K extends keyof CmsSlide>(key: K, value: CmsSlide[K]) => onChange({ ...slide, [key]: value });
  return <form className={styles.form} id="cms-editor-form" onSubmit={(event) => event.preventDefault()}>
    <section className={styles.panel}><h2>{t.slideDetails}</h2><div className={styles.fields}>
      <Field label={t.fields.key}><input dir="ltr" value={slide.key} disabled /></Field>
      <Field label={t.fields.path} hint={t.linkHelp}><input dir="ltr" value={slide.path} required maxLength={1000} onChange={(event) => set("path", event.target.value)} /></Field>
      <label className={styles.check}><input type="checkbox" checked={slide.enabled} onChange={(event) => set("enabled", event.target.checked)} />{t.enabled}</label>
    </div></section>
    <section className={styles.panel}><h2>{t.image}</h2><ImageField locale={locale} content={content} src={slide.src} onChange={(value) => set("src", value)} /></section>
    <section className={styles.panel}><h2>{t.translated}</h2><div className={styles.languages}>{locales.map((language) => <div className={styles.language} key={language} lang={language} dir={localeSettings(language).direction}><h3>{localeSettings(language).label}</h3>
      <Field label={t.fields.imageAlt} hint={t.altHelp}><textarea required={language !== "ar"} maxLength={500} value={slide.alt[language]} onChange={(event) => set("alt", { ...slide.alt, [language]: event.target.value })} /></Field>
      <Field label={t.fields.linkLabel}><input required={language !== "ar"} maxLength={200} value={slide.linkLabel[language]} onChange={(event) => set("linkLabel", { ...slide.linkLabel, [language]: event.target.value })} /></Field>
    </div>)}</div></section>
  </form>;
}

function copyLanguage(value: string) { return value.split(".").find(isLocale) ?? "en"; }
function readableKey(value: string) {
  const pieces = value.split(".");
  const localeIndex = pieces.findIndex((piece) => isLocale(piece));
  const parts = [...(pieces[0] === "pages" ? [pieces[1]] : []), ...pieces.slice(localeIndex + 1)];
  return parts.map((piece) => /^\d+$/.test(piece) ? String(Number(piece) + 1) : piece.replace(/([a-z])([A-Z])/g, "$1 $2")).join(" · ");
}

export function CopyEditor({ locale, content, onChange }: { locale: Locale; content: CmsContent; onChange: (content: CmsContent) => void }) {
  const t = cmsCopy[locale];
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("site");
  const [language, setLanguage] = useState<string>(locale);
  const [page, setPage] = useState(0);
  const missingArabic = untranslatedCopyKeys(content, defaultCopy);
  const sources = { site: t.contentSourceSite, honey: t.contentSourceHoney, commerce: t.contentSourceCommerce, store: t.contentSourceStore, pages: locale === "ar" ? cmsArabicUi["Pages"] : locale === "th" ? "หน้าเว็บ" : "Pages" };
  const matches = Object.keys(defaultCopy).filter((key) => (source === "all" || key.startsWith(`${source}.`)) && (language === "all" || copyLanguage(key) === language) && `${key} ${content.copy[key] ?? defaultCopy[key]}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const pages = Math.max(1, Math.ceil(matches.length / 30));
  const current = Math.min(page, pages - 1);
  const filter = (set: (value: string) => void, value: string) => { set(value); setPage(0); };
  return <div className={styles.form}><section className={styles.panel}><div className={styles.filters}>
    <Field label={t.search}><input type="search" value={search} onChange={(event) => filter(setSearch, event.target.value)} /></Field>
    <Field label={t.group}><select value={source} onChange={(event) => filter(setSource, event.target.value)}><option value="all">{t.all}</option>{Object.entries(sources).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
    <Field label={t.language}><select value={language} onChange={(event) => filter(setLanguage, event.target.value)}>{locales.map((code) => <option key={code} value={code}>{localeSettings(code).label}</option>)}<option value="all">{t.all}</option></select></Field>
    </div><p className={styles.hint}>{matches.length} {t.fieldsShown}</p></section>
    {missingArabic.length > 0 && <section className={styles.panel} role="status"><p id="cms-translation-notice">{locale === "ar" ? `توجد ${missingArabic.length} حقول بحاجة إلى ترجمة عربية بعد تعديل النص الإنجليزي أو التايلاندي. يظهر النص العربي الأصلي للمراجعة. أدخل الترجمة المعتمدة واحفظها قبل النشر.` : locale === "th" ? `มี ${missingArabic.length} ช่องที่ต้องแปลเป็นภาษาอาหรับหลังแก้ไขภาษาอังกฤษหรือไทย ข้อความอาหรับเริ่มต้นแสดงเพื่อให้ตรวจสอบ กรุณากรอกคำแปลที่ยืนยันแล้วและบันทึกก่อนเผยแพร่` : `${missingArabic.length} fields need Arabic translation after English or Thai changes. The original Arabic text is shown for review. Enter and save the approved translation before publishing.`}</p><button type="button" className={styles.button} onClick={() => { setSource("all"); setLanguage("ar"); setSearch(""); setPage(0); }}>{t.arabic}</button></section>}
    <form className={styles.panel} id="cms-editor-form" onSubmit={(event) => event.preventDefault()}>{matches.slice(current * 30, (current + 1) * 30).map((key) => <div key={key} className={styles.copyField}><div className={styles.fieldMeta}><span>{sources[key.split(".")[0] as keyof typeof sources]} · {localeSettings(copyLanguage(key)).label}</span>{key in content.copy && <button className={styles.button} type="button" onClick={() => { const copy = { ...content.copy }; delete copy[key]; onChange({ ...content, copy }); }}><Undo2 aria-hidden="true" />{t.resetField}</button>}</div>
      <Field label={readableKey(key)}><textarea lang={copyLanguage(key)} dir={localeSettings(copyLanguage(key)).direction} aria-describedby={missingArabic.includes(key) ? "cms-translation-notice" : undefined} value={content.copy[key] ?? defaultCopy[key]} maxLength={12000} rows={(content.copy[key] ?? defaultCopy[key]).length > 150 ? 4 : 2} onChange={(event) => onChange({ ...content, copy: { ...content.copy, [key]: event.target.value } })} /></Field>
    </div>)}{matches.length === 0 && <p className={styles.empty}>{t.emptySearch}</p>}
    <div className={styles.pagination}><button type="button" className={styles.button} disabled={current === 0} onClick={() => setPage(current - 1)}>{t.previous}</button><span>{t.page} {current + 1} {t.of} {pages}</span><button type="button" className={styles.button} disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}>{t.next}</button></div></form>
  </div>;
}

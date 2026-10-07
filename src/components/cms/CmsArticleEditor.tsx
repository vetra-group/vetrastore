"use client";

import { cmsArabicUi } from "@/content/cms-ar-ui";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { cmsCopy } from "@/content/cms";
import type { ArticleLink, ArticleSection } from "@/content/editorial";
import type { CmsArticle, CmsContent } from "@/lib/cms/types";
import { locales, localeSettings, type Locale } from "@/lib/i18n";
import { Field, ImageField, StatusField } from "./CmsEditorFields";
import styles from "./CmsEditor.module.css";

function LinksEditor({ label, links = [], onChange, locale }: { label: string; links?: readonly ArticleLink[]; onChange: (links: ArticleLink[]) => void; locale: Locale }) {
  const th = locale === "th";
  return <div className={styles.form}><div className={styles.toolbar}><strong>{label}</strong><button type="button" className={styles.button} disabled={links.length >= 20} onClick={() => onChange([...links, { label: "", href: "" }])}><Plus aria-hidden="true" />{locale === "ar" ? cmsArabicUi["Add link"] : th ? "เพิ่มลิงก์" : "Add link"}</button></div>
    {links.map((link, index) => <div className={styles.section} key={index}><div className={styles.fields}>
      <Field label={locale === "ar" ? cmsArabicUi["Link text"] : th ? "ข้อความลิงก์" : "Link text"}><input required maxLength={300} value={link.label} onChange={(event) => onChange(links.map((entry, row) => row === index ? { ...entry, label: event.target.value } : entry))} /></Field>
      <Field label="URL" hint={locale === "ar" ? cmsArabicUi["Use / for a page on this website, or https://"] : th ? "ใช้ / สำหรับหน้าในเว็บไซต์ หรือ https://" : "Use / for a page on this website, or https://"}><input dir="ltr" required maxLength={1200} value={link.href} onChange={(event) => onChange(links.map((entry, row) => row === index ? { ...entry, href: event.target.value } : entry))} /></Field>
    </div><button type="button" className={styles.button} onClick={() => onChange(links.filter((_, row) => row !== index))}><Trash2 aria-hidden="true" />{locale === "ar" ? cmsArabicUi["Remove link"] : th ? "นำลิงก์ออก" : "Remove link"}</button></div>)}
  </div>;
}

function SectionEditor({ section, onChange, locale, content }: { section: ArticleSection; onChange: (section: ArticleSection) => void; locale: Locale; content: CmsContent }) {
  const t = cmsCopy[locale]; const th = locale === "th";
  const set = (change: Partial<ArticleSection>) => onChange({ ...section, ...change });
  return <>
    <Field label={t.sectionTitle}><input required maxLength={300} value={section.title} onChange={(event) => set({ title: event.target.value })} /></Field>
    <Field label={t.sectionText}><textarea required maxLength={12000} rows={6} value={section.text} onChange={(event) => set({ text: event.target.value })} /></Field>
    <details className={styles.disclosure}><summary>{locale === "ar" ? cmsArabicUi["Lists, links, images, and tables"] : th ? "รายการ ลิงก์ รูปภาพ และตาราง" : "Lists, links, images, and tables"}</summary><div className={styles.form}>
      <Field label={locale === "ar" ? cmsArabicUi["Bullet list (one item per line)"] : th ? "รายการหัวข้อย่อย (หนึ่งรายการต่อบรรทัด)" : "Bullet list (one item per line)"}><textarea maxLength={12000} value={section.bullets?.join("\n") ?? ""} onChange={(event) => set({ bullets: event.target.value ? event.target.value.split("\n") : undefined })} /></Field>
      <LinksEditor label={locale === "ar" ? cmsArabicUi["Section links"] : th ? "ลิงก์ในส่วนนี้" : "Section links"} links={section.links} onChange={(links) => set({ links })} locale={locale} />
      {!section.image ? <button className={styles.button} type="button" onClick={() => set({ image: { src: "", alt: "", caption: "" } })}><Plus aria-hidden="true" />{locale === "ar" ? cmsArabicUi["Add supporting image"] : th ? "เพิ่มภาพประกอบ" : "Add supporting image"}</button> : <div className={styles.section}>
        <ImageField locale={locale} content={content} src={section.image.src} onChange={(src) => set({ image: { ...section.image!, src } })} />
        <Field label={t.fields.imageAlt}><input required maxLength={500} value={section.image.alt} onChange={(event) => set({ image: { ...section.image!, alt: event.target.value } })} /></Field>
        <Field label={locale === "ar" ? cmsArabicUi["Image caption"] : th ? "คำบรรยายภาพ" : "Image caption"}><input maxLength={1000} value={section.image.caption ?? ""} onChange={(event) => set({ image: { ...section.image!, caption: event.target.value } })} /></Field>
        <button className={styles.button} type="button" onClick={() => set({ image: undefined })}><Trash2 aria-hidden="true" />{locale === "ar" ? cmsArabicUi["Remove image"] : th ? "นำภาพออก" : "Remove image"}</button>
      </div>}
      {!section.table ? <button className={styles.button} type="button" onClick={() => set({ table: { headers: ["", ""], rows: [["", ""]] } })}><Plus aria-hidden="true" />{locale === "ar" ? cmsArabicUi["Add comparison table"] : th ? "เพิ่มตารางเปรียบเทียบ" : "Add comparison table"}</button> : <div className={styles.section}>
        <div className={styles.toolbar}><strong>{locale === "ar" ? cmsArabicUi["Comparison table"] : th ? "ตารางเปรียบเทียบ" : "Comparison table"}</strong><button className={styles.button} type="button" onClick={() => set({ table: undefined })}><Trash2 aria-hidden="true" />{locale === "ar" ? cmsArabicUi["Remove table"] : th ? "นำตารางออก" : "Remove table"}</button></div>
        <div className={styles.fields}>{section.table.headers.map((header, column) => <Field key={column} label={`${locale === "ar" ? cmsArabicUi["Column heading"] : th ? "หัวคอลัมน์" : "Column heading"} ${column + 1}`}><input required maxLength={200} value={header} onChange={(event) => set({ table: { ...section.table!, headers: section.table!.headers.map((value, index) => index === column ? event.target.value : value) } })} /></Field>)}</div>
        {section.table.rows.map((row, rowIndex) => <div key={rowIndex} className={styles.section}><div className={styles.fields}>{row.map((cell, column) => <Field key={column} label={`${locale === "ar" ? cmsArabicUi["Row"] : th ? "แถว" : "Row"} ${rowIndex + 1} · ${section.table!.headers[column] || column + 1}`}><input required maxLength={1000} value={cell} onChange={(event) => set({ table: { ...section.table!, rows: section.table!.rows.map((entry, index) => index === rowIndex ? entry.map((value, col) => col === column ? event.target.value : value) : entry) } })} /></Field>)}</div><button type="button" className={styles.button} disabled={section.table!.rows.length <= 1} onClick={() => set({ table: { ...section.table!, rows: section.table!.rows.filter((_, index) => index !== rowIndex) } })}><Trash2 aria-hidden="true" />{locale === "ar" ? cmsArabicUi["Remove row"] : th ? "นำแถวออก" : "Remove row"}</button></div>)}
        <div className={styles.toolbar}>
          <button type="button" className={styles.button} disabled={section.table.rows.length >= 20} onClick={() => set({ table: { ...section.table!, rows: [...section.table!.rows, section.table!.headers.map(() => "")] } })}><Plus aria-hidden="true" />{locale === "ar" ? cmsArabicUi["Add row"] : th ? "เพิ่มแถว" : "Add row"}</button>
          <button type="button" className={styles.button} disabled={section.table.headers.length >= 6} onClick={() => set({ table: { headers: [...section.table!.headers, ""], rows: section.table!.rows.map((row) => [...row, ""]) } })}><Plus aria-hidden="true" />{locale === "ar" ? cmsArabicUi["Add column"] : th ? "เพิ่มคอลัมน์" : "Add column"}</button>
          <button type="button" className={styles.button} disabled={section.table.headers.length <= 2} onClick={() => set({ table: { headers: section.table!.headers.slice(0, -1), rows: section.table!.rows.map((row) => row.slice(0, -1)) } })}><Trash2 aria-hidden="true" />{locale === "ar" ? cmsArabicUi["Remove last column"] : th ? "นำคอลัมน์ท้ายออก" : "Remove last column"}</button>
        </div>
      </div>}
    </div></details>
  </>;
}

export function ArticleEditor({ locale, content, article, onChange }: { locale: Locale; content: CmsContent; article: CmsArticle; onChange: (article: CmsArticle) => void }) {
  const t = cmsCopy[locale]; const th = locale === "th";
  const set = <K extends keyof CmsArticle>(key: K, value: CmsArticle[K]) => onChange({ ...article, [key]: value });
  return <form className={styles.form} id="cms-editor-form" onSubmit={(event) => event.preventDefault()}>
    <section className={styles.panel}><h2>{t.articleDetails}</h2><div className={styles.fields}>
      <Field label={t.fields.slug} hint={locale === "ar" ? cmsArabicUi["Previously published URLs redirect automatically after the new URL is published."] : th ? "URL เดิมจะเปลี่ยนเส้นทางอัตโนมัติเมื่อเผยแพร่ URL ใหม่" : "Previously published URLs redirect automatically after the new URL is published."}><input dir="ltr" required maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={article.slug} onChange={(event) => set("slug", event.target.value)} /></Field>
      <StatusField locale={locale} value={article.status} onChange={(value) => set("status", value)} />
      <Field label={t.fields.imagePosition}><select value={article.imagePosition ?? "center"} onChange={(event) => set("imagePosition", event.target.value)}>{["center", "top", "bottom", "left", "right"].map((value) => <option key={value} value={value}>{t.imagePositions[value as keyof typeof t.imagePositions]}</option>)}</select></Field>
      <label className={styles.check}><input type="checkbox" checked={article.featured ?? false} onChange={(event) => set("featured", event.target.checked)} />{locale === "ar" ? cmsArabicUi["Featured article"] : th ? "บทความแนะนำ" : "Featured article"}</label>
      <Field label={locale === "ar" ? cmsArabicUi["Actual publication date (optional)"] : th ? "วันที่เผยแพร่จริง (ไม่บังคับ)" : "Actual publication date (optional)"}><input type="date" value={article.publishedAt?.slice(0, 10) ?? ""} onChange={(event) => set("publishedAt", event.target.value || undefined)} /></Field>
      <Field label={locale === "ar" ? cmsArabicUi["Content update date (optional)"] : th ? "วันที่ปรับปรุงเนื้อหา (ไม่บังคับ)" : "Content update date (optional)"}><input type="date" min={article.publishedAt?.slice(0, 10)} value={article.updatedAt?.slice(0, 10) ?? ""} onChange={(event) => set("updatedAt", event.target.value || undefined)} /></Field>
    </div>{!!article.previousSlugs?.length && <p className={styles.notice}>{locale === "ar" ? cmsArabicUi["Previous URLs:"] : th ? "URL เดิม:" : "Previous URLs:"} {article.previousSlugs.join(", ")}</p>}</section>
    <section className={styles.panel}><h2>{t.image}</h2><ImageField locale={locale} content={content} src={article.image} onChange={(value) => set("image", value)} /></section>
    <section className={styles.panel}><h2>{locale === "ar" ? cmsArabicUi["Editorial review"] : th ? "บันทึกสำหรับบรรณาธิการ" : "Editorial review"}</h2><Field label={locale === "ar" ? cmsArabicUi["Internal notes (never shown publicly)"] : th ? "บันทึกภายใน (ไม่แสดงบนเว็บไซต์)" : "Internal notes (never shown publicly)"}><textarea maxLength={5000} value={article.editorialNotes ?? ""} onChange={(event) => set("editorialNotes", event.target.value || undefined)} /></Field><label className={styles.check}><input type="checkbox" checked={article.reviewRequired ?? false} onChange={(event) => set("reviewRequired", event.target.checked)} />{locale === "ar" ? cmsArabicUi["Requires factual review before publication"] : th ? "ยังต้องตรวจข้อมูลก่อนเผยแพร่" : "Requires factual review before publication"}</label>{article.reviewRequired && <p className={styles.notice}>{locale === "ar" ? cmsArabicUi["Publication is blocked until the evidence is reviewed and this requirement is cleared."] : th ? "ระบบจะไม่เผยแพร่บทความนี้จนกว่าจะตรวจข้อมูลครบและยกเลิกเครื่องหมายด้านบน" : "Publication is blocked until the evidence is reviewed and this requirement is cleared."}</p>}</section>
    <section className={styles.panel}><h2>{locale === "ar" ? cmsArabicUi["Translation review"] : th ? "ตรวจคำแปล" : "Translation review"}</h2><div className={styles.toolbar}>{locales.map((language) => { const copy = article.content[language]; const ready = !!copy.title.trim() && !!copy.category.trim() && !!copy.excerpt.trim() && !!copy.intro.trim() && copy.sections.length > 0 && copy.sections.every((section) => section.title.trim() && section.text.trim()); return <a href={`#article-${language}`} key={language} className={styles.button}>{localeSettings(language).label} · {ready ? (locale === "ar" ? cmsArabicUi["Core fields complete"] : th ? "ข้อมูลหลักครบ" : "Core fields complete") : (locale === "ar" ? cmsArabicUi["Incomplete"] : th ? "ยังไม่ครบ" : "Incomplete")}</a>; })}</div><p className={styles.hint}>{locale === "ar" ? cmsArabicUi["Review meaning and factual accuracy in both languages before publishing."] : th ? "ตรวจความหมายและความถูกต้องของทั้งสองภาษาก่อนเผยแพร่" : "Review meaning and factual accuracy in both languages before publishing."}</p></section>
    {locales.map((language) => {
      const copy = article.content[language];
      const update = (change: Partial<typeof copy>) => set("content", { ...article.content, [language]: { ...copy, ...change } });
      const categories = [...new Set(content.articles.map((entry) => entry.content[language].category).filter(Boolean))];
      return <section id={`article-${language}`} className={styles.panel} key={language} lang={language} dir={localeSettings(language).direction}><h2>{localeSettings(language).label}</h2><div className={styles.form}>
        <div className={styles.fields}><Field label={t.fields.title}><input required={language !== "ar"} maxLength={300} value={copy.title} onChange={(event) => update({ title: event.target.value })} /></Field><Field label={t.fields.category} hint={locale === "ar" ? cmsArabicUi["Choose an existing category or enter a new one."] : th ? "เลือกหมวดที่ใช้อยู่ หรือเพิ่มชื่อใหม่" : "Choose an existing category or enter a new one."}><input required={language !== "ar"} list={`categories-${language}`} maxLength={100} value={copy.category} onChange={(event) => update({ category: event.target.value })} /><datalist id={`categories-${language}`}>{categories.map((category) => <option key={category} value={category} />)}</datalist></Field></div>
        <Field label={t.fields.excerpt}><textarea required={language !== "ar"} maxLength={1500} value={copy.excerpt} onChange={(event) => update({ excerpt: event.target.value })} /></Field>
        <Field label={t.fields.intro}><textarea required={language !== "ar"} maxLength={6000} value={copy.intro} onChange={(event) => update({ intro: event.target.value })} /></Field>
        <div className={styles.toolbar}><h3>{t.sections}</h3><button type="button" className={styles.button} disabled={copy.sections.length >= 30} onClick={() => update({ sections: [...copy.sections, { title: "", text: "" }] })}><Plus aria-hidden="true" />{t.addSection}</button></div>
        {copy.sections.map((section, index) => <div className={styles.section} key={index}>
          <div className={styles.toolbar}><strong>{t.section} {index + 1}</strong><div className={styles.toolbar}>
            {([-1, 1] as const).map((delta) => <button key={delta} type="button" className={styles.iconButton} aria-label={delta < 0 ? t.moveUp : t.moveDown} disabled={index + delta < 0 || index + delta >= copy.sections.length} onClick={() => { const sections = [...copy.sections]; [sections[index], sections[index + delta]] = [sections[index + delta], sections[index]]; update({ sections }); }}>{delta < 0 ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />}</button>)}
            <button type="button" className={styles.iconButton} aria-label={`${t.removeSection} ${index + 1}`} disabled={copy.sections.length <= 1} onClick={() => update({ sections: copy.sections.filter((_, row) => row !== index) })}><Trash2 aria-hidden="true" /></button>
          </div></div>
          <SectionEditor locale={locale} content={content} section={section} onChange={(updated) => update({ sections: copy.sections.map((entry, row) => row === index ? updated : entry) })} />
        </div>)}
        <details className={styles.disclosure}><summary>{locale === "ar" ? cmsArabicUi["Author, images, and SEO"] : th ? "ผู้เขียน รูปภาพ และ SEO" : "Author, images, and SEO"}</summary><div className={styles.form}>
          <Field label={locale === "ar" ? cmsArabicUi["Author (only when verified)"] : th ? "ผู้เขียน (ระบุเมื่อยืนยันแล้ว)" : "Author (only when verified)"} hint={locale === "ar" ? cmsArabicUi["Uses the store name when empty."] : th ? "หากเว้นว่าง แสดงชื่อร้าน" : "Uses the store name when empty."}><input maxLength={200} value={copy.author ?? ""} onChange={(event) => update({ author: event.target.value || undefined })} /></Field>
          <Field label={t.fields.imageAlt}><input maxLength={500} value={copy.imageAlt ?? ""} onChange={(event) => update({ imageAlt: event.target.value || undefined })} /></Field>
          <Field label={locale === "ar" ? cmsArabicUi["Search result title"] : th ? "ชื่อสำหรับผลการค้นหา" : "Search result title"} hint={locale === "ar" ? cmsArabicUi["Uses the article title when empty."] : th ? "หากเว้นว่าง ใช้ชื่อบทความ" : "Uses the article title when empty."}><input maxLength={300} value={copy.seoTitle ?? ""} onChange={(event) => update({ seoTitle: event.target.value || undefined })} /></Field>
          <Field label={locale === "ar" ? cmsArabicUi["Search result description"] : th ? "คำอธิบายสำหรับผลการค้นหา" : "Search result description"} hint={locale === "ar" ? cmsArabicUi["Uses the article excerpt when empty."] : th ? "หากเว้นว่าง ใช้ข้อความแนะนำบทความ" : "Uses the article excerpt when empty."}><textarea maxLength={500} value={copy.seoDescription ?? ""} onChange={(event) => update({ seoDescription: event.target.value || undefined })} /></Field>
          <label className={styles.check}><input type="checkbox" checked={copy.socialImage !== undefined} onChange={(event) => update({ socialImage: event.target.checked ? article.image : undefined })} />{locale === "ar" ? cmsArabicUi["Use a separate social sharing image"] : th ? "ใช้ภาพสำหรับแชร์แยกต่างหาก" : "Use a separate social sharing image"}</label>
          {copy.socialImage !== undefined && <ImageField locale={locale} content={content} src={copy.socialImage} onChange={(socialImage) => update({ socialImage })} />}
          <LinksEditor locale={locale} label={locale === "ar" ? cmsArabicUi["References"] : th ? "แหล่งข้อมูลอ้างอิง" : "References"} links={copy.references} onChange={(references) => update({ references })} />
        </div></details>
      </div></section>;
    })}
    <section className={styles.panel}><h2>{locale === "ar" ? cmsArabicUi["Related products"] : th ? "สินค้าที่เกี่ยวข้อง" : "Related products"}</h2>{content.products.map((product) => <label className={styles.check} key={product.id}><input type="checkbox" checked={article.relatedProductIds?.includes(product.id) ?? false} onChange={(event) => set("relatedProductIds", event.target.checked ? [...(article.relatedProductIds ?? []), product.id] : article.relatedProductIds?.filter((id) => id !== product.id))} />{product.name[locale]}</label>)}</section>
  </form>;
}

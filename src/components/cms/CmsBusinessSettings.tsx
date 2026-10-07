"use client";

import { cmsArabicUi } from "@/content/cms-ar-ui";

import { businessKeys } from "@/lib/business-settings";
import { storeDetails } from "@/content/store-details";
import type { CmsSettings } from "@/lib/cms/types";
import { locales, localeSettings, type Locale } from "@/lib/i18n";
import styles from "./CmsBusinessSettings.module.css";

export default function CmsBusinessSettings({ locale, settings, onChange }: { locale: Locale; settings: CmsSettings; onChange: (settings: CmsSettings) => void }) {
  const th = locale === "th";
  return <section className={styles.panel}>
    <h2>{locale === "ar" ? cmsArabicUi["Selling & service details"] : th ? "ข้อมูลการขายและบริการ" : "Selling & service details"}</h2>
    <p>{locale === "ar" ? cmsArabicUi["Enter approved facts in both languages. Unconfirmed terms continue to invite customers to ask the team."] : th ? "กรอกข้อมูลจริงทั้งสองภาษา และยืนยันเมื่อได้รับอนุมัติแล้ว ข้อมูลที่ยังไม่ยืนยันจะแสดงข้อความให้ลูกค้าสอบถามทีมงาน" : "Enter approved facts in both languages. Unconfirmed terms continue to invite customers to ask the team."}</p>
    {businessKeys.map((key) => {
      const value = settings.business?.[key] ?? { confirmed: false, content: { en: storeDetails.en[key], ar: storeDetails.ar[key], th: storeDetails.th[key] } };
      const update = (next: typeof value) => onChange({ ...settings, business: { ...settings.business, [key]: next } });
      return <details key={key} className={styles.item}>
        <summary>{storeDetails[locale][key].title}<span>{value.confirmed ? (locale === "ar" ? cmsArabicUi["Confirmed"] : th ? "ยืนยันแล้ว" : "Confirmed") : (locale === "ar" ? cmsArabicUi["Needs confirmation"] : th ? "รอยืนยัน" : "Needs confirmation")}</span></summary>
        <label className={styles.check}><input type="checkbox" checked={value.confirmed} onChange={(event) => update({ ...value, confirmed: event.target.checked })} />{locale === "ar" ? cmsArabicUi["The store owner has confirmed these details"] : th ? "เจ้าของร้านยืนยันข้อมูลนี้แล้ว" : "The store owner has confirmed these details"}</label>
        <div className={styles.languages}>{locales.map((language) => <fieldset key={language} lang={language} dir={localeSettings(language).direction}>
          <legend>{localeSettings(language).label}</legend>
          {(["title", "summary", "description"] as const).map((field) => <label key={field}>{({ title: locale === "ar" ? cmsArabicUi["Title"] : th ? "หัวข้อ" : "Title", summary: locale === "ar" ? cmsArabicUi["Summary"] : th ? "สรุป" : "Summary", description: locale === "ar" ? cmsArabicUi["Details"] : th ? "รายละเอียด" : "Details" })[field]}
            <textarea rows={field === "description" ? 4 : 2} required={value.confirmed} maxLength={field === "description" ? 5000 : field === "summary" ? 500 : 200} value={value.content[language][field]} onChange={(event) => update({ ...value, confirmed: false, content: { ...value.content, [language]: { ...value.content[language], [field]: event.target.value } } })} />
          </label>)}
        </fieldset>)}</div>
      </details>;
    })}
  </section>;
}

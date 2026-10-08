"use client";

import { useState } from "react";
import { Check, Circle, Database, ImageIcon, RefreshCw } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { ReadinessItem } from "@/lib/launch-readiness";
import styles from "./CmsReadiness.module.css";

type ReadinessResult = { checks: ReadinessItem[]; checkedAt: string; externalServicesVerified: boolean };

const copy = {
  en: {
    heading: "Launch preparation", check: "Check setup", checking: "Checking…", intro: "This checks settings and published business details. A configured service still needs a real staging test.",
    notChecked: "Check setup to see the current configuration.", checked: "Configuration checked", required: "required settings present", settingsPresent: "Settings present", missingSettings: "Settings needed", providerUnverified: "Live service test pending", providerVerified: "Live service verified",
    database: "MongoDB content", databaseReady: "MongoDB settings are present. Test a write, transaction, complete backup and restore in staging before moving live content.", databaseMissing: "Set durable CMS storage and the MongoDB connection in the server environment.",
    media: "Cloudinary images", mediaReady: "Cloudinary credentials are present. Test upload, delivery, restore and safe Cleanup in staging.", mediaMissing: "Set the Cloudinary cloud name, API key and secret in the server environment.",
    sequence: "Data transfer rehearsal", steps: ["Use a separate staging database and Cloudinary folder.", "Export a complete backup, inspect it and restore it as a staging draft.", "Check images, history and Trash in every language; publish only after review."],
    other: "Other launch settings", configured: "Configured", pending: "Pending", error: "Could not check readiness. Sign in as an owner and retry.",
    labels: { domain: "HTTPS domain", database: "Durable database", media: "Image storage", staff: "Staff accounts", contact: "Email and phone", stock: "Stock information", shipping: "Delivery terms", returns: "Return terms", wholesale: "Wholesale terms", batch: "Batch information", preview: "Demo disabled before launch", indexing: "Indexing enabled at launch", enquiries: "Order enquiries enabled" },
  },
  th: {
    heading: "เตรียมเปิดร้าน", check: "ตรวจสอบ", checking: "กำลังตรวจสอบ…", intro: "ตรวจการตั้งค่าและข้อมูลธุรกิจที่เผยแพร่ การตั้งค่าครบยังต้องทดสอบบริการจริงในระบบทดลอง",
    notChecked: "กดตรวจสอบเพื่อดูการตั้งค่าปัจจุบัน", checked: "ตรวจการตั้งค่าแล้ว", required: "รายการที่ต้องตั้งค่าแล้ว", settingsPresent: "มีการตั้งค่า", missingSettings: "ยังต้องตั้งค่า", providerUnverified: "ยังไม่ได้ทดสอบบริการจริง", providerVerified: "ทดสอบบริการจริงแล้ว",
    database: "ข้อมูลใน MongoDB", databaseReady: "มีการตั้งค่า MongoDB แล้ว ก่อนย้ายข้อมูลจริงให้ทดสอบการเขียน ธุรกรรม การสำรองและกู้คืนครบชุดในระบบทดลอง", databaseMissing: "ตั้งค่าพื้นที่เก็บข้อมูล CMS แบบถาวรและการเชื่อมต่อ MongoDB ในระบบเซิร์ฟเวอร์",
    media: "รูปภาพใน Cloudinary", mediaReady: "มีข้อมูลเชื่อมต่อ Cloudinary แล้ว ให้ทดสอบอัปโหลด แสดงภาพ กู้คืน และ Cleanup อย่างปลอดภัยในระบบทดลอง", mediaMissing: "ตั้งค่าชื่อ Cloudinary, API key และ secret ในระบบเซิร์ฟเวอร์",
    sequence: "ทดสอบการย้ายข้อมูล", steps: ["ใช้ฐานข้อมูลทดลองและโฟลเดอร์ Cloudinary แยกจากระบบจริง", "สำรองข้อมูลครบชุด ตรวจไฟล์ และกู้คืนเป็นฉบับร่างในระบบทดลอง", "ตรวจรูปภาพ ประวัติ และถังขยะครบทุกภาษา ก่อนตรวจทานและเผยแพร่"],
    other: "การตั้งค่าอื่นก่อนเปิดร้าน", configured: "ตั้งค่าแล้ว", pending: "รอดำเนินการ", error: "ตรวจสอบไม่สำเร็จ กรุณาเข้าสู่ระบบด้วยบัญชีเจ้าของแล้วลองอีกครั้ง",
    labels: { domain: "โดเมน HTTPS", database: "ฐานข้อมูลถาวร", media: "พื้นที่เก็บรูปภาพ", staff: "บัญชีทีมงาน", contact: "อีเมลและโทรศัพท์", stock: "จำนวนสินค้า", shipping: "เงื่อนไขจัดส่ง", returns: "เงื่อนไขคืนสินค้า", wholesale: "เงื่อนไขขายส่ง", batch: "ข้อมูลล็อต", preview: "ปิดโหมดทดลองก่อนเปิดร้าน", indexing: "อนุญาตการจัดทำดัชนีเมื่อเปิดร้าน", enquiries: "รับคำขอสั่งซื้อ" },
  },
  ar: {
    heading: "الاستعداد للإطلاق", check: "فحص الإعدادات", checking: "جارٍ الفحص…", intro: "يفحص هذا الإعدادات والبيانات التجارية المنشورة. ما زالت الخدمة المهيأة تحتاج إلى اختبار فعلي في بيئة تجريبية.",
    notChecked: "افحص الإعدادات لعرض حالة التهيئة الحالية.", checked: "فُحصت الإعدادات", required: "إعدادات مطلوبة متوفرة", settingsPresent: "الإعدادات متوفرة", missingSettings: "الإعدادات مطلوبة", providerUnverified: "اختبار الخدمة الفعلي مطلوب", providerVerified: "تم اختبار الخدمة الفعلي",
    database: "المحتوى في MongoDB", databaseReady: "إعدادات MongoDB متوفرة. اختبر الكتابة والمعاملات والنسخ الاحتياطي الكامل والاستعادة في بيئة تجريبية قبل نقل المحتوى الفعلي.", databaseMissing: "اضبط تخزين CMS الدائم واتصال MongoDB في بيئة الخادم.",
    media: "الصور في Cloudinary", mediaReady: "بيانات Cloudinary متوفرة. اختبر الرفع والعرض والاستعادة والتنظيف الآمن في بيئة تجريبية.", mediaMissing: "اضبط اسم سحابة Cloudinary ومفتاح API والرمز السري في بيئة الخادم.",
    sequence: "تجربة نقل البيانات", steps: ["استخدم قاعدة بيانات تجريبية ومجلد Cloudinary منفصلين عن الإنتاج.", "صدّر نسخة احتياطية كاملة وافحصها واستعدها كمسودة في البيئة التجريبية.", "تحقق من الصور والسجل والمهملات بكل اللغات؛ انشر بعد المراجعة فقط."],
    other: "إعدادات الإطلاق الأخرى", configured: "مهيأ", pending: "معلّق", error: "تعذّر فحص الاستعداد. سجّل الدخول بحساب المالك وحاول مجددًا.",
    labels: { domain: "نطاق HTTPS", database: "قاعدة بيانات دائمة", media: "تخزين الصور", staff: "حسابات الفريق", contact: "البريد الإلكتروني والهاتف", stock: "معلومات المخزون", shipping: "شروط التوصيل", returns: "شروط الإرجاع", wholesale: "شروط البيع بالجملة", batch: "معلومات الدفعة", preview: "إيقاف العرض التجريبي قبل الإطلاق", indexing: "السماح بالفهرسة عند الإطلاق", enquiries: "تفعيل استفسارات الطلبات" },
  },
} satisfies Record<Locale, {
  heading: string; check: string; checking: string; intro: string; notChecked: string; checked: string; required: string; settingsPresent: string; missingSettings: string; providerUnverified: string; providerVerified: string;
  database: string; databaseReady: string; databaseMissing: string; media: string; mediaReady: string; mediaMissing: string; sequence: string; steps: string[]; other: string; configured: string; pending: string; error: string; labels: Record<string, string>;
}>;

export default function CmsReadiness({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const [result, setResult] = useState<ReadinessResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refresh = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/cms/readiness", { cache: "no-store" });
      if (!response.ok) throw new Error("Readiness unavailable");
      const data: ReadinessResult = await response.json();
      if (!Array.isArray(data.checks) || typeof data.checkedAt !== "string") throw new Error("Invalid readiness response");
      setResult(data);
    } catch { setResult(null); setError(t.error); }
    finally { setBusy(false); }
  };
  const checks = result?.checks ?? [];
  const required = checks.filter((item) => item.required);
  const otherChecks = checks.filter((item) => item.key !== "database" && item.key !== "media");
  const service = (key: "database" | "media") => {
    const item = checks.find((check) => check.key === key);
    const Icon = key === "database" ? Database : ImageIcon;
    return <article className={styles.service} key={key} data-configured={item?.ready === true}>
      <div className={styles.serviceHeading}><Icon aria-hidden="true" /><div><h3>{t[key]}</h3><span>{item?.ready ? t.settingsPresent : t.missingSettings}</span></div></div>
      <p>{item?.ready ? t[`${key}Ready`] : t[`${key}Missing`]}</p>
      {item?.ready && <span className={styles.verification}>{result?.externalServicesVerified ? t.providerVerified : t.providerUnverified}</span>}
    </article>;
  };
  return <section className={styles.panel} aria-labelledby="cms-readiness-heading">
    <div className={styles.heading}><div><h2 id="cms-readiness-heading">{t.heading}</h2><p>{t.intro}</p></div><button type="button" className="button buttonOutline" disabled={busy} onClick={() => void refresh()}><RefreshCw aria-hidden="true" />{busy ? t.checking : t.check}</button></div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {!result && !error && <p className={styles.empty}>{t.notChecked}</p>}
    {result && <><p className={styles.summary} role="status">{t.checked} · {required.filter((item) => item.ready).length}/{required.length} {t.required} · <time dateTime={result.checkedAt}>{new Date(result.checkedAt).toLocaleString(locale)}</time></p>
      <div className={styles.services}>{service("database")}{service("media")}</div>
      <h3 className={styles.otherHeading}>{t.other}</h3><ul className={styles.checks}>{otherChecks.map((item) => <li key={item.key} data-ready={item.ready}>{item.ready ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}<span>{t.labels[item.key as keyof typeof t.labels] ?? item.key}</span><span>{item.ready ? t.configured : t.pending}</span></li>)}</ul></>}
    <div className={styles.rehearsal}><h3>{t.sequence}</h3><ol>{t.steps.map((step) => <li key={step}>{step}</li>)}</ol></div>
  </section>;
}

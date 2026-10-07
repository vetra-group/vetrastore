"use client";

import { cmsArabicUi } from "@/content/cms-ar-ui";

import { useState } from "react";
import { Check, Circle, RefreshCw } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { ReadinessItem } from "@/lib/launch-readiness";
import styles from "./CmsReadiness.module.css";

const labels = {
  ar: { domain: "نطاق HTTPS", database: "قاعدة بيانات دائمة", media: "تخزين الصور", staff: "حسابات الفريق", contact: "البريد الإلكتروني والهاتف", stock: "معلومات المخزون", shipping: "شروط التوصيل", returns: "شروط الإرجاع", wholesale: "شروط البيع بالجملة", batch: "معلومات الدفعة", preview: "إيقاف العرض التجريبي قبل الإطلاق", indexing: "السماح بالفهرسة عند الإطلاق", enquiries: "تفعيل استفسارات الطلبات" },
  th: { domain: "โดเมน HTTPS", database: "ฐานข้อมูลถาวร", media: "พื้นที่เก็บรูปภาพ", staff: "บัญชีทีมงาน", contact: "อีเมลและโทรศัพท์", stock: "จำนวนสินค้า", shipping: "เงื่อนไขจัดส่ง", returns: "เงื่อนไขคืนสินค้า", wholesale: "เงื่อนไขขายส่ง", batch: "ข้อมูลล็อต", preview: "ปิดโหมดทดลองก่อนเปิดร้าน", indexing: "อนุญาตการจัดทำดัชนีเมื่อเปิดร้าน", enquiries: "รับคำขอสั่งซื้อ" },
  en: { domain: "HTTPS domain", database: "Durable database", media: "Image storage", staff: "Staff accounts", contact: "Email and phone", stock: "Stock information", shipping: "Delivery terms", returns: "Return terms", wholesale: "Wholesale terms", batch: "Batch information", preview: "Demo disabled before launch", indexing: "Indexing enabled at launch", enquiries: "Order enquiries enabled" },
};
export default function CmsReadiness({ locale }: { locale: Locale }) {
  const [checks, setChecks] = useState<ReadinessItem[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const th = locale === "th";
  const refresh = async () => { setBusy(true); setError(""); try { const response = await fetch("/api/cms/readiness", { cache: "no-store" }); if (!response.ok) throw new Error(); const data = await response.json(); setChecks(data.checks); } catch { setError(locale === "ar" ? cmsArabicUi["Could not check readiness. Sign in as an owner and retry."] : th ? "ตรวจสอบไม่สำเร็จ กรุณาเข้าสู่ระบบด้วยบัญชีเจ้าของแล้วลองอีกครั้ง" : "Could not check readiness. Sign in as an owner and retry."); } finally { setBusy(false); } };
  return <section className={styles.panel}><div className={styles.heading}><h2>{locale === "ar" ? cmsArabicUi["Launch preparation"] : th ? "เตรียมเปิดร้าน" : "Launch preparation"}</h2><button type="button" className="button buttonOutline" disabled={busy} onClick={() => void refresh()}><RefreshCw aria-hidden="true" />{locale === "ar" ? cmsArabicUi["Check setup"] : th ? "ตรวจสอบ" : "Check setup"}</button></div><p>{locale === "ar" ? cmsArabicUi["Checks configuration and published business details. Live services, backup restoration, and buying journeys still need a staging rehearsal."] : th ? "ตรวจการตั้งค่าและข้อมูลที่เผยแพร่ ยังต้องทดสอบบริการจริง สำรองข้อมูล และตรวจขั้นตอนซื้อก่อนเปิดร้าน" : "Checks configuration and published business details. Live services, backup restoration, and buying journeys still need a staging rehearsal."}</p>{error && <p role="alert">{error}</p>}<ul>{checks.map((item) => <li key={item.key}>{item.ready ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}<span>{labels[locale][item.key as keyof typeof labels.en]}</span><span>{item.ready ? (locale === "ar" ? cmsArabicUi["Configured"] : th ? "ตั้งค่าแล้ว" : "Configured") : (locale === "ar" ? cmsArabicUi["Pending"] : th ? "รอดำเนินการ" : "Pending")}</span></li>)}</ul></section>;
}

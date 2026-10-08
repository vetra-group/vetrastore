"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import type { Locale, Localized } from "@/lib/i18n";
import styles from "./PaymentInventory.module.css";

type InventoryRow = {
  productId: string;
  productName: Localized<string> | null;
  currentPublishedStock: number | null;
  publishedStock: number;
  totalSellableBudget: number;
  available: number;
  reserved: number;
  committed: number;
  version: number;
  updatedAt: string;
  needsReconciliation: boolean;
};

const copy = {
  en: {
    eyebrow: "REAL PAYMENT INVENTORY", title: "Stock reconciliation", intro: "Review stock used by online payments. Published stock edits pause new reservations until an owner reconciles the real balance.", refresh: "Refresh", cleanup: "Release expired unstarted orders", cleanupDone: "Expired orders with no provider attempt released:", cleanupError: "Expired order cleanup could not finish. Review payment orders and retry.", loading: "Loading real inventory…", empty: "No real payment stock has been seeded yet. A product record is created with its first payment reservation.", unavailable: "Real payment inventory requires the configured MongoDB CMS.", loadError: "Inventory could not be loaded. Try again.", product: "Product", published: "Current CMS stock", lastPublished: "Last reconciled CMS stock", budget: "Total sellable budget", available: "Available", reserved: "Reserved", committed: "Paid commitments", mismatch: "CMS stock changed · reconciliation required", matched: "Matches published stock", adjust: "Reconcile stock", cancel: "Cancel", reason: "Reason for adjustment", reasonHint: "Record the physical count or correction that supports this budget.", budgetHint: "Enter the total sellable budget including all paid commitments since this ledger began. For example, if 6 units have been paid and 90 remain sellable, enter 96. The system subtracts reserved and paid units once.", save: "Save reconciliation", saving: "Saving…", saved: "Stock reconciliation saved. Balances have been refreshed.", saveError: "Stock could not be reconciled. Refresh and review the current balance before trying again.", conflict: "Stock changed while you were reviewing it. Refresh before saving.", minimum: "The total budget cannot be below units already reserved or paid.", version: "Balance version", unknown: "Not published", review: "Review the published quantity before changing this balance.",
  },
  th: {
    eyebrow: "สต็อกสำหรับการชำระเงินจริง", title: "ตรวจสอบยอดสินค้า", intro: "ตรวจสอบสต็อกที่ใช้กับการชำระเงินออนไลน์ เมื่อแก้ไขจำนวนที่เผยแพร่ ระบบจะหยุดจองสินค้าใหม่จนกว่าเจ้าของร้านจะตรวจสอบยอดจริง", refresh: "โหลดใหม่", cleanup: "คืนสต็อกจากคำสั่งซื้อหมดเวลาที่ยังไม่เริ่มชำระ", cleanupDone: "คืนสต็อกคำสั่งซื้อที่ไม่เคยเริ่มชำระแล้ว:", cleanupError: "คืนสต็อกคำสั่งซื้อหมดเวลาไม่สำเร็จ โปรดตรวจสอบรายการและลองอีกครั้ง", loading: "กำลังโหลดสต็อกจริง…", empty: "ยังไม่มีรายการสต็อกสำหรับการชำระเงินจริง ระบบจะสร้างรายการเมื่อมีการจองสินค้าครั้งแรก", unavailable: "สต็อกสำหรับการชำระเงินจริงต้องใช้ CMS ที่เชื่อม MongoDB", loadError: "โหลดสต็อกไม่ได้ โปรดลองอีกครั้ง", product: "สินค้า", published: "จำนวนที่เผยแพร่ใน CMS", lastPublished: "จำนวนใน CMS ที่ตรวจสอบล่าสุด", budget: "จำนวนทั้งหมดที่ขายได้", available: "พร้อมขาย", reserved: "จองแล้ว", committed: "ขายและชำระแล้ว", mismatch: "จำนวนใน CMS เปลี่ยน · ต้องตรวจสอบสต็อก", matched: "ตรงกับจำนวนที่เผยแพร่", adjust: "ตรวจสอบและปรับยอด", cancel: "ยกเลิก", reason: "เหตุผลที่ปรับยอด", reasonHint: "ระบุผลนับสินค้าจริงหรือเหตุผลในการแก้ไขยอดนี้", budgetHint: "กรอกจำนวนทั้งหมดที่ขายได้ รวมสินค้าที่ชำระเงินแล้วนับตั้งแต่เริ่มบันทึกสต็อกนี้ เช่น ขายแล้ว 6 ขวด และเหลือขายได้ 90 ขวด ให้กรอก 96 ระบบจะหักยอดจองและยอดขายเพียงครั้งเดียว", save: "บันทึกยอดที่ตรวจสอบ", saving: "กำลังบันทึก…", saved: "บันทึกยอดที่ตรวจสอบแล้ว และโหลดข้อมูลสต็อกล่าสุด", saveError: "ตรวจสอบยอดสต็อกไม่สำเร็จ โปรดโหลดข้อมูลใหม่และตรวจสอบยอดก่อนลองอีกครั้ง", conflict: "ยอดสต็อกเปลี่ยนระหว่างตรวจสอบ โปรดโหลดข้อมูลใหม่ก่อนบันทึก", minimum: "จำนวนทั้งหมดต้องไม่น้อยกว่ายอดที่จองและชำระแล้ว", version: "รุ่นข้อมูลสต็อก", unknown: "ยังไม่เผยแพร่", review: "ตรวจสอบจำนวนที่เผยแพร่ก่อนปรับยอดนี้", 
  },
  ar: {
    eyebrow: "مخزون المدفوعات الفعلية", title: "مطابقة المخزون", intro: "راجع المخزون المستخدم للمدفوعات عبر الإنترنت. يوقف تعديل الكمية المنشورة الحجوزات الجديدة حتى يطابق المالك الرصيد الفعلي.", refresh: "تحديث", cleanup: "إرجاع مخزون الطلبات المنتهية التي لم تبدأ الدفع", cleanupDone: "طلبات منتهية بلا محاولة دفع أُعيد مخزونها:", cleanupError: "تعذّر إرجاع مخزون الطلبات المنتهية. راجع الطلبات وأعد المحاولة.", loading: "جارٍ تحميل المخزون الفعلي…", empty: "لم يُنشأ سجل مخزون للمدفوعات الفعلية بعد. يُنشأ عند أول حجز مرتبط بالدفع.", unavailable: "يتطلب المخزون الفعلي نظام إدارة متصلًا بقاعدة MongoDB.", loadError: "تعذّر تحميل المخزون. حاول مجددًا.", product: "المنتج", published: "المخزون المنشور حاليًا", lastPublished: "آخر مخزون منشور طوبق", budget: "إجمالي الكمية القابلة للبيع", available: "متاح", reserved: "محجوز", committed: "مبيعات مدفوعة", mismatch: "تغيّر المخزون المنشور · المطابقة مطلوبة", matched: "يطابق المخزون المنشور", adjust: "مطابقة المخزون", cancel: "إلغاء", reason: "سبب التعديل", reasonHint: "اذكر نتيجة الجرد الفعلي أو سبب تصحيح هذا الإجمالي.", budgetHint: "أدخل إجمالي الكمية القابلة للبيع شاملًا جميع الوحدات المدفوعة منذ بدء هذا السجل. مثلًا، إذا دُفعت قيمة ٦ وحدات وبقيت ٩٠ وحدة للبيع، فأدخل ٩٦. يخصم النظام الحجوزات والمبيعات مرة واحدة.", save: "حفظ المطابقة", saving: "جارٍ الحفظ…", saved: "حُفظت مطابقة المخزون وحُدثت الأرصدة.", saveError: "تعذّرت مطابقة المخزون. حدّث الصفحة وراجع الرصيد الحالي قبل المحاولة مجددًا.", conflict: "تغيّر المخزون أثناء المراجعة. حدّث البيانات قبل الحفظ.", minimum: "لا يجوز أن يقل الإجمالي عن الوحدات المحجوزة والمدفوعة.", version: "إصدار الرصيد", unknown: "غير منشور", review: "راجع الكمية المنشورة قبل تعديل هذا الرصيد.",
  },
} as const;

function quantity(value: number, locale: Locale) { return new Intl.NumberFormat(locale).format(value); }

export function PaymentInventory({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [budget, setBudget] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [saveError, setSaveError] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/cms/payment-inventory", { credentials: "same-origin", cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
      if (response.status === 503) { setUnavailable(true); setLoadError(false); return; }
      if (!response.ok) throw new Error("Inventory request failed");
      const data = await response.json() as { inventory?: InventoryRow[] };
      if (!Array.isArray(data.inventory)) throw new Error("Invalid inventory response");
      setRows(data.inventory);
      setUnavailable(false); setLoadError(false);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setLoadError(true);
    } finally { if (!signal?.aborted) setLoading(false); }
  }, []);

  useEffect(() => { const controller = new AbortController(); void Promise.resolve().then(() => load(controller.signal)); return () => controller.abort(); }, [load]);

  function refresh() { setLoading(true); setLoadError(false); setUnavailable(false); void load(); }

  async function cleanup() {
    setCleaning(true); setSaveError(""); setFeedback("");
    try {
      const response = await fetch("/api/cms/payment-maintenance", { method: "POST", credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("cleanup failed");
      const result = await response.json() as { released?: number };
      if (!Number.isSafeInteger(result.released)) throw new Error("invalid cleanup result");
      await load();
      setFeedback(`${t.cleanupDone} ${result.released}`);
    } catch { setSaveError(t.cleanupError); }
    finally { setCleaning(false); }
  }

  function edit(row: InventoryRow) {
    setSelectedId(row.productId); setBudget(""); setReason(""); setSaveError(""); setFeedback("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const row = rows.find((entry) => entry.productId === selectedId);
    const amount = /^\d+$/.test(budget) ? Number(budget) : NaN;
    if (!row || !Number.isSafeInteger(amount) || amount < row.reserved + row.committed || amount > 1_000_000 || !reason.trim()) {
      setSaveError(t.minimum); return;
    }
    setSaving(true); setSaveError(""); setFeedback("");
    try {
      const response = await fetch("/api/cms/payment-inventory", {
        method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: row.productId, expectedVersion: row.version, totalSellableBudget: amount, reason: reason.trim() }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { code?: string };
        throw new Error(result.code === "INVENTORY_CONFLICT" ? "conflict" : "failed");
      }
      setLoading(true);
      await load();
      setSelectedId(null); setBudget(""); setReason(""); setFeedback(t.saved);
    } catch (error) { setSaveError(error instanceof Error && error.message === "conflict" ? t.conflict : t.saveError); }
    finally { setSaving(false); }
  }

  return <section className={styles.section} aria-labelledby="payment-inventory-heading">
    <header className={styles.header}><div><p className={styles.eyebrow}>{t.eyebrow}</p><h2 id="payment-inventory-heading">{t.title}</h2><p>{t.intro}</p></div><div className={styles.headerActions}><button className={styles.action} type="button" onClick={() => void cleanup()} disabled={loading || saving || cleaning}>{t.cleanup}</button><button className={styles.action} type="button" onClick={() => void refresh()} disabled={loading || saving || cleaning}><RefreshCw aria-hidden="true" />{t.refresh}</button></div></header>
    {loading ? <p className={styles.note} role="status">{t.loading}</p> : unavailable ? <p className={styles.note}>{t.unavailable}</p> : loadError ? <p className={styles.error} role="alert">{t.loadError}</p> : rows.length === 0 ? <p className={styles.note}>{t.empty}</p> : <div className={styles.cards}>{rows.map((row) => <article className={styles.card} key={row.productId}>
      <div className={styles.cardHead}><div><p className={styles.productLabel}>{t.product}</p><h3>{row.productName?.[locale] ?? <bdi>{row.productId}</bdi>}</h3></div><span className={row.needsReconciliation ? styles.mismatch : styles.matched}>{row.needsReconciliation && <AlertTriangle aria-hidden="true" />}{row.needsReconciliation ? t.mismatch : t.matched}</span></div>
      <dl className={styles.balances}>
        <div><dt>{t.published}</dt><dd>{row.currentPublishedStock === null ? t.unknown : quantity(row.currentPublishedStock, locale)}</dd></div>
        <div><dt>{t.lastPublished}</dt><dd>{quantity(row.publishedStock, locale)}</dd></div>
        <div><dt>{t.budget}</dt><dd>{quantity(row.totalSellableBudget, locale)}</dd></div>
        <div><dt>{t.available}</dt><dd>{quantity(row.available, locale)}</dd></div>
        <div><dt>{t.reserved}</dt><dd>{quantity(row.reserved, locale)}</dd></div>
        <div><dt>{t.committed}</dt><dd>{quantity(row.committed, locale)}</dd></div>
      </dl>
      <div className={styles.cardActions}><span>{t.version}: <bdi>{row.version}</bdi></span><button type="button" className={styles.action} disabled={saving || row.currentPublishedStock === null} onClick={() => edit(row)}>{t.adjust}</button></div>
      {selectedId === row.productId && <form className={styles.form} onSubmit={(event) => void save(event)}>
        <p className={styles.warning}><AlertTriangle aria-hidden="true" />{t.budgetHint}</p>
        <label>{t.budget}<input type="number" min={row.reserved + row.committed} max={1_000_000} step={1} inputMode="numeric" required value={budget} onChange={(event) => setBudget(event.target.value)} /></label>
        <label>{t.reason}<textarea required maxLength={1000} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t.reasonHint} /></label>
        {row.needsReconciliation && <p className={styles.note}>{t.review}</p>}
        <div className={styles.formActions}><button type="submit" className={styles.primary} disabled={saving}>{saving ? t.saving : t.save}</button><button type="button" className={styles.action} disabled={saving} onClick={() => setSelectedId(null)}>{t.cancel}</button></div>
        {saveError && <p className={styles.error} role="alert">{saveError}</p>}
      </form>}
    </article>)}</div>}
    {feedback && <p className={styles.success} role="status">{feedback}</p>}
  </section>;
}

"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, RefreshCw, ShoppingBag, X } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import LoadingScreen from "@/components/loading/LoadingScreen";
import { CmsDialog } from "./CmsDialog";
import styles from "./PaidOrders.module.css";

type PaymentAttemptView = {
  status: "creating" | "ready" | "uncertain" | "failed" | "paid";
  provider: string;
  providerPaymentId: string | null;
  createdAt?: string;
  updatedAt?: string;
  providerExpiresAtUnix?: number;
};
type PaidOrderRow = {
  id: string;
  reference: string;
  status: "pending" | "paid";
  customerName: string;
  totalMinor: number;
  currency: "THB";
  createdAt: string;
  paidAt: string | null;
  expiresAt: string;
  initiationWindowElapsed: boolean;
  attempt: PaymentAttemptView | null;
  requiresPaymentReview: boolean;
};
type Group = "review" | "paid";
type PaidOrderList = { available: boolean; group?: Group; page: number; hasMore: boolean; orders: PaidOrderRow[] };
type PaidOrderDetail = {
  id: string;
  reference: string;
  status: "pending" | "paid";
  customer: Record<"name" | "email" | "phone" | "address" | "district" | "province" | "postcode" | "notes", string>;
  items: { id: string; name: string; quantity: number; lineTotalMinor: number }[];
  subtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
  currency: "THB";
  createdAt: string;
  paidAt: string | null;
  expiresAt: string;
  initiationWindowElapsed: boolean;
  attempt: PaymentAttemptView | null;
  requiresPaymentReview: boolean;
  additionalPaidAttempts: number;
};

const copy = {
  en: {
    eyebrow: "CONFIRMED PAYMENTS", title: "Paid online orders", intro: "Payment provider confirmed these orders. Customer and delivery details are available to signed-in staff.", unavailable: "Live online orders appear here when shared MongoDB storage is configured.",
    readOnly: "Read-only view · Fulfilment and shipping status are not tracked here.", refresh: "Refresh", loading: "Loading paid orders…", empty: "No paid online orders yet.", error: "Paid orders could not be loaded. Please try again.", detailError: "Order details could not be loaded.", details: "Order details", close: "Close", paid: "Paid", review: "Payment needs review", reviewDetail: "Additional successful payment attempts were recorded. Review this order with the payment provider before fulfilment.", previous: "Previous", next: "Next", page: "Page", of: "of", customer: "Customer", contact: "Contact", delivery: "Delivery address", notes: "Customer notes", items: "Items", subtotal: "Subtotal", shipping: "Shipping", total: "Paid total", provider: "Payment provider", paymentId: "Provider payment ID", orderedAt: "Ordered", paidAt: "Paid at", free: "Free", none: "—",
    reviewEyebrow: "OPEN PAYMENT ORDERS", reviewTitle: "Needs review", reviewIntro: "These orders are not confirmed paid. Check their latest saved attempt and reconcile uncertain outcomes with the provider.", reviewLoading: "Loading open payment orders…", reviewEmpty: "No open payment orders.", reviewError: "Open payment orders could not be loaded.", pendingWarning: "Payment is not confirmed. Do not fulfil this order until the provider confirms it.", windowElapsed: "The local payment-start window has passed. This does not prove the provider payment failed; reconcile it before closing the order or releasing stock.", windowElapsedShort: "Start window ended", attemptStatus: "Last attempt", attemptStates: { creating: "Starting", ready: "Checkout ready", uncertain: "Outcome unknown", failed: "Attempt failed", paid: "Paid attempt needs reconciliation", none: "No attempt" }, providerExpiry: "Provider session expiry", orderTotal: "Order total",
  },
  th: {
    eyebrow: "ยืนยันการชำระเงิน", title: "คำสั่งซื้อที่ชำระแล้ว", intro: "ผู้ให้บริการชำระเงินยืนยันรายการเหล่านี้แล้ว เจ้าหน้าที่ที่ลงชื่อเข้าใช้สามารถดูข้อมูลลูกค้าและที่อยู่จัดส่งได้", unavailable: "คำสั่งซื้อออนไลน์จริงจะแสดงที่นี่เมื่อเชื่อมต่อ MongoDB สำหรับ CMS แล้ว",
    readOnly: "ดูข้อมูลเท่านั้น · ระบบนี้ยังไม่ติดตามสถานะการจัดเตรียมและจัดส่ง", refresh: "โหลดใหม่", loading: "กำลังโหลดคำสั่งซื้อ…", empty: "ยังไม่มีคำสั่งซื้อที่ชำระเงินออนไลน์", error: "โหลดคำสั่งซื้อไม่ได้ โปรดลองอีกครั้ง", detailError: "โหลดรายละเอียดคำสั่งซื้อไม่ได้", details: "รายละเอียดคำสั่งซื้อ", close: "ปิด", paid: "ชำระแล้ว", review: "ต้องตรวจสอบการชำระเงิน", reviewDetail: "พบการชำระเงินสำเร็จเพิ่มเติม โปรดตรวจสอบกับผู้ให้บริการชำระเงินก่อนจัดส่ง", previous: "ก่อนหน้า", next: "ถัดไป", page: "หน้า", of: "จาก", customer: "ลูกค้า", contact: "ติดต่อ", delivery: "ที่อยู่จัดส่ง", notes: "หมายเหตุจากลูกค้า", items: "สินค้า", subtotal: "ค่าสินค้า", shipping: "ค่าจัดส่ง", total: "ยอดชำระ", provider: "ผู้ให้บริการชำระเงิน", paymentId: "รหัสรายการจากผู้ให้บริการ", orderedAt: "สั่งซื้อเมื่อ", paidAt: "ชำระเมื่อ", free: "ฟรี", none: "—",
    reviewEyebrow: "คำสั่งซื้อที่ยังเปิดอยู่", reviewTitle: "รอตรวจสอบ", reviewIntro: "คำสั่งซื้อเหล่านี้ยังไม่ได้รับการยืนยันว่าชำระแล้ว โปรดตรวจสอบความคืบหน้าของรายการล่าสุดกับผู้ให้บริการชำระเงิน", reviewLoading: "กำลังโหลดคำสั่งซื้อที่รอตรวจสอบ…", reviewEmpty: "ไม่มีคำสั่งซื้อที่รอตรวจสอบ", reviewError: "โหลดคำสั่งซื้อที่รอตรวจสอบไม่ได้", pendingWarning: "ยังไม่ยืนยันการชำระเงิน อย่าจัดส่งก่อนผู้ให้บริการยืนยัน", windowElapsed: "เลยช่วงเวลาเริ่มชำระเงินของระบบแล้ว แต่ไม่ได้หมายความว่าการชำระเงินกับผู้ให้บริการล้มเหลว โปรดตรวจสอบก่อนปิดคำสั่งซื้อหรือคืนสต็อก", windowElapsedShort: "เลยเวลาเริ่มชำระเงิน", attemptStatus: "รายการชำระเงินล่าสุด", attemptStates: { creating: "กำลังเริ่มชำระเงิน", ready: "พร้อมชำระเงิน", uncertain: "ยังไม่ทราบผล", failed: "รายการชำระเงินไม่สำเร็จ", paid: "รายการชำระแล้ว ต้องตรวจสอบ", none: "ยังไม่มีรายการชำระเงิน" }, providerExpiry: "เวลาสิ้นสุดเซสชันของผู้ให้บริการ", orderTotal: "ยอดคำสั่งซื้อ",
  },
  ar: {
    eyebrow: "مدفوعات مؤكدة", title: "الطلبات المدفوعة عبر الإنترنت", intro: "أكد مزوّد الدفع هذه الطلبات. يمكن للموظفين المسجّلين الاطلاع على بيانات العملاء وعناوين التوصيل.", unavailable: "ستظهر الطلبات الفعلية هنا بعد إعداد تخزين MongoDB المشترك لنظام الإدارة.",
    readOnly: "للعرض فقط · لا تُتابَع حالة تجهيز الطلبات وشحنها هنا.", refresh: "تحديث", loading: "جارٍ تحميل الطلبات المدفوعة…", empty: "لا توجد طلبات مدفوعة عبر الإنترنت حتى الآن.", error: "تعذّر تحميل الطلبات المدفوعة. يُرجى المحاولة مجددًا.", detailError: "تعذّر تحميل تفاصيل الطلب.", details: "تفاصيل الطلب", close: "إغلاق", paid: "مدفوع", review: "يحتاج الدفع إلى مراجعة", reviewDetail: "سُجّلت محاولات دفع ناجحة إضافية. راجع الطلب مع مزوّد الدفع قبل تجهيزه.", previous: "السابق", next: "التالي", page: "الصفحة", of: "من", customer: "العميل", contact: "بيانات التواصل", delivery: "عنوان التوصيل", notes: "ملاحظات العميل", items: "المنتجات", subtotal: "قيمة المنتجات", shipping: "الشحن", total: "المبلغ المدفوع", provider: "مزوّد الدفع", paymentId: "رقم العملية لدى المزوّد", orderedAt: "تاريخ الطلب", paidAt: "تاريخ الدفع", free: "مجاني", none: "—",
    reviewEyebrow: "طلبات دفع مفتوحة", reviewTitle: "تحتاج إلى مراجعة", reviewIntro: "لم يتأكد دفع هذه الطلبات بعد. راجع آخر محاولة محفوظة وتحقق من الحالات غير المؤكدة لدى مزوّد الدفع.", reviewLoading: "جارٍ تحميل طلبات الدفع المفتوحة…", reviewEmpty: "لا توجد طلبات دفع مفتوحة.", reviewError: "تعذّر تحميل طلبات الدفع المفتوحة.", pendingWarning: "لم يُؤكَّد الدفع بعد. لا تُجهّز الطلب قبل تأكيد مزوّد الدفع.", windowElapsed: "انتهت مهلة بدء الدفع في النظام، لكن ذلك لا يثبت فشل الدفع لدى المزوّد. تحقق قبل إغلاق الطلب أو إعادة المخزون.", windowElapsedShort: "انتهت مهلة بدء الدفع", attemptStatus: "آخر محاولة دفع", attemptStates: { creating: "بدء الدفع جارٍ", ready: "صفحة الدفع جاهزة", uncertain: "النتيجة غير معروفة", failed: "فشلت المحاولة", paid: "محاولة مدفوعة تحتاج إلى مطابقة", none: "لا توجد محاولة" }, providerExpiry: "انتهاء جلسة المزوّد", orderTotal: "إجمالي الطلب",
  },
} as const;

function amount(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "THB" }).format(value / 100);
}

function date(value: string | null, locale: Locale) {
  if (!value) return copy[locale].none;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(timestamp) : copy[locale].none;
}

function providerExpiry(value: number | undefined, locale: Locale) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 253402300799
    ? date(new Date(value * 1000).toISOString(), locale)
    : copy[locale].none;
}

export function PaidOrders({ locale }: { locale: Locale }) {
  return <div className={styles.groups}><PaymentOrderGroup locale={locale} group="review" /><PaymentOrderGroup locale={locale} group="paid" /></div>;
}

function PaymentOrderGroup({ locale, group }: { locale: Locale; group: Group }) {
  const t = copy[locale];
  const title = group === "review" ? t.reviewTitle : t.title;
  const intro = group === "review" ? t.reviewIntro : t.intro;
  const eyebrow = group === "review" ? t.reviewEyebrow : t.eyebrow;
  const loading = group === "review" ? t.reviewLoading : t.loading;
  const empty = group === "review" ? t.reviewEmpty : t.empty;
  const errorText = group === "review" ? t.reviewError : t.error;
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [list, setList] = useState<PaidOrderList | null>(null);
  const [error, setError] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PaidOrderDetail | null>(null);
  const [detailError, setDetailError] = useState(false);
  const loadKey = `${group}:${page}:${revision}`;
  const listLoading = loadedKey !== loadKey;
  const listError = error && !listLoading;

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/cms/payment-orders?group=${group}&page=${page}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      .then(async (response) => {
        if (!response.ok) throw new Error("Paid orders unavailable");
        return await response.json() as PaidOrderList;
      })
      .then((result) => {
        if (controller.signal.aborted) return;
        if (!Array.isArray(result.orders) || result.available && result.group !== group) throw new Error("Invalid payment orders");
        setList(result);
        setError(false);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoadedKey(loadKey); });
    return () => controller.abort();
  }, [group, page, revision, loadKey]);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    void fetch(`/api/cms/payment-orders?id=${encodeURIComponent(selectedId)}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      .then(async (response) => {
        if (!response.ok) throw new Error("Paid order unavailable");
        return await response.json() as { order: PaidOrderDetail };
      })
      .then((result) => {
        if (controller.signal.aborted) return;
        if (!result.order || result.order.id !== selectedId) throw new Error("Invalid paid order");
        setDetail(result.order);
        setDetailError(false);
      })
      .catch(() => { if (!controller.signal.aborted) setDetailError(true); });
    return () => controller.abort();
  }, [selectedId]);

  function refresh() { setError(false); setRevision((value) => value + 1); }
  function changePage(next: number) { setError(false); setPage(next); }
  function open(id: string) { setDetail(null); setDetailError(false); setSelectedId(id); }
  function close() { setSelectedId(null); setDetail(null); setDetailError(false); }

  return <section className={styles.section} aria-labelledby={`payment-orders-${group}-heading`}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>{eyebrow}</p><h2 id={`payment-orders-${group}-heading`}>{title}</h2><p>{intro}</p></div>
      <button type="button" className={styles.action} disabled={listLoading} onClick={refresh}><RefreshCw aria-hidden="true" />{t.refresh}</button>
    </header>
    <p className={styles.notice}>{t.readOnly}</p>
    {listError && <p className={styles.error} role="alert">{errorText}</p>}
    {listLoading && <LoadingScreen variant={list ? "compact" : "panel"} layout="content" locale={locale} label={loading} />}
    {!listError && list && !list.available && <div className={styles.empty}><ShoppingBag aria-hidden="true" /><p>{t.unavailable}</p></div>}
    {!listError && list?.available && list.orders.length === 0 && <div className={styles.empty}><ShoppingBag aria-hidden="true" /><p>{empty}</p></div>}
    {!listError && list?.available && list.orders.length > 0 && <>
      <div className={styles.rows} aria-busy={listLoading}>{list.orders.map((order) => <button type="button" className={styles.row} key={order.id} onClick={() => open(order.id)}>
        <span className={styles.rowMain}><strong dir="ltr">{order.reference}</strong><span>{order.customerName}</span>{group === "review" && order.attempt && <span><bdi>{order.attempt.provider}</bdi>{order.attempt.providerPaymentId && <> · <bdi dir="ltr">{order.attempt.providerPaymentId}</bdi></>}</span>}</span>
        <span className={styles.rowMeta}><strong>{amount(order.totalMinor, locale)}</strong><span>{date(group === "paid" ? order.paidAt : order.createdAt, locale)}</span>{group === "review" && order.initiationWindowElapsed && <span className={styles.elapsed}>{t.windowElapsedShort}</span>}</span>
        <span className={group === "review" || order.requiresPaymentReview ? styles.review : styles.paid}>{group === "review" || order.requiresPaymentReview ? <AlertTriangle aria-hidden="true" /> : null}{group === "review" ? t.attemptStates[order.attempt?.status ?? "none"] : order.requiresPaymentReview ? t.review : t.paid}</span>
        <ChevronRight className={styles.chevron} aria-hidden="true" />
      </button>)}</div>
      {(page > 1 || list.hasMore) && <nav className={styles.pagination} aria-label={title}>
        <button type="button" className={styles.action} disabled={listLoading || page <= 1} onClick={() => changePage(page - 1)}><ChevronLeft aria-hidden="true" />{t.previous}</button>
        <span>{t.page} {list.page}</span>
        <button type="button" className={styles.action} disabled={listLoading || !list.hasMore} onClick={() => changePage(page + 1)}>{t.next}<ChevronRight aria-hidden="true" /></button>
      </nav>}
    </>}
    {selectedId && <CmsDialog label={detail?.reference ?? t.details} className={styles.dialog} onClose={close}>
      <div className={styles.detailHeader}><div><p className={styles.eyebrow}>{t.details}</p><h2 dir="ltr">{detail?.reference ?? t.details}</h2></div><button type="button" className={styles.close} aria-label={t.close} onClick={close}><X aria-hidden="true" /></button></div>
      {detailError && <p role="alert" className={styles.error}>{t.detailError}</p>}
      {!detailError && !detail && <LoadingScreen variant="panel" layout="form" locale={locale} label={loading} />}
      {detail && <div className={styles.detail}>
        {detail.status === "pending" && <p className={styles.reviewAlert}><AlertTriangle aria-hidden="true" />{t.pendingWarning}</p>}
        {detail.status === "pending" && detail.initiationWindowElapsed && <p className={styles.reviewAlert}><AlertTriangle aria-hidden="true" />{t.windowElapsed}</p>}
        {detail.requiresPaymentReview && <p className={styles.reviewAlert}><AlertTriangle aria-hidden="true" />{t.reviewDetail} ({detail.additionalPaidAttempts})</p>}
        <dl className={styles.facts}>
          <div><dt>{t.customer}</dt><dd>{detail.customer.name}</dd></div>
          <div><dt>{t.contact}</dt><dd><a href={`mailto:${detail.customer.email}`}>{detail.customer.email}</a><br /><a href={`tel:${detail.customer.phone.replace(/[^+\d]/g, "")}`} dir="ltr">{detail.customer.phone}</a></dd></div>
          <div><dt>{t.delivery}</dt><dd>{[detail.customer.address, detail.customer.district, detail.customer.province, detail.customer.postcode].filter(Boolean).join(", ")}</dd></div>
          {detail.customer.notes && <div><dt>{t.notes}</dt><dd>{detail.customer.notes}</dd></div>}
          <div><dt>{t.orderedAt}</dt><dd>{date(detail.createdAt, locale)}</dd></div>
          {detail.status === "paid" && <div><dt>{t.paidAt}</dt><dd>{date(detail.paidAt, locale)}</dd></div>}
          <div><dt>{t.attemptStatus}</dt><dd>{t.attemptStates[detail.attempt?.status ?? "none"]}</dd></div>
          <div><dt>{t.provider}</dt><dd>{detail.attempt?.provider ?? t.none}</dd></div>
          {detail.attempt?.providerPaymentId && <div><dt>{t.paymentId}</dt><dd dir="ltr">{detail.attempt.providerPaymentId}</dd></div>}
          {detail.status === "pending" && detail.attempt?.providerExpiresAtUnix && <div><dt>{t.providerExpiry}</dt><dd>{providerExpiry(detail.attempt.providerExpiresAtUnix, locale)}</dd></div>}
        </dl>
        <section className={styles.items} aria-label={t.items}><h3>{t.items}</h3>{detail.items.map((item) => <div className={styles.item} key={item.id}><span>{item.name} × {item.quantity}</span><strong>{amount(item.lineTotalMinor, locale)}</strong></div>)}<div className={styles.item}><span>{t.subtotal}</span><strong>{amount(detail.subtotalMinor, locale)}</strong></div><div className={styles.item}><span>{t.shipping}</span><strong>{detail.shippingMinor === 0 ? t.free : amount(detail.shippingMinor, locale)}</strong></div><div className={`${styles.item} ${styles.total}`}><span>{detail.status === "paid" ? t.total : t.orderTotal}</span><strong>{amount(detail.totalMinor, locale)}</strong></div></section>
      </div>}
    </CmsDialog>}
  </section>;
}

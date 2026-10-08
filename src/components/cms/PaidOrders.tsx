"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, RefreshCw, ShoppingBag, X } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import LoadingScreen from "@/components/loading/LoadingScreen";
import { CmsDialog } from "./CmsDialog";
import styles from "./PaidOrders.module.css";

type PaymentAttemptView = {
  id?: string;
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
  currency: string;
  createdAt: string;
  paidAt: string | null;
  expiresAt: string;
  initiationWindowElapsed: boolean;
  attempt: PaymentAttemptView | null;
  requiresPaymentReview: boolean;
};
type Group = "review" | "paid";
type PaidOrderList = { available: boolean; group?: Group; page: number; hasMore: boolean; orders: PaidOrderRow[] };
type FulfilmentStatus = "not-started" | "preparing" | "shipped" | "delivered";
type FulfilmentView = {
  revision: number;
  status: FulfilmentStatus;
  assignedTo: string;
  carrier: string;
  tracking: string;
  activity: { id: string; at: string; actor: string; from: FulfilmentStatus; to: FulfilmentStatus }[];
};
type PaidOrderDetail = {
  id: string;
  reference: string;
  status: "pending" | "paid";
  customer: Record<"name" | "email" | "phone" | "address" | "district" | "province" | "postcode" | "notes", string> & { country?: string };
  items: { id: string; name: string; quantity: number; lineTotalMinor: number }[];
  subtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
  currency: string;
  createdAt: string;
  paidAt: string | null;
  expiresAt: string;
  initiationWindowElapsed: boolean;
  attempt: PaymentAttemptView | null;
  requiresPaymentReview: boolean;
  additionalPaidAttempts: number;
  attemptHistory: { id: string; status: PaymentAttemptView["status"] | null; provider: string | null; providerPaymentId: string | null; amountMinor: number | null; currency: string | null; createdAt: string | null; role: "primary" | "secondary" | "active" | "other" }[];
  attemptHistoryHasMore: boolean;
  inventory: { state: "reserved" | "committed" | "released"; updatedAt: string } | null;
};

const copy = {
  en: {
    eyebrow: "CONFIRMED PAYMENTS", title: "Paid online orders", intro: "Payment provider confirmed these orders. Customer and delivery details are available to signed-in staff.", unavailable: "Live online orders appear here when shared MongoDB storage is configured.",
    readOnly: "Read-only view · Fulfilment and shipping status are not tracked here.", refresh: "Refresh", loading: "Loading paid orders…", empty: "No paid online orders yet.", error: "Paid orders could not be loaded. Please try again.", detailError: "Order details could not be loaded.", details: "Order details", close: "Close", paid: "Paid", review: "Payment needs review", reviewDetail: "Additional successful payment attempts were recorded. Review this order with the payment provider before fulfilment.", previous: "Previous", next: "Next", page: "Page", of: "of", customer: "Customer", contact: "Contact", delivery: "Delivery address", notes: "Customer notes", items: "Items", subtotal: "Subtotal", shipping: "Shipping", total: "Paid total", provider: "Payment provider", paymentId: "Provider payment ID", orderedAt: "Ordered", paidAt: "Paid at", free: "Free", none: "—",
    reviewEyebrow: "OPEN PAYMENT ORDERS", reviewTitle: "Needs review", reviewIntro: "These orders are not confirmed paid. Check their latest saved attempt and reconcile uncertain outcomes with the provider.", reviewLoading: "Loading open payment orders…", reviewEmpty: "No open payment orders.", reviewError: "Open payment orders could not be loaded.", pendingWarning: "Payment is not confirmed. Do not fulfil this order until the provider confirms it.", windowElapsed: "The local payment-start window has passed. This does not prove the provider payment failed; reconcile it before closing the order or releasing stock.", windowElapsedShort: "Start window ended", attemptStatus: "Last attempt", attemptStates: { creating: "Starting", ready: "Checkout ready", uncertain: "Outcome unknown", failed: "Attempt failed", paid: "Paid attempt needs reconciliation", none: "No attempt" }, providerExpiry: "Provider session expiry", orderTotal: "Order total",
    inventory: "Inventory allocation", inventoryStates: { reserved: "Reserved", committed: "Committed", released: "Released", missing: "Not recorded" }, inventoryUpdated: "Inventory updated", inventoryWarning: "Payment is confirmed, but inventory is not committed. Reconcile stock before fulfilment.", extraAttempts: "Additional successful payment attempts", attemptId: "Attempt ID", attemptCreated: "Attempt created", attemptMissing: "Saved attempt details are unavailable. Check this attempt with the provider.", checkProvider: "Check provider status", checkingProvider: "Checking provider…", checkPaid: "Provider confirms payment. The order details have been refreshed.", checkPending: "Provider has not confirmed payment. Keep this order under review.", checkFailed: "Provider confirms this attempt did not complete. The order details have been refreshed.", checkForbidden: "An owner account is required to check the provider.", checkError: "The provider status could not be confirmed. Review this payment in the provider dashboard and try again.",
    attemptHistory: "Payment attempts", attemptRoles: { primary: "Confirmed payment", secondary: "Additional charge", active: "Current attempt", other: "Earlier attempt" }, attemptAmount: "Attempt amount", historyMore: "Only the latest 50 attempts are shown. Check older attempts in the provider dashboard.",
    fulfilment: "Fulfilment", fulfilmentStates: { "not-started": "Not started", preparing: "Preparing", shipped: "Shipped", delivered: "Delivered" }, fulfilmentLoading: "Loading fulfilment…", fulfilmentError: "Fulfilment details could not be loaded. Refresh to try again.", fulfilmentBlocked: "Resolve payment or inventory review before updating fulfilment.", assignedTo: "Assigned staff", assigneeRequired: "Assign a staff member before moving this order forward.", carrier: "Carrier", tracking: "Tracking reference", trackingRequired: "Enter a carrier and tracking reference before marking this order shipped.", saveDetails: "Save details", startPreparing: "Start preparing", markShipped: "Mark shipped", markDelivered: "Mark delivered", fulfilmentSaving: "Saving…", fulfilmentSaved: "Fulfilment updated.", fulfilmentConflict: "Another staff member changed this order. The latest details have been reloaded; review and enter your changes again.", fulfilmentSaveError: "Fulfilment could not be updated. Review the latest order and try again.", fulfilmentForbidden: "Your staff account cannot update this order.", fulfilmentActivity: "Recent activity", assignmentUpdated: "Assignment or shipment details updated",
  },
  th: {
    eyebrow: "ยืนยันการชำระเงิน", title: "คำสั่งซื้อที่ชำระแล้ว", intro: "ผู้ให้บริการชำระเงินยืนยันรายการเหล่านี้แล้ว เจ้าหน้าที่ที่ลงชื่อเข้าใช้สามารถดูข้อมูลลูกค้าและที่อยู่จัดส่งได้", unavailable: "คำสั่งซื้อออนไลน์จริงจะแสดงที่นี่เมื่อเชื่อมต่อ MongoDB สำหรับ CMS แล้ว",
    readOnly: "ดูข้อมูลเท่านั้น · ระบบนี้ยังไม่ติดตามสถานะการจัดเตรียมและจัดส่ง", refresh: "โหลดใหม่", loading: "กำลังโหลดคำสั่งซื้อ…", empty: "ยังไม่มีคำสั่งซื้อที่ชำระเงินออนไลน์", error: "โหลดคำสั่งซื้อไม่ได้ โปรดลองอีกครั้ง", detailError: "โหลดรายละเอียดคำสั่งซื้อไม่ได้", details: "รายละเอียดคำสั่งซื้อ", close: "ปิด", paid: "ชำระแล้ว", review: "ต้องตรวจสอบการชำระเงิน", reviewDetail: "พบการชำระเงินสำเร็จเพิ่มเติม โปรดตรวจสอบกับผู้ให้บริการชำระเงินก่อนจัดส่ง", previous: "ก่อนหน้า", next: "ถัดไป", page: "หน้า", of: "จาก", customer: "ลูกค้า", contact: "ติดต่อ", delivery: "ที่อยู่จัดส่ง", notes: "หมายเหตุจากลูกค้า", items: "สินค้า", subtotal: "ค่าสินค้า", shipping: "ค่าจัดส่ง", total: "ยอดชำระ", provider: "ผู้ให้บริการชำระเงิน", paymentId: "รหัสรายการจากผู้ให้บริการ", orderedAt: "สั่งซื้อเมื่อ", paidAt: "ชำระเมื่อ", free: "ฟรี", none: "—",
    reviewEyebrow: "คำสั่งซื้อที่ยังเปิดอยู่", reviewTitle: "รอตรวจสอบ", reviewIntro: "คำสั่งซื้อเหล่านี้ยังไม่ได้รับการยืนยันว่าชำระแล้ว โปรดตรวจสอบความคืบหน้าของรายการล่าสุดกับผู้ให้บริการชำระเงิน", reviewLoading: "กำลังโหลดคำสั่งซื้อที่รอตรวจสอบ…", reviewEmpty: "ไม่มีคำสั่งซื้อที่รอตรวจสอบ", reviewError: "โหลดคำสั่งซื้อที่รอตรวจสอบไม่ได้", pendingWarning: "ยังไม่ยืนยันการชำระเงิน อย่าจัดส่งก่อนผู้ให้บริการยืนยัน", windowElapsed: "เลยช่วงเวลาเริ่มชำระเงินของระบบแล้ว แต่ไม่ได้หมายความว่าการชำระเงินกับผู้ให้บริการล้มเหลว โปรดตรวจสอบก่อนปิดคำสั่งซื้อหรือคืนสต็อก", windowElapsedShort: "เลยเวลาเริ่มชำระเงิน", attemptStatus: "รายการชำระเงินล่าสุด", attemptStates: { creating: "กำลังเริ่มชำระเงิน", ready: "พร้อมชำระเงิน", uncertain: "ยังไม่ทราบผล", failed: "รายการชำระเงินไม่สำเร็จ", paid: "รายการชำระแล้ว ต้องตรวจสอบ", none: "ยังไม่มีรายการชำระเงิน" }, providerExpiry: "เวลาสิ้นสุดเซสชันของผู้ให้บริการ", orderTotal: "ยอดคำสั่งซื้อ",
    inventory: "การจัดสรรสินค้า", inventoryStates: { reserved: "จองแล้ว", committed: "ตัดสต็อกแล้ว", released: "คืนสต็อกแล้ว", missing: "ไม่มีบันทึก" }, inventoryUpdated: "อัปเดตสต็อก", inventoryWarning: "ยืนยันการชำระเงินแล้ว แต่ยังไม่ได้ตัดสต็อก โปรดตรวจสอบก่อนจัดส่ง", extraAttempts: "รายการชำระเงินสำเร็จเพิ่มเติม", attemptId: "รหัสการชำระเงิน", attemptCreated: "เริ่มรายการเมื่อ", attemptMissing: "ไม่พบรายละเอียดรายการที่บันทึกไว้ โปรดตรวจสอบกับผู้ให้บริการ", checkProvider: "ตรวจสอบสถานะกับผู้ให้บริการ", checkingProvider: "กำลังตรวจสอบ…", checkPaid: "ผู้ให้บริการยืนยันการชำระเงินแล้ว ระบบโหลดรายละเอียดใหม่", checkPending: "ผู้ให้บริการยังไม่ยืนยันการชำระเงิน โปรดติดตามรายการนี้ต่อ", checkFailed: "ผู้ให้บริการยืนยันว่ารายการนี้ไม่สำเร็จ ระบบโหลดรายละเอียดใหม่", checkForbidden: "ต้องใช้บัญชีเจ้าของร้านเพื่อตรวจสอบกับผู้ให้บริการ", checkError: "ยังยืนยันสถานะกับผู้ให้บริการไม่ได้ โปรดตรวจสอบในระบบของผู้ให้บริการแล้วลองอีกครั้ง",
    attemptHistory: "ประวัติรายการชำระเงิน", attemptRoles: { primary: "รายการชำระที่ยืนยันแล้ว", secondary: "การเรียกเก็บเงินเพิ่มเติม", active: "รายการปัจจุบัน", other: "รายการก่อนหน้า" }, attemptAmount: "ยอดรายการ", historyMore: "แสดงรายการล่าสุดไม่เกิน 50 รายการ โปรดตรวจสอบรายการเก่ากว่าในระบบของผู้ให้บริการ",
    fulfilment: "การจัดเตรียมและจัดส่ง", fulfilmentStates: { "not-started": "ยังไม่เริ่ม", preparing: "กำลังจัดเตรียม", shipped: "จัดส่งแล้ว", delivered: "ส่งถึงแล้ว" }, fulfilmentLoading: "กำลังโหลดข้อมูลการจัดส่ง…", fulfilmentError: "โหลดข้อมูลการจัดส่งไม่ได้ โปรดโหลดใหม่", fulfilmentBlocked: "โปรดตรวจสอบการชำระเงินหรือสต็อกให้เรียบร้อยก่อนอัปเดตการจัดส่ง", assignedTo: "เจ้าหน้าที่รับผิดชอบ", assigneeRequired: "ระบุเจ้าหน้าที่รับผิดชอบก่อนดำเนินการต่อ", carrier: "บริษัทขนส่ง", tracking: "หมายเลขติดตาม", trackingRequired: "ระบุบริษัทขนส่งและหมายเลขติดตามก่อนยืนยันว่าจัดส่งแล้ว", saveDetails: "บันทึกรายละเอียด", startPreparing: "เริ่มจัดเตรียม", markShipped: "ยืนยันว่าจัดส่งแล้ว", markDelivered: "ยืนยันว่าถึงแล้ว", fulfilmentSaving: "กำลังบันทึก…", fulfilmentSaved: "อัปเดตการจัดส่งแล้ว", fulfilmentConflict: "มีเจ้าหน้าที่แก้ไขรายการนี้แล้ว ระบบโหลดข้อมูลล่าสุด โปรดตรวจสอบและกรอกการเปลี่ยนแปลงอีกครั้ง", fulfilmentSaveError: "ยังอัปเดตการจัดส่งไม่ได้ โปรดตรวจสอบข้อมูลล่าสุดแล้วลองอีกครั้ง", fulfilmentForbidden: "บัญชีเจ้าหน้าที่ของคุณแก้ไขรายการนี้ไม่ได้", fulfilmentActivity: "กิจกรรมล่าสุด", assignmentUpdated: "อัปเดตผู้รับผิดชอบหรือข้อมูลจัดส่ง",
  },
  ar: {
    eyebrow: "مدفوعات مؤكدة", title: "الطلبات المدفوعة عبر الإنترنت", intro: "أكد مزوّد الدفع هذه الطلبات. يمكن للموظفين المسجّلين الاطلاع على بيانات العملاء وعناوين التوصيل.", unavailable: "ستظهر الطلبات الفعلية هنا بعد إعداد تخزين MongoDB المشترك لنظام الإدارة.",
    readOnly: "للعرض فقط · لا تُتابَع حالة تجهيز الطلبات وشحنها هنا.", refresh: "تحديث", loading: "جارٍ تحميل الطلبات المدفوعة…", empty: "لا توجد طلبات مدفوعة عبر الإنترنت حتى الآن.", error: "تعذّر تحميل الطلبات المدفوعة. يُرجى المحاولة مجددًا.", detailError: "تعذّر تحميل تفاصيل الطلب.", details: "تفاصيل الطلب", close: "إغلاق", paid: "مدفوع", review: "يحتاج الدفع إلى مراجعة", reviewDetail: "سُجّلت محاولات دفع ناجحة إضافية. راجع الطلب مع مزوّد الدفع قبل تجهيزه.", previous: "السابق", next: "التالي", page: "الصفحة", of: "من", customer: "العميل", contact: "بيانات التواصل", delivery: "عنوان التوصيل", notes: "ملاحظات العميل", items: "المنتجات", subtotal: "قيمة المنتجات", shipping: "الشحن", total: "المبلغ المدفوع", provider: "مزوّد الدفع", paymentId: "رقم العملية لدى المزوّد", orderedAt: "تاريخ الطلب", paidAt: "تاريخ الدفع", free: "مجاني", none: "—",
    reviewEyebrow: "طلبات دفع مفتوحة", reviewTitle: "تحتاج إلى مراجعة", reviewIntro: "لم يتأكد دفع هذه الطلبات بعد. راجع آخر محاولة محفوظة وتحقق من الحالات غير المؤكدة لدى مزوّد الدفع.", reviewLoading: "جارٍ تحميل طلبات الدفع المفتوحة…", reviewEmpty: "لا توجد طلبات دفع مفتوحة.", reviewError: "تعذّر تحميل طلبات الدفع المفتوحة.", pendingWarning: "لم يُؤكَّد الدفع بعد. لا تُجهّز الطلب قبل تأكيد مزوّد الدفع.", windowElapsed: "انتهت مهلة بدء الدفع في النظام، لكن ذلك لا يثبت فشل الدفع لدى المزوّد. تحقق قبل إغلاق الطلب أو إعادة المخزون.", windowElapsedShort: "انتهت مهلة بدء الدفع", attemptStatus: "آخر محاولة دفع", attemptStates: { creating: "بدء الدفع جارٍ", ready: "صفحة الدفع جاهزة", uncertain: "النتيجة غير معروفة", failed: "فشلت المحاولة", paid: "محاولة مدفوعة تحتاج إلى مطابقة", none: "لا توجد محاولة" }, providerExpiry: "انتهاء جلسة المزوّد", orderTotal: "إجمالي الطلب",
    inventory: "تخصيص المخزون", inventoryStates: { reserved: "محجوز", committed: "خُصم من المخزون", released: "أُعيد إلى المخزون", missing: "لا يوجد سجل" }, inventoryUpdated: "تحديث المخزون", inventoryWarning: "تأكد الدفع، لكن المخزون لم يُخصم بعد. طابق حالة المخزون قبل تجهيز الطلب.", extraAttempts: "محاولات دفع ناجحة إضافية", attemptId: "معرّف المحاولة", attemptCreated: "تاريخ بدء المحاولة", attemptMissing: "تفاصيل المحاولة المحفوظة غير متاحة. تحقق من هذه المحاولة لدى مزوّد الدفع.", checkProvider: "التحقق من حالة الدفع لدى المزوّد", checkingProvider: "جارٍ التحقق…", checkPaid: "أكد المزوّد الدفع. حُدّثت تفاصيل الطلب.", checkPending: "لم يؤكد المزوّد الدفع بعد. أبقِ الطلب قيد المراجعة.", checkFailed: "أكد المزوّد أن هذه المحاولة لم تكتمل. حُدّثت تفاصيل الطلب.", checkForbidden: "يلزم حساب المالك للتحقق لدى المزوّد.", checkError: "تعذّر تأكيد الحالة لدى المزوّد. راجع الدفعة في لوحة المزوّد ثم حاول مجددًا.",
    attemptHistory: "سجل محاولات الدفع", attemptRoles: { primary: "الدفعة المؤكدة", secondary: "تحصيل إضافي", active: "المحاولة الحالية", other: "محاولة سابقة" }, attemptAmount: "مبلغ المحاولة", historyMore: "تُعرض أحدث 50 محاولة فقط. تحقق من المحاولات الأقدم في لوحة مزوّد الدفع.",
    fulfilment: "تجهيز الطلب وتسليمه", fulfilmentStates: { "not-started": "لم يبدأ", preparing: "قيد التجهيز", shipped: "شُحن", delivered: "سُلّم" }, fulfilmentLoading: "جارٍ تحميل حالة التجهيز…", fulfilmentError: "تعذّر تحميل حالة التجهيز. حدّث الصفحة للمحاولة مجددًا.", fulfilmentBlocked: "حلّ مراجعة الدفع أو المخزون قبل تحديث التجهيز.", assignedTo: "الموظف المسؤول", assigneeRequired: "عيّن موظفًا مسؤولًا قبل متابعة الطلب.", carrier: "شركة الشحن", tracking: "رقم التتبع", trackingRequired: "أدخل شركة الشحن ورقم التتبع قبل تأكيد الشحن.", saveDetails: "حفظ التفاصيل", startPreparing: "بدء التجهيز", markShipped: "تأكيد الشحن", markDelivered: "تأكيد التسليم", fulfilmentSaving: "جارٍ الحفظ…", fulfilmentSaved: "حُدّثت حالة التجهيز.", fulfilmentConflict: "غيّر موظف آخر هذا الطلب. حُمّلت أحدث التفاصيل؛ راجعها وأدخل تعديلاتك مجددًا.", fulfilmentSaveError: "تعذّر تحديث حالة التجهيز. راجع أحدث بيانات الطلب وحاول مجددًا.", fulfilmentForbidden: "لا يسمح حسابك بتحديث هذا الطلب.", fulfilmentActivity: "النشاط الأخير", assignmentUpdated: "تحديث المسؤول أو تفاصيل الشحن",
  },
} as const;

function amount(value: number, locale: Locale, currency: string) {
  try {
    const formatter = new Intl.NumberFormat(locale, { style: "currency", currency });
    const minorDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    return formatter.format(value / 10 ** minorDigits);
  } catch {
    return copy[locale].none;
  }
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

export function PaidOrders({ locale, canReconcile = false }: { locale: Locale; canReconcile?: boolean }) {
  return <div className={styles.groups}><PaymentOrderGroup locale={locale} group="review" canReconcile={canReconcile} /><PaymentOrderGroup locale={locale} group="paid" canReconcile={canReconcile} /></div>;
}

function PaymentOrderGroup({ locale, group, canReconcile }: { locale: Locale; group: Group; canReconcile: boolean }) {
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
  const [detailRevision, setDetailRevision] = useState(0);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [checkMessage, setCheckMessage] = useState<{ text: string; error: boolean } | null>(null);
  const checkController = useRef<AbortController | null>(null);
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
  }, [selectedId, detailRevision]);

  useEffect(() => () => checkController.current?.abort(), []);

  async function checkProviderStatus(attemptId: string) {
    if (!canReconcile || !selectedId || checkingId || checkController.current) return;
    const controller = new AbortController();
    checkController.current = controller;
    setCheckingId(attemptId);
    setCheckMessage(null);
    try {
      const response = await fetch(`/api/cms/payment-orders/${encodeURIComponent(selectedId)}/reconcile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      });
      const result = await response.json() as { status?: string; attemptStatus?: string };
      if (controller.signal.aborted) return;
      if (!response.ok) {
        setCheckMessage({ text: response.status === 403 ? t.checkForbidden : t.checkError, error: true });
        return;
      }
      if (result.status !== "paid" && result.status !== "pending") throw new Error("Invalid payment status");
      setCheckMessage({ text: result.status === "paid" ? t.checkPaid : result.attemptStatus === "failed" ? t.checkFailed : t.checkPending, error: false });
      setDetailRevision((value) => value + 1);
      setRevision((value) => value + 1);
    } catch {
      if (!controller.signal.aborted) setCheckMessage({ text: t.checkError, error: true });
    } finally {
      if (checkController.current === controller) checkController.current = null;
      if (!controller.signal.aborted) setCheckingId(null);
    }
  }

  function refresh() { setError(false); setRevision((value) => value + 1); }
  function changePage(next: number) { setError(false); setPage(next); }
  function open(id: string) { setDetail(null); setDetailError(false); setCheckMessage(null); setSelectedId(id); }
  function close() { checkController.current?.abort(); setCheckingId(null); setCheckMessage(null); setSelectedId(null); setDetail(null); setDetailError(false); }

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
        <span className={styles.rowMeta}><strong>{amount(order.totalMinor, locale, order.currency)}</strong><span>{date(group === "paid" ? order.paidAt : order.createdAt, locale)}</span>{group === "review" && order.initiationWindowElapsed && <span className={styles.elapsed}>{t.windowElapsedShort}</span>}</span>
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
        {checkMessage && <p className={checkMessage.error ? styles.error : styles.checkFeedback} role={checkMessage.error ? "alert" : "status"}>{checkMessage.text}</p>}
        {detail.status === "pending" && <p className={styles.reviewAlert}><AlertTriangle aria-hidden="true" />{t.pendingWarning}</p>}
        {detail.status === "pending" && detail.initiationWindowElapsed && <p className={styles.reviewAlert}><AlertTriangle aria-hidden="true" />{t.windowElapsed}</p>}
        {detail.requiresPaymentReview && <p className={styles.reviewAlert}><AlertTriangle aria-hidden="true" />{t.reviewDetail} ({detail.additionalPaidAttempts})</p>}
        {detail.status === "paid" && detail.inventory && detail.inventory.state !== "committed" && <p className={styles.reviewAlert}><AlertTriangle aria-hidden="true" />{t.inventoryWarning}</p>}
        <dl className={styles.facts}>
          <div><dt>{t.customer}</dt><dd>{detail.customer.name}</dd></div>
          <div><dt>{t.contact}</dt><dd><a href={`mailto:${detail.customer.email}`}>{detail.customer.email}</a><br /><a href={`tel:${detail.customer.phone.replace(/[^+\d]/g, "")}`} dir="ltr">{detail.customer.phone}</a></dd></div>
          <div><dt>{t.delivery}</dt><dd>{[detail.customer.address, detail.customer.district, detail.customer.province, detail.customer.postcode, detail.customer.country].filter(Boolean).join(", ")}</dd></div>
          {detail.customer.notes && <div><dt>{t.notes}</dt><dd>{detail.customer.notes}</dd></div>}
          <div><dt>{t.orderedAt}</dt><dd>{date(detail.createdAt, locale)}</dd></div>
          {detail.status === "paid" && <div><dt>{t.paidAt}</dt><dd>{date(detail.paidAt, locale)}</dd></div>}
          <div><dt>{t.attemptStatus}</dt><dd>{t.attemptStates[detail.attempt?.status ?? "none"]}</dd></div>
          <div><dt>{t.provider}</dt><dd>{detail.attempt?.provider ?? t.none}</dd></div>
          {detail.attempt?.providerPaymentId && <div><dt>{t.paymentId}</dt><dd dir="ltr">{detail.attempt.providerPaymentId}</dd></div>}
          {detail.status === "pending" && detail.attempt?.providerExpiresAtUnix && <div><dt>{t.providerExpiry}</dt><dd>{providerExpiry(detail.attempt.providerExpiresAtUnix, locale)}</dd></div>}
          <div><dt>{t.inventory}</dt><dd>{detail.inventory ? t.inventoryStates[detail.inventory.state] : t.inventoryStates.missing}</dd></div>
          {detail.inventory && <div><dt>{t.inventoryUpdated}</dt><dd>{date(detail.inventory.updatedAt, locale)}</dd></div>}
        </dl>
        {detail.attemptHistory?.length > 0 && <section className={styles.attempts} aria-label={t.attemptHistory}>
          <h3>{t.attemptHistory}</h3>
          {detail.attemptHistory.map((attempt) => <dl className={styles.attempt} key={attempt.id}>
            <div><dt>{t.attemptStatus}</dt><dd><span className={attempt.role === "secondary" ? styles.review : attempt.role === "primary" ? styles.paid : styles.attemptRole}>{t.attemptRoles[attempt.role]}</span> · {attempt.status === "paid" && attempt.role === "primary" ? t.paid : attempt.status === "paid" && attempt.role === "secondary" ? t.review : attempt.status ? t.attemptStates[attempt.status] : t.none}</dd></div>
            <div><dt>{t.attemptId}</dt><dd dir="ltr">{attempt.id}</dd></div>
            <div><dt>{t.provider}</dt><dd>{attempt.provider ?? t.none}</dd></div>
            <div><dt>{t.paymentId}</dt><dd dir="ltr">{attempt.providerPaymentId ?? t.none}</dd></div>
            {attempt.amountMinor !== null && attempt.currency && <div><dt>{t.attemptAmount}</dt><dd>{amount(attempt.amountMinor, locale, attempt.currency)}</dd></div>}
            {canReconcile && attempt.providerPaymentId && <div><dt>{t.checkProvider}</dt><dd><button className={styles.action} type="button" disabled={checkingId !== null} onClick={() => void checkProviderStatus(attempt.id)}>{checkingId === attempt.id ? t.checkingProvider : t.checkProvider}</button></dd></div>}
            {attempt.createdAt && <div><dt>{t.attemptCreated}</dt><dd>{date(attempt.createdAt, locale)}</dd></div>}
            {!attempt.status && <div className={styles.error}>{t.attemptMissing}</div>}
          </dl>)}
          {detail.attemptHistoryHasMore && <p className={styles.notice}>{t.historyMore}</p>}
        </section>}
        <section className={styles.items} aria-label={t.items}><h3>{t.items}</h3>{detail.items.map((item) => <div className={styles.item} key={item.id}><span>{item.name} × {item.quantity}</span><strong>{amount(item.lineTotalMinor, locale, detail.currency)}</strong></div>)}<div className={styles.item}><span>{t.subtotal}</span><strong>{amount(detail.subtotalMinor, locale, detail.currency)}</strong></div><div className={styles.item}><span>{t.shipping}</span><strong>{detail.shippingMinor === 0 ? t.free : amount(detail.shippingMinor, locale, detail.currency)}</strong></div><div className={`${styles.item} ${styles.total}`}><span>{detail.status === "paid" ? t.total : t.orderTotal}</span><strong>{amount(detail.totalMinor, locale, detail.currency)}</strong></div></section>
        {detail.status === "paid" && <FulfilmentPanel key={detail.id} locale={locale} orderId={detail.id} eligible={detail.inventory?.state === "committed" && !detail.requiresPaymentReview} onRefreshOrder={() => setDetailRevision((value) => value + 1)} />}
      </div>}
    </CmsDialog>}
  </section>;
}

function isFulfilmentView(value: unknown): value is FulfilmentView {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Number.isSafeInteger(record.revision) &&
    ["not-started", "preparing", "shipped", "delivered"].includes(String(record.status)) &&
    typeof record.assignedTo === "string" && typeof record.carrier === "string" &&
    typeof record.tracking === "string" && Array.isArray(record.activity);
}

function FulfilmentPanel({ locale, orderId, eligible, onRefreshOrder }: { locale: Locale; orderId: string; eligible: boolean; onRefreshOrder: () => void }) {
  const t = copy[locale];
  const [view, setView] = useState<FulfilmentView | null>(null);
  const [form, setForm] = useState({ assignedTo: "", carrier: "", tracking: "" });
  const [loadedRevision, setLoadedRevision] = useState(-1);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [revision, setRevision] = useState(0);
  const saveController = useRef<AbortController | null>(null);
  const loading = loadedRevision !== revision;

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/cms/payment-orders/${encodeURIComponent(orderId)}/fulfilment`, {
      cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    }).then(async (response) => {
      if (!response.ok) throw new Error("Fulfilment unavailable");
      return await response.json() as { fulfilment?: unknown };
    }).then((result) => {
      if (controller.signal.aborted) return;
      if (!isFulfilmentView(result.fulfilment)) throw new Error("Invalid fulfilment");
      const current = result.fulfilment;
      setView(current);
      setForm({ assignedTo: current.assignedTo, carrier: current.carrier, tracking: current.tracking });
      setLoadError(false);
    }).catch(() => { if (!controller.signal.aborted) setLoadError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoadedRevision(revision); });
    return () => controller.abort();
  }, [orderId, revision]);

  useEffect(() => () => saveController.current?.abort(), []);

  async function save(nextStatus: FulfilmentStatus) {
    if (!view || !eligible || loadError || loading || saving || saveController.current) return;
    const assignedTo = form.assignedTo.trim();
    const carrier = form.carrier.trim();
    const tracking = form.tracking.trim();
    if (nextStatus !== "not-started" && !assignedTo) { setMessage({ text: t.assigneeRequired, error: true }); return; }
    if (nextStatus === "shipped" && (!carrier || !tracking)) { setMessage({ text: t.trackingRequired, error: true }); return; }
    const controller = new AbortController();
    saveController.current = controller;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/cms/payment-orders/${encodeURIComponent(orderId)}/fulfilment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedRevision: view.revision, status: nextStatus, assignedTo, carrier, tracking }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      });
      const result = await response.json() as { code?: string; fulfilment?: unknown };
      if (controller.signal.aborted) return;
      if (response.status === 409) {
        setMessage({ text: result.code === "REVISION_CONFLICT" ? t.fulfilmentConflict : t.fulfilmentBlocked, error: true });
        setRevision((value) => value + 1);
        onRefreshOrder();
        return;
      }
      if (!response.ok) {
        setMessage({ text: response.status === 403 ? t.fulfilmentForbidden : t.fulfilmentSaveError, error: true });
        return;
      }
      if (!isFulfilmentView(result.fulfilment)) throw new Error("Invalid fulfilment response");
      setMessage({ text: t.fulfilmentSaved, error: false });
      setRevision((value) => value + 1);
    } catch {
      if (!controller.signal.aborted) setMessage({ text: t.fulfilmentSaveError, error: true });
    } finally {
      if (saveController.current === controller) saveController.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }

  const changed = view && (form.assignedTo.trim() !== view.assignedTo || form.carrier.trim() !== view.carrier || form.tracking.trim() !== view.tracking);
  const nextStatus = view?.status === "not-started" ? "preparing" : view?.status === "preparing" ? "shipped" : view?.status === "shipped" ? "delivered" : null;
  const nextLabel = nextStatus === "preparing" ? t.startPreparing : nextStatus === "shipped" ? t.markShipped : t.markDelivered;

  return <section className={styles.fulfilment} aria-label={t.fulfilment} aria-busy={loading || saving}>
    <div className={styles.fulfilmentHeader}><h3>{t.fulfilment}</h3>{view && <span className={styles.attemptRole}>{t.fulfilmentStates[view.status]}</span>}</div>
    {loading && <p className={styles.notice}>{t.fulfilmentLoading}</p>}
    {loadError && !loading && <p className={styles.error} role="alert">{t.fulfilmentError} <button className={styles.action} type="button" onClick={() => setRevision((value) => value + 1)}>{t.refresh}</button></p>}
    {view && !eligible && <p className={styles.reviewAlert}><AlertTriangle aria-hidden="true" />{t.fulfilmentBlocked}</p>}
    {message && <p className={message.error ? styles.error : styles.checkFeedback} role={message.error ? "alert" : "status"}>{message.text}</p>}
    {view && <>
      <div className={styles.fulfilmentFields}>
        <label>{t.assignedTo}<input value={form.assignedTo} maxLength={100} disabled={!eligible || loadError || loading || saving} onChange={(event) => { setForm((current) => ({ ...current, assignedTo: event.target.value })); setMessage(null); }} /></label>
        {view.status === "preparing" && <>
          <label>{t.carrier}<input value={form.carrier} maxLength={100} disabled={!eligible || loadError || loading || saving} onChange={(event) => { setForm((current) => ({ ...current, carrier: event.target.value })); setMessage(null); }} /></label>
          <label>{t.tracking}<input dir="ltr" value={form.tracking} maxLength={150} disabled={!eligible || loadError || loading || saving} onChange={(event) => { setForm((current) => ({ ...current, tracking: event.target.value })); setMessage(null); }} /></label>
        </>}
        {(view.status === "shipped" || view.status === "delivered") && <>
          <div><span>{t.carrier}</span><strong>{view.carrier}</strong></div>
          <div><span>{t.tracking}</span><strong dir="ltr">{view.tracking}</strong></div>
        </>}
      </div>
      {eligible && !loadError && <div className={styles.fulfilmentActions}>
        <button className={styles.action} type="button" disabled={!changed || loading || saving} onClick={() => void save(view.status)}>{saving ? t.fulfilmentSaving : t.saveDetails}</button>
        {nextStatus && <button className="button" type="button" disabled={loading || saving} onClick={() => void save(nextStatus)}>{saving ? t.fulfilmentSaving : nextLabel}</button>}
      </div>}
      {view.activity.length > 0 && <div className={styles.activity}><h4>{t.fulfilmentActivity}</h4><ol>{view.activity.slice(-5).reverse().map((entry) => <li key={entry.id}><strong>{entry.actor}</strong><span>{entry.from === entry.to ? t.assignmentUpdated : `${t.fulfilmentStates[entry.from]} → ${t.fulfilmentStates[entry.to]}`}</span><time dateTime={entry.at}>{date(entry.at, locale)}</time></li>)}</ol></div>}
    </>}
  </section>;
}

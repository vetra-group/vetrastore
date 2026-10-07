import type { Localized } from "@/lib/i18n";

const en = {
  kinds: { contact: "Message", wholesale: "Wholesale enquiry", order: "Product enquiry", newsletter: "Newsletter signup" },
  sharedKinds: { contact: "Enquiry", wholesale: "Wholesale enquiry", newsletter: "Newsletter", order: "Order enquiry" },
  payment: { enquiry: "Order enquiry · no payment", "demo-paid": "Simulated success · no real charge", "demo-failed": "Simulated decline · no real charge", "demo-refunded": "Simulated refund · no real funds moved" },
  greeting: "Notification preview for", reference: "Reference", subtotal: "Product subtotal", excluded: "shipping not included", localNote: "Saved in this browser only. No email sent or real payment taken.", staff: "Staff (preview)",
};
export const notificationCopy: Localized<typeof en> = {
  en,
  ar: {
    kinds: { contact: "رسالة", wholesale: "استفسار عن البيع بالجملة", order: "استفسار عن المنتجات", newsletter: "اشتراك في النشرة البريدية" },
    sharedKinds: { contact: "استفسار", wholesale: "استفسار عن البيع بالجملة", newsletter: "النشرة البريدية", order: "استفسار عن طلب" },
    payment: { enquiry: "استفسار عن طلب · دون دفع", "demo-paid": "نجاح بالمحاكاة · دون تحصيل مبلغ فعلي", "demo-failed": "رفض بالمحاكاة · دون تحصيل مبلغ فعلي", "demo-refunded": "رد مبلغ بالمحاكاة · دون تحويل أموال فعلية" },
    greeting: "معاينة إشعار إلى", reference: "رقم المرجع", subtotal: "المجموع الفرعي للمنتجات", excluded: "لا يشمل الشحن", localNote: "حُفظ في هذا المتصفح فقط. لم تُرسل رسالة بريد ولم تُحصّل أي دفعة فعلية.", staff: "الفريق (معاينة)",
  },
  th: {
    kinds: { contact: "ข้อความ", wholesale: "สอบถามขายส่ง", order: "รายการสินค้า", newsletter: "สมัครข่าวสาร" },
    sharedKinds: { contact: "คำสอบถาม", wholesale: "สอบถามขายส่ง", newsletter: "สมัครข่าวสาร", order: "คำสอบถามสั่งซื้อ" },
    payment: { enquiry: "คำสอบถามสินค้า · ยังไม่มีการชำระเงิน", "demo-paid": "จำลองชำระสำเร็จ · ไม่มีการเรียกเก็บเงินจริง", "demo-failed": "จำลองชำระไม่สำเร็จ · ไม่มีการเรียกเก็บเงินจริง", "demo-refunded": "จำลองคืนเงินสำเร็จ · ไม่มีการคืนเงินจริง" },
    greeting: "ตัวอย่างการแจ้งเตือนสำหรับ", reference: "เลขอ้างอิง", subtotal: "ยอดสินค้า", excluded: "ยังไม่รวมค่าจัดส่ง", localNote: "บันทึกในเบราว์เซอร์เท่านั้น ยังไม่มีการส่งอีเมลหรือรับชำระเงินจริง", staff: "ทีมงาน (ตัวอย่าง)",
  },
};

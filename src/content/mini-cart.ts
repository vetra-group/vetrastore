import { miniCartArabic } from "@/content/customer-ar";
import type { Localized } from "@/lib/i18n";

const en = {
  title: "Your bag",
  shipping: "Shipping included for the selected market",
  confirmOrder: "Confirm order",
  close: "Close bag",
  undo: "Undo",
  removed: "Item removed from your bag.",
  restored: "Item restored to your bag.",
  unavailable: "This item is no longer available to restore.",
  added: "Added to your bag",
  updated: "Quantity updated",
  limit: "Maximum available quantity reached.",
};

export const miniCartCopy: Localized<typeof en> = {
  ar: miniCartArabic,
  en,
  th: {
    title: "ตะกร้าของคุณ",
    shipping: "รวมค่าจัดส่งตามพื้นที่ที่เลือก",
    confirmOrder: "ยืนยันคำสั่งซื้อ",
    close: "ปิดตะกร้า",
    undo: "เลิกทำ",
    removed: "นำสินค้าออกจากตะกร้าแล้ว",
    restored: "คืนสินค้าในตะกร้าแล้ว",
    unavailable: "ไม่สามารถคืนสินค้านี้ได้ เนื่องจากไม่มีสินค้าพร้อมจำหน่าย",
    added: "เพิ่มลงตะกร้าแล้ว",
    updated: "อัปเดตจำนวนแล้ว",
    limit: "ถึงจำนวนสูงสุดที่เพิ่มได้แล้ว",
  },
};

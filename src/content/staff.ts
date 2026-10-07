import { staffArabic } from "@/content/customer-ar";
import type { Localized } from "@/lib/i18n";
import type { DemoChecklistKey, DemoKind, DemoPaymentOutcome, DemoStatus } from "@/lib/demo-types";

type StaffCopy = {
  title: string;
  description: string;
  eyebrow: string;
  intro: string;
  demoTitle: string;
  demoNote: string;
  back: string;
  sections: { inbox: string; outbox: string; launch: string };
  totals: { all: string; open: string; orders: string; subscribers: string };
  search: string;
  searchPlaceholder: string;
  filter: string;
  all: string;
  kinds: Record<DemoKind, string>;
  statuses: Record<DemoStatus, string>;
  emptyTitle: string;
  emptyBody: string;
  seed: string;
  samplesNote: string;
  noMatches: string;
  clear: string;
  details: string;
  selectRecord: string;
  received: string;
  status: string;
  customer: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  items: string;
  total: string;
  address: string;
  payment: string;
  paymentStates: Record<DemoPaymentOutcome, string>;
  paymentNote: string;
  notes: string;
  notesPlaceholder: string;
  saveNotes: string;
  saved: string;
  closeDetails: string;
  outboxTitle: string;
  outboxNote: string;
  outboxEmpty: string;
  outboxDestinations: Record<"staff" | "customer", string>;
  recipient: string;
  subject: string;
  body: string;
  mockOnly: string;
  launchTitle: string;
  launchNote: string;
  confirmed: string;
  needsConfirmation: string;
  checklist: Record<DemoChecklistKey, { title: string; description: string }>;
  checklistSaved: string;
  loading: string;
  storageError: string;
  resetTitle: string;
  resetNote: string;
  resetTrigger: string;
  resetConfirmTitle: string;
  resetConfirm: string;
  resetCancel: string;
  resetSuccess: string;
  resetError: string;
};

export const staffCopy: Localized<StaffCopy> = {
  ar: staffArabic,
  th: {
    title: "พื้นที่ทำงานตัวอย่าง",
    description: "ทดลองจัดการคำถาม รายการสั่งซื้อ และข้อมูลก่อนเปิดร้านในโหมดตัวอย่างของ VETRA STORE",
    eyebrow: "VETRA STORE · โหมดตัวอย่าง",
    intro: "ดูรายการรับเข้าและติดตามการดูแลลูกค้าในต้นแบบนี้",
    demoTitle: "ข้อมูลตัวอย่างในเบราว์เซอร์นี้",
    demoNote: "ข้อมูลเก็บในเบราว์เซอร์นี้ ไม่มีบัญชีพนักงาน การส่งข้อความ หรือการชำระเงินจริง ใช้ข้อมูลสมมติเท่านั้น",
    back: "กลับไปหน้าร้าน",
    sections: { inbox: "รายการรับเข้า", outbox: "อีเมลตัวอย่าง", launch: "เตรียมเปิดร้าน" },
    totals: { all: "รายการทั้งหมด", open: "รอดำเนินการ", orders: "รายการสั่งซื้อ", subscribers: "ผู้รับข่าวสาร" },
    search: "ค้นหารายการ",
    searchPlaceholder: "ชื่อ อีเมล เลขอ้างอิง ธุรกิจ หรือผู้รับผิดชอบ",
    filter: "ประเภทรายการ",
    all: "ทั้งหมด",
    kinds: { contact: "คำถามทั่วไป", wholesale: "ขายส่ง", order: "สั่งซื้อ", newsletter: "รับข่าวสาร" },
    statuses: { new: "ใหม่", reviewing: "กำลังดูแล", completed: "เสร็จสิ้น" },
    emptyTitle: "ยังไม่มีรายการรับเข้า",
    emptyBody: "ลองส่งแบบฟอร์มจากหน้าร้านในโหมดตัวอย่าง หรือเพิ่มชุดข้อมูลตัวอย่างเพื่อดูการทำงาน",
    seed: "เพิ่มข้อมูลตัวอย่าง",
    samplesNote: "ใช้ข้อมูลสมมติ ไม่มีการส่งอีเมลหรือสร้างคำสั่งซื้อจริง",
    noMatches: "ไม่พบรายการที่ตรงกับการค้นหา",
    clear: "ล้างการค้นหา",
    details: "รายละเอียดรายการ",
    selectRecord: "เลือกรายการเพื่อดูรายละเอียดและบันทึกการติดตาม",
    received: "รับเมื่อ",
    status: "สถานะการดูแล",
    customer: "ชื่อ",
    email: "อีเมล",
    phone: "โทรศัพท์",
    company: "บริษัท / ร้านค้า",
    message: "ข้อความ",
    items: "สินค้า",
    total: "ยอดสินค้า",
    address: "ที่อยู่จัดส่ง",
    payment: "การชำระเงินตัวอย่าง",
    paymentStates: { enquiry: "รอยืนยันกับทีมงาน", "demo-paid": "สำเร็จในต้นแบบ · ไม่มีการเรียกเก็บเงิน", "demo-failed": "ไม่สำเร็จในต้นแบบ · ไม่มีการเรียกเก็บเงิน", "demo-refunded": "คืนเงินจำลองแล้ว · ไม่มีการคืนเงินจริง" },
    paymentNote: "เป็นการแสดงขั้นตอนเท่านั้น ไม่มีการเรียกเก็บเงิน ทีมงานต้องยืนยันสินค้า ค่าจัดส่ง และการชำระเงินจริงก่อนรับคำสั่งซื้อ",
    notes: "บันทึกการติดตาม",
    notesPlaceholder: "เพิ่มบันทึกตัวอย่างสำหรับทีมงาน",
    saveNotes: "บันทึกข้อความ",
    saved: "บันทึกในเบราว์เซอร์แล้ว",
    closeDetails: "ปิดรายละเอียด",
    outboxTitle: "ตัวอย่างอีเมลแจ้งเตือน",
    outboxNote: "แสดงข้อความที่จะใช้แจ้งทีมงานและลูกค้า ระบบนี้ยังไม่ส่งอีเมลจริง",
    outboxEmpty: "เมื่อส่งแบบฟอร์มหรือสร้างรายการตัวอย่าง อีเมลตัวอย่างจะแสดงที่นี่",
    outboxDestinations: { staff: "ตัวอย่างสำหรับทีมงาน", customer: "ตัวอย่างสำหรับลูกค้า" },
    recipient: "ผู้รับ",
    subject: "หัวข้อ",
    body: "ข้อความ",
    mockOnly: "ตัวอย่าง · ยังไม่ได้ส่ง",
    launchTitle: "ข้อมูลที่ต้องยืนยันก่อนเปิดร้าน",
    launchNote: "ใช้รายการนี้ติดตามความพร้อม การเปลี่ยนสถานะมีผลเฉพาะต้นแบบนี้และไม่เปลี่ยนข้อมูลที่หน้าร้าน",
    confirmed: "ตรวจแล้วในต้นแบบ",
    needsConfirmation: "รอยืนยัน",
    checklist: {
      shipping: { title: "ค่าจัดส่งและพื้นที่บริการ", description: "ยืนยันราคา เงื่อนไขจัดส่ง และระยะเวลาที่แจ้งลูกค้าได้จริง" },
      returns: { title: "การคืนสินค้า", description: "ยืนยันเงื่อนไขสินค้าเสียหาย การคืนสินค้า และช่องทางแจ้งปัญหา" },
      stock: { title: "สต็อกและข้อมูลล็อตสินค้า", description: "ตรวจสอบจำนวนสินค้า รูปฉลาก และวันควรบริโภคก่อนของล็อตปัจจุบัน" },
      wholesale: { title: "เงื่อนไขขายส่ง", description: "ยืนยันจำนวนขั้นต่ำ ราคา และวิธีเสนอราคาสำหรับร้านค้าและธุรกิจ" },
      contact: { title: "ข้อมูลติดต่อร้าน", description: "ยืนยันอีเมล โทรศัพท์ และข้อมูลธุรกิจที่จะเผยแพร่" },
      domain: { title: "โดเมนและบริการที่เชื่อมต่อ", description: "ยืนยันโดเมนจริง ฐานข้อมูล อีเมล และการชำระเงิน พร้อมทดสอบระบบก่อนเปิดร้าน" },
      payment: { title: "ระบบชำระเงินจริง", description: "เชื่อมผู้ให้บริการชำระเงิน ตรวจสอบการยืนยันยอด การชำระเงินไม่สำเร็จ และการคืนเงิน" },
      data: { title: "การจัดเก็บข้อมูลและสิทธิ์พนักงาน", description: "เชื่อมฐานข้อมูลจริง เพิ่มบัญชีพนักงานและสิทธิ์เข้าถึง พร้อมกำหนดวิธีสำรองและลบข้อมูล" },
    },
    checklistSaved: "อัปเดตสถานะในต้นแบบแล้ว",
    loading: "กำลังอ่านข้อมูลตัวอย่าง…",
    storageError: "บันทึกไม่สำเร็จ เบราว์เซอร์อาจไม่อนุญาตให้เก็บข้อมูล กรุณาลองอีกครั้ง ข้อความที่กรอกยังอยู่",
    resetTitle: "เริ่มต้นข้อมูลตัวอย่างใหม่",
    resetNote: "ย้ายรายการและอีเมลตัวอย่างไปถังขยะ กู้คืนได้ใน CMS ภายใน 30 วัน แล้วเริ่มสถานะรายการเตรียมเปิดร้านใหม่",
    resetTrigger: "ล้างข้อมูลตัวอย่าง",
    resetConfirmTitle: "ยืนยันการล้างข้อมูลตัวอย่าง?",
    resetConfirm: "ยืนยันล้างข้อมูล",
    resetCancel: "ยกเลิก",
    resetSuccess: "ย้ายรายการและอีเมลตัวอย่างไปถังขยะแล้ว กู้คืนได้ใน CMS ภายใน 30 วัน รายการเตรียมเปิดร้านกลับเป็นรอยืนยัน",
    resetError: "ล้างข้อมูลไม่สำเร็จ ข้อมูลตัวอย่างยังอยู่ กรุณาลองอีกครั้ง",
  },
  en: {
    title: "Staff workspace preview",
    description: "Try the VETRA STORE workflow for enquiries, orders and launch preparation in demo mode.",
    eyebrow: "VETRA STORE · DEMO WORKSPACE",
    intro: "Review requests and customer follow-ups in this preview.",
    demoTitle: "Demo data in this browser",
    demoNote: "Data stays in this browser. No staff sign-in, real messages or payments. Use fictional details only.",
    back: "Back to the store",
    sections: { inbox: "Inbox", outbox: "Mock emails", launch: "Launch preparation" },
    totals: { all: "All requests", open: "Needs follow-up", orders: "Order requests", subscribers: "Subscribers" },
    search: "Search requests",
    searchPlaceholder: "Name, email, reference, business or assignee",
    filter: "Request type",
    all: "All types",
    kinds: { contact: "Enquiry", wholesale: "Wholesale", order: "Order", newsletter: "Newsletter" },
    statuses: { new: "New", reviewing: "In progress", completed: "Completed" },
    emptyTitle: "No requests yet",
    emptyBody: "Try a storefront form in demo mode, or add sample data to explore the workflow.",
    seed: "Add sample data",
    samplesNote: "Sample data is fictional. No emails or real orders are sent.",
    noMatches: "No requests match your search",
    clear: "Clear search",
    details: "Request details",
    selectRecord: "Choose a request to see its details and follow-up notes.",
    received: "Received",
    status: "Follow-up status",
    customer: "Name",
    email: "Email",
    phone: "Phone",
    company: "Company / store",
    message: "Message",
    items: "Products",
    total: "Product subtotal",
    address: "Delivery address",
    payment: "Mock payment",
    paymentStates: { enquiry: "Awaiting team confirmation", "demo-paid": "Demo success · no charge", "demo-failed": "Demo failure · no charge", "demo-refunded": "Simulated refund · no real funds moved" },
    paymentNote: "This shows the workflow only. No money is charged. Availability, shipping and real payment must be confirmed before accepting an order.",
    notes: "Follow-up notes",
    notesPlaceholder: "Add a sample note for the team",
    saveNotes: "Save notes",
    saved: "Saved in this browser",
    closeDetails: "Close details",
    outboxTitle: "Notification email previews",
    outboxNote: "Preview messages for the team and customer. This system does not send real email.",
    outboxEmpty: "Submit a form or add sample requests to see the mock emails here.",
    outboxDestinations: { staff: "Staff preview", customer: "Customer preview" },
    recipient: "To",
    subject: "Subject",
    body: "Message",
    mockOnly: "Demo · not sent",
    launchTitle: "Details to confirm before launch",
    launchNote: "Use this checklist to track readiness. Status changes affect this prototype only and do not update the storefront.",
    confirmed: "Reviewed in demo",
    needsConfirmation: "Needs confirmation",
    checklist: {
      shipping: { title: "Shipping rates and coverage", description: "Confirm actual prices, delivery conditions and realistic delivery estimates." },
      returns: { title: "Returns and damaged products", description: "Confirm return conditions and how customers can report a problem." },
      stock: { title: "Stock and current product batch", description: "Check available quantities, label photos and the current batch's best-before dates." },
      wholesale: { title: "Wholesale terms", description: "Confirm minimum quantities, pricing and the quotation process for businesses." },
      contact: { title: "Store contact details", description: "Verify the email address, telephone number and business information to publish." },
      domain: { title: "Domain and connected services", description: "Confirm the real domain, database, email and payment setup, then test the full journey." },
      payment: { title: "Live payments", description: "Connect the payment provider and verify confirmations, failed payments and refunds." },
      data: { title: "Data storage and staff access", description: "Connect the real database, add authenticated staff permissions and define backup and deletion processes." },
    },
    checklistSaved: "Prototype checklist updated",
    loading: "Loading demo data…",
    storageError: "Could not save. Browser storage may be unavailable. Please try again; your notes have been kept.",
    resetTitle: "Start a fresh demo",
    resetNote: "Move requests and email previews to Trash, where they can be restored in the CMS for 30 days, and reset the launch checklist.",
    resetTrigger: "Reset demo data",
    resetConfirmTitle: "Reset the demo data?",
    resetConfirm: "Confirm reset",
    resetCancel: "Cancel",
    resetSuccess: "Requests and email previews moved to Trash. Restore them in the CMS within 30 days. The launch checklist has been reset.",
    resetError: "Could not reset. Your demo data is still here. Please try again.",
  },
};

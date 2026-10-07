import type { Localized } from "@/lib/i18n";

export const loadingCopy: Localized<{
  pageTitle: string; pageDetail: string; adminTitle: string; adminDetail: string;
  panelTitle: string; panelDetail: string; navigation: string;
}> = {
  en: { pageTitle: "Just a moment", pageDetail: "Your page is loading.", adminTitle: "Opening your workspace", adminDetail: "Loading your content and tools.", panelTitle: "Loading content", panelDetail: "Just a moment, please.", navigation: "Loading the next page…" },
  ar: { pageTitle: "لحظة من فضلك", pageDetail: "جارٍ تحميل الصفحة.", adminTitle: "جارٍ فتح مساحة العمل", adminDetail: "جارٍ تحميل المحتوى والأدوات.", panelTitle: "جارٍ تحميل المحتوى", panelDetail: "يُرجى الانتظار لحظة.", navigation: "جارٍ تحميل الصفحة التالية…" },
  th: { pageTitle: "รอสักครู่", pageDetail: "กำลังโหลดหน้าเว็บไซต์ให้คุณ", adminTitle: "กำลังเปิดพื้นที่ทำงาน", adminDetail: "กำลังโหลดเนื้อหาและเครื่องมือของคุณ", panelTitle: "กำลังโหลดเนื้อหา", panelDetail: "กรุณารอสักครู่", navigation: "กำลังโหลดหน้าถัดไป…" },
};

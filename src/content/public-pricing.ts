import type { Localized } from "@/lib/i18n";

export const publicPricingCopy: Localized<{
  select: string;
  selectedTotal: string;
  unavailable: string;
  perJar: string;
  approximately: string;
  usdChargeNote: string;
  freeShippingThailand: string;
  jars: (quantity: number) => string;
}> = {
  en: {
    select: "Choose a quantity",
    selectedTotal: "Selected total",
    unavailable: "Contact us for pricing",
    perJar: "per jar",
    approximately: "about",
    usdChargeNote: "USD amounts are approximate. When payment is available, the charge is in Thai baht (THB).",
    freeShippingThailand: "Free shipping in Thailand",
    jars: (quantity) => `${quantity} ${quantity === 1 ? "jar" : "jars"}`,
  },
  ar: {
    select: "اختر الكمية",
    selectedTotal: "إجمالي الكمية المختارة",
    unavailable: "تواصل معنا لمعرفة السعر",
    perJar: "للعبوة الواحدة",
    approximately: "نحو",
    usdChargeNote: "المبالغ المعروضة بالدولار الأمريكي تقديرية. وعند إتاحة الدفع، تُحصّل قيمة الطلب بالبات التايلاندي (THB).",
    freeShippingThailand: "شحن مجاني داخل تايلاند",
    jars: (quantity) => quantity === 1 ? "عبوة واحدة" : quantity === 2 ? "عبوتان" : `${new Intl.NumberFormat("ar").format(quantity)} ${quantity >= 3 && quantity <= 10 ? "عبوات" : "عبوة"}`,
  },
  th: {
    select: "เลือกจำนวนขวด",
    selectedTotal: "ราคารวมที่เลือก",
    unavailable: "สอบถามราคา",
    perJar: "ต่อขวด",
    approximately: "ประมาณ",
    usdChargeNote: "ราคาแสดงเป็นเงินบาท",
    freeShippingThailand: "จัดส่งฟรีในประเทศไทย",
    jars: (quantity) => `${new Intl.NumberFormat("th").format(quantity)} ขวด`,
  },
};

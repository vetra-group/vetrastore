import type { Localized } from "@/lib/i18n";

export const publicPricingCopy: Localized<{
  select: string;
  selectedTotal: string;
  unavailable: string;
  perJar: string;
  approximately: string;
  usdChargeNote: string;
  freeShippingThailand: string;
  freeShippingWorldwide: string;
  jars: (quantity: number) => string;
}> = {
  en: {
    select: "Choose a quantity",
    selectedTotal: "Selected total",
    unavailable: "Contact us for pricing",
    perJar: "per jar",
    approximately: "about",
    usdChargeNote: "Other currency amounts are estimates. The order price is in Thai baht (THB).",
    freeShippingThailand: "Free shipping in Thailand",
    freeShippingWorldwide: "Worldwide shipping included · charged in THB",
    jars: (quantity) => `${quantity} ${quantity === 1 ? "jar" : "jars"}`,
  },
  ar: {
    select: "اختر الكمية",
    selectedTotal: "إجمالي الكمية المختارة",
    unavailable: "تواصل معنا لمعرفة السعر",
    perJar: "للعبوة الواحدة",
    approximately: "نحو",
    usdChargeNote: "المبالغ بعملات أخرى تقديرية. سعر الطلب بالبات التايلاندي.",
    freeShippingThailand: "شحن مجاني داخل تايلاند",
    freeShippingWorldwide: "الشحن إلى جميع أنحاء العالم مشمول · يُحصّل المبلغ بالبات التايلاندي",
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
    freeShippingWorldwide: "รวมค่าจัดส่งทั่วโลก · ชำระเป็นเงินบาท",
    jars: (quantity) => `${new Intl.NumberFormat("th").format(quantity)} ขวด`,
  },
};

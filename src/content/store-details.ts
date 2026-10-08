import { formatPrice, honey } from "@/lib/catalog";
import { publicQuote } from "@/lib/public-pricing";
import { publicPricingCopy } from "./public-pricing";
import type { Locale, Localized } from "@/lib/i18n";

type SellingDetail = { title: string; summary: string; description: string };
type SellingDetails = {
  stock: SellingDetail;
  shipping: SellingDetail;
  returns: SellingDetail;
  wholesale: SellingDetail;
  batch: SellingDetail;
};

// Confirm these terms with the store owner before replacing the pending copy.
// Product price and weight come from the catalog so there is one source of truth.
export const storeDetails = {
  ar: {
    stock: {
      title: "توافر المنتج",
      summary: "تأكّد من الكمية المتاحة مع فريقنا",
      description: "أخبرنا باسم المنتج والكمية التي تحتاجها. سيؤكد فريقنا توافرها قبل متابعة الطلب.",
    },
    shipping: {
      title: "التوصيل",
      summary: "الشحن إلى وجهتك مشمول في سعر الباقة المختارة",
      description: "تختلف أسعار الباقات داخل تايلاند عن الأسعار الدولية. يشمل كل سعر الشحن إلى وجهته المحددة. أرسل بلد الوجهة والمدينة والرمز البريدي إن وُجد ليؤكد فريقنا توافر المنتج وموعد التوصيل.",
    },
    returns: {
      title: "مشكلات المنتج",
      summary: "استفسر عن الشروط قبل الطلب",
      description: "لم تُؤكَّد بعد شروط الإرجاع واسترداد المبلغ. إذا واجهت مشكلة، فاحتفظ بالعبوة ورقم التشغيلة وإثبات الشراء، وأرسل التفاصيل إلى فريقنا.",
    },
    wholesale: {
      title: "الجملة وقطاع الأعمال",
      summary: "أخبرنا بالكمية واحتياجات نشاطك",
      description: "يمكن للمتاجر والمقاهي والشركات الاستفسار عن الكميات الكبيرة. يجب تأكيد أسعار الجملة والحد الأدنى للطلب والشروط مع فريقنا.",
    },
    batch: {
      title: "الملصقات وتفاصيل التشغيلة",
      summary: "تحقّق من المنتج الذي تستلمه",
      description: "صور الملصقات مخصّصة للتعريف بالمنتج. لا تؤكد التواريخ وأرقام التشغيلات الظاهرة في الصور تفاصيل التشغيلة التي ستُرسل إليك. إذا كنت تحتاج إلى هذه المعلومات، فاستفسر عن التشغيلة المتاحة حاليًا قبل الطلب.",
    },
  },
  th: {
    stock: {
      title: "สินค้าพร้อมจำหน่าย",
      summary: "ยืนยันจำนวนกับทีมงาน",
      description:
        "แจ้งชื่อสินค้าและจำนวนที่สนใจ ทีมงานจะยืนยันสินค้าที่พร้อมจำหน่ายก่อนดำเนินการสั่งซื้อ",
    },
    shipping: {
      title: "การจัดส่ง",
      summary: "ราคาชุดสินค้ารวมค่าจัดส่งตามพื้นที่ที่เลือก",
      description:
        "ราคาไทยและราคาต่างประเทศเป็นคนละชุด แต่ละชุดรวมค่าจัดส่งไปยังพื้นที่ที่เลือกแล้ว กรุณาแจ้งประเทศหรือจังหวัดและรหัสไปรษณีย์เพื่อให้ทีมงานยืนยันสินค้าและระยะเวลาจัดส่ง",
    },
    returns: {
      title: "ปัญหาเกี่ยวกับสินค้า",
      summary: "สอบถามเงื่อนไขก่อนสั่งซื้อ",
      description:
        "เงื่อนไขการคืนสินค้าและคืนเงินยังรอการยืนยัน หากพบปัญหา โปรดเก็บบรรจุภัณฑ์ เลขล็อต และหลักฐานการสั่งซื้อ แล้วแจ้งรายละเอียดให้ทีมงานทราบ",
    },
    wholesale: {
      title: "ขายส่งและธุรกิจ",
      summary: "แจ้งจำนวนและลักษณะธุรกิจ",
      description:
        "สอบถามได้ทั้งร้านค้า คาเฟ่ และธุรกิจที่ต้องการซื้อจำนวนมาก ราคา จำนวนสั่งซื้อขั้นต่ำ และเงื่อนไขขายส่งต้องได้รับการยืนยันจากทีมงาน",
    },
    batch: {
      title: "ฉลากและข้อมูลล็อต",
      summary: "ตรวจสอบบนสินค้าที่ได้รับ",
      description:
        "ภาพฉลากใช้ประกอบข้อมูลสินค้า วันที่และเลขล็อตในภาพไม่ใช่การยืนยันล็อตที่จะจัดส่ง หากต้องการข้อมูลล็อตปัจจุบัน กรุณาสอบถามก่อนสั่งซื้อ",
    },
  },
  en: {
    stock: {
      title: "Product availability",
      summary: "Confirm the quantity with our team",
      description:
        "Share the product name and quantity you need. Our team will confirm availability before the order proceeds.",
    },
    shipping: {
      title: "Delivery",
      summary: "Shipping to your selected destination is included",
      description:
        "Thailand and international bundles have separate prices. Each includes shipping to its selected market. Share the destination country and city, with a postal code if applicable, so our team can confirm availability and delivery timing.",
    },
    returns: {
      title: "Product concerns",
      summary: "Ask about the terms before ordering",
      description:
        "Return and refund terms are awaiting confirmation. If there is a problem, keep the packaging, lot number, and proof of purchase, and share the details with our team.",
    },
    wholesale: {
      title: "Wholesale & business",
      summary: "Tell us the quantity and your business needs",
      description:
        "Shops, cafés, and businesses can ask about larger quantities. Wholesale prices, minimum order quantities, and terms must be confirmed by our team.",
    },
    batch: {
      title: "Labels & batch details",
      summary: "Check the product you receive",
      description:
        "Label photos illustrate the product. Dates and lot numbers in a photo do not confirm the batch that will be dispatched. Ask about the current batch before ordering if you need these details.",
    },
  },
} satisfies Localized<SellingDetails>;

export function honeySellingSummary(locale: Locale) {
  const quote = publicQuote(honey, 1, "TH");
  const price = quote ? formatPrice(quote.total, locale, quote.currency) : publicPricingCopy[locale].unavailable;
  if (locale === "ar") {
    return `${honey.name.ar} من ${honey.brand}، بوزن ${honey.weight} غرامًا، يبدأ سعر العبوة للتوصيل داخل تايلاند من \u2068${price}\u2069. الشحن مشمول في سعر كل باقة حسب وجهتها.`;
  }
  return locale === "th"
    ? `${honey.brand} ${honey.name.th} ขนาด ${honey.weight} กรัม ราคาเริ่มต้น ${price} ต่อกระปุกสำหรับจัดส่งในไทย ราคาชุดสินค้ารวมค่าจัดส่งตามพื้นที่ที่เลือก`
    : `${honey.brand} ${honey.name.en}, ${honey.weight} g, starts at ${price} per jar for Thailand delivery. Shipping is included in each market's bundle price.`;
}

// Used by launch preparation and staff tools; pending items are not store policies.
export const sellingConfirmationChecklist = [
  { key: "stock", label: { th: "จำนวนสินค้าปัจจุบัน", en: "Current stock quantity", ar: "كمية المخزون الحالية" } },
  { key: "batch", label: { th: "ล็อตสินค้าและวันควรบริโภคก่อน", en: "Current batch and best-before date", ar: "التشغيلة الحالية وتاريخ «يُفضّل استهلاكه قبل»" } },
  { key: "shipping", label: { th: "พื้นที่และระยะเวลาจัดส่ง", en: "Delivery areas and timing", ar: "مناطق التوصيل ومواعيده" } },
  { key: "returns", label: { th: "เงื่อนไขคืนสินค้าและคืนเงิน", en: "Return and refund terms", ar: "شروط الإرجاع واسترداد المبلغ" } },
  { key: "wholesale", label: { th: "ราคาและเงื่อนไขขายส่ง", en: "Wholesale pricing and terms", ar: "أسعار الجملة وشروطها" } },
] as const;

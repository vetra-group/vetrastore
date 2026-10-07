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
      summary: "أرسل موقعك للاستفسار عن رسوم التوصيل",
      description: "لم تُؤكَّد بعد رسوم التوصيل ومناطق الخدمة ومواعيد الوصول. أرسل بلد الوجهة والمدينة والرمز البريدي إن وُجد للاستفسار عن التفاصيل قبل الطلب.",
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
      summary: "จัดส่งฟรีในประเทศไทย",
      description:
        "จัดส่งฟรีภายในประเทศไทย กรุณาแจ้งจังหวัดและรหัสไปรษณีย์เพื่อให้ทีมงานยืนยันพื้นที่ให้บริการและระยะเวลาจัดส่งก่อนสั่งซื้อ",
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
      summary: "Share your location for a delivery quote",
      description:
        "Delivery charges, service areas, and delivery times are awaiting confirmation. Share the destination country and city, with a postal code if applicable, to ask for details before ordering.",
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
  const quote = publicQuote(honey, 1, locale);
  const price = quote ? formatPrice(quote.total, locale, quote.currency) : publicPricingCopy[locale].unavailable;
  if (locale === "ar") {
    return `${honey.name.ar} من ${honey.brand}، بوزن ${honey.weight} غرامًا، بسعر \u2068${price}\u2069 للعبوة. تُضاف رسوم التوصيل بشكل منفصل.`;
  }
  return locale === "th"
    ? `${honey.brand} ${honey.name.th} ขนาด ${honey.weight} กรัม ราคา ${price} ต่อกระปุก จัดส่งฟรีในประเทศไทย`
    : `${honey.brand} ${honey.name.en}, ${honey.weight} g, is ${price} per jar. Delivery charges are separate.`;
}

// Used by launch preparation and staff tools; pending items are not store policies.
export const sellingConfirmationChecklist = [
  { key: "stock", label: { th: "จำนวนสินค้าปัจจุบัน", en: "Current stock quantity", ar: "كمية المخزون الحالية" } },
  { key: "batch", label: { th: "ล็อตสินค้าและวันควรบริโภคก่อน", en: "Current batch and best-before date", ar: "التشغيلة الحالية وتاريخ «يُفضّل استهلاكه قبل»" } },
  { key: "shipping", label: { th: "ค่าจัดส่ง พื้นที่ และระยะเวลา", en: "Delivery charges, areas, and timing", ar: "رسوم التوصيل ومناطقه ومواعيده" } },
  { key: "returns", label: { th: "เงื่อนไขคืนสินค้าและคืนเงิน", en: "Return and refund terms", ar: "شروط الإرجاع واسترداد المبلغ" } },
  { key: "wholesale", label: { th: "ราคาและเงื่อนไขขายส่ง", en: "Wholesale pricing and terms", ar: "أسعار الجملة وشروطها" } },
] as const;

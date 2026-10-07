import type { CmsArticle, CmsProduct } from "@/lib/cms/types";
import { HONEY_ID } from "@/lib/catalog";

// A starting draft, never seeded into the public site. The editor must replace
// the internal evidence checklist with genuine business evidence before release.
export function createProductCaseStudy(product: CmsProduct, id: string): CmsArticle {
  const hasSuppliedHoneyPhotos = product.id === HONEY_ID;
  return {
    id, slug: `selection-notes-${id.slice(-8)}`, status: "draft", image: hasSuppliedHoneyPhotos ? "/images/honey-front.jpg" : product.image,
    reviewRequired: true,
    editorialNotes: "Verify the current label and supplier information. Add who selected this product, the actual selection date, observed selection criteria, and genuine supporting photographs. Do not describe laboratory testing, taste testing, certifications, or supplier visits without evidence. Confirm stock, delivery, and current lot separately. Translate all new evidence into English, Arabic, and Thai before publication." + (hasSuppliedHoneyPhotos ? " The included honey-front.jpg and honey-back.jpg are unchanged supplied photographs (see docs/MEDIA_ASSETS.md). They establish the photographed sample's packaging only. Do not treat the sample's dates or lot as current sale inventory. Generated lifestyle images and the processed packshot are not evidence of a supplier visit or product testing." : " Add original, verified photographs through the section image editor; the catalog image has not been verified as an original photograph."),
    relatedProductIds: [product.id],
    content: {
      ar: {
        category: "اختيار المنتجات", title: `${product.name.ar} من ${product.brand}: تفاصيل تساعدك على الاختيار`,
        excerpt: "نظرة عملية على وصف المنتج وحجم العبوة والمعلومات التي ينبغي تأكيدها قبل الطلب.",
        intro: `يبدأ اختيار ${product.name.ar} من ${product.brand} بتفاصيل يمكنك قراءتها ومقارنتها. تجمع هذه المسودة المعلومات الأساسية في عرض المنتج، للاستعانة بها إلى جانب الملصق والتفاصيل الحالية من فريقنا.`,
        imageAlt: hasSuppliedHoneyPhotos ? "صورة مقدّمة لعيّنة عسل أزهار القهوة من ESHAN وملصقها الأمامي" : product.card.ar.imageAlt,
        ...(hasSuppliedHoneyPhotos ? { references: [{ label: "الصورة المقدّمة للملصق الأمامي", href: "/images/honey-front.jpg" }, { label: "الصورة المقدّمة للملصق الخلفي", href: "/images/honey-back.jpg" }] } : {}),
        sections: [
          { title: "المعلومات الواردة في عرض المنتج", text: product.description.ar, bullets: [`العلامة التجارية: ${product.brand}`, `الوزن الصافي: ${product.weight} غرامًا`], links: [{ label: "عرض المنتج وصور الملصق", href: product.id === HONEY_ID ? `/${product.slug}` : `/products/${product.slug}` }] },
          ...(hasSuppliedHoneyPhotos ? [{ title: "اقرأ صور الملصقات المقدّمة", text: "تعرض الصور المقدّمة عبوة عيّنة من المنتج، وتساعدك على تحديد موضع الملصق وقراءته. تخص التواريخ وأرقام التشغيلات في الصورة تلك العيّنة المصوّرة، ولا تؤكد تاريخ صلاحية المخزون المعروض حاليًا أو رقم تشغيلته. اطلب من الفريق معلومات التشغيلة الحالية قبل الطلب.", image: { src: "/images/honey-back.jpg", alt: "صورة مقدّمة للملصق الخلفي لعيّنة عسل أزهار القهوة من ESHAN", caption: "صورة مقدّمة للعيّنة. يجب تأكيد تفاصيل المخزون والتشغيلة الحالية بشكل منفصل." } }] : []),
          { title: "اختر حجم العبوة المناسب لاستخدامك", text: "فكّر إن كنت تشتري لنفسك أو للمشاركة في المنزل أو لنشاط تجاري. قارن الكمية التي تتوقع استخدامها بحجم العبوة قبل طلب عدة وحدات. وإذا كنت تخطط لإعادة البيع، فاستفسر عن أعداد الوحدات في العبوة وشروط الطلب." },
          { title: "ما ينبغي تأكيده قبل الطلب", text: "تساعد صور المنتج على مراجعة العبوة. أكّد مع الفريق تفاصيل المنتجات التي ستستلمها، خاصة عند طلب كميات كبيرة أو الحاجة إلى موعد توصيل محدد.", bullets: ["الكمية المتاحة حاليًا", "تاريخ الصلاحية أو تاريخ «يُفضّل استهلاكه قبل» للتشغيلة الحالية", "رسوم التوصيل ومواعيده", "شروط الطلبات الكبيرة"] },
        ],
      },
      th: {
        category: "เลือกสินค้า", title: `${product.brand} ${product.name.th}: รายละเอียดที่ใช้ประกอบการเลือก`,
        excerpt: "ดูรายละเอียดสินค้า ขนาด และข้อมูลที่ควรตรวจสอบก่อนเลือกซื้อ พร้อมแยกข้อมูลบนฉลากออกจากสิ่งที่ต้องยืนยันเพิ่มเติม",
        intro: `การเลือก ${product.brand} ${product.name.th} เริ่มได้จากข้อมูลสินค้าที่อ่านและเปรียบเทียบได้ หน้านี้รวบรวมรายละเอียดพื้นฐานจากรายการสินค้า เพื่อใช้ประกอบการตัดสินใจร่วมกับฉลากและข้อมูลล่าสุดจากทีมงาน`,
        imageAlt: hasSuppliedHoneyPhotos ? "ภาพถ่ายสินค้าตัวอย่าง ESHAN น้ำผึ้งดอกกาแฟ พร้อมฉลากด้านหน้า" : product.card.th.imageAlt,
        ...(hasSuppliedHoneyPhotos ? { references: [{ label: "ภาพถ่ายฉลากด้านหน้าที่ได้รับมา", href: "/images/honey-front.jpg" }, { label: "ภาพถ่ายฉลากด้านหลังที่ได้รับมา", href: "/images/honey-back.jpg" }] } : {}),
        sections: [
          { title: "ข้อมูลสินค้าที่ระบุไว้", text: product.description.th, bullets: [`แบรนด์ ${product.brand}`, `น้ำหนักสุทธิ ${product.weight} กรัม`], links: [{ label: "ดูหน้าสินค้าและภาพฉลาก", href: product.id === "coffee-blossom-honey" ? `/${product.slug}` : `/products/${product.slug}` }] },
          ...(hasSuppliedHoneyPhotos ? [{ title: "ดูข้อมูลจากภาพฉลากจริง", text: "ภาพถ่ายที่ได้รับมาแสดงบรรจุภัณฑ์ของสินค้าตัวอย่าง ใช้ดูตำแหน่งและข้อความบนฉลากได้ วันที่และเลขล็อตบนภาพเป็นข้อมูลของตัวอย่างที่ถ่าย ไม่ได้ยืนยันวันหมดอายุหรือเลขล็อตของสินค้าที่พร้อมขายในปัจจุบัน ควรขอข้อมูลล็อตล่าสุดจากทีมงานก่อนสั่งซื้อ", image: { src: "/images/honey-back.jpg", alt: "ภาพถ่ายฉลากด้านหลังสินค้าตัวอย่าง ESHAN น้ำผึ้งดอกกาแฟ", caption: "ภาพสินค้าตัวอย่างที่ได้รับมา รายละเอียดล็อตปัจจุบันต้องยืนยันแยกต่างหาก" } }] : []),
          { title: "เลือกขนาดให้เหมาะกับการใช้งาน", text: "พิจารณาว่าจะใช้เอง ใช้ร่วมกับครอบครัว หรือจัดซื้อสำหรับธุรกิจ เปรียบเทียบปริมาณที่จะใช้จริงกับขนาดบรรจุ ก่อนตัดสินใจซื้อหลายชิ้น หากต้องการขายต่อ ควรถามจำนวนต่อแพ็กและเงื่อนไขการสั่งซื้อเพิ่มเติม" },
          { title: "ข้อมูลที่ควรยืนยันก่อนสั่งซื้อ", text: "ภาพสินค้าใช้ประกอบการพิจารณา ควรยืนยันรายละเอียดของสินค้าที่จะได้รับกับทีมงานก่อนสั่งซื้อ โดยเฉพาะเมื่อต้องการจำนวนมากหรือมีวันใช้งานที่แน่นอน", bullets: ["จำนวนที่พร้อมจัดส่ง", "วันหมดอายุหรือควรบริโภคก่อนของล็อตปัจจุบัน", "ค่าจัดส่งและระยะเวลาจัดส่ง", "เงื่อนไขสำหรับการสั่งซื้อจำนวนมาก"] },
        ],
      },
      en: {
        category: "Product selection", title: `${product.brand} ${product.name.en}: details to consider before choosing`,
        excerpt: "A practical look at the product description, pack size, and information to confirm before ordering.",
        intro: `Choosing ${product.brand} ${product.name.en} starts with details you can read and compare. This draft brings together the basic information in our product listing, to be considered alongside the label and current details from our team.`,
        imageAlt: hasSuppliedHoneyPhotos ? "Supplied photograph of the ESHAN coffee blossom honey sample and front label" : product.card.en.imageAlt,
        ...(hasSuppliedHoneyPhotos ? { references: [{ label: "Supplied front-label photograph", href: "/images/honey-front.jpg" }, { label: "Supplied back-label photograph", href: "/images/honey-back.jpg" }] } : {}),
        sections: [
          { title: "What the product listing states", text: product.description.en, bullets: [`Brand: ${product.brand}`, `Net weight: ${product.weight} g`], links: [{ label: "View the product and label photographs", href: product.id === "coffee-blossom-honey" ? `/${product.slug}` : `/products/${product.slug}` }] },
          ...(hasSuppliedHoneyPhotos ? [{ title: "Read the supplied label photographs", text: "The supplied photographs show the packaging of a sample product and help you locate and read its label. Any date or lot number in the image belongs to that photographed sample. It does not establish the expiry date or lot of stock currently offered for sale. Ask the team for the current lot information before ordering.", image: { src: "/images/honey-back.jpg", alt: "Supplied photograph of the ESHAN coffee blossom honey sample’s back label", caption: "Supplied sample photograph. Current stock and lot details require separate confirmation." } }] : []),
          { title: "Choose a pack size for the way you will use it", text: "Consider whether you are buying for yourself, sharing at home, or ordering for a business. Compare the amount you expect to use with the pack size before ordering several units. If you plan to resell the product, ask about pack quantities and ordering terms." },
          { title: "What to confirm before ordering", text: "Product photographs help you review the packaging. Confirm the details of the goods you will receive with the team, especially for larger quantities or a particular delivery date.", bullets: ["Quantity currently available", "The current lot’s expiry or best-before information", "Delivery charges and timing", "Terms for larger orders"] },
        ],
      },
    },
  };
}

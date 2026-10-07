import type { Localized } from "@/lib/i18n";

type HoneyStory = {
  eyebrow: string;
  title: readonly [string, string];
  intro: string;
  discover: string;
  chooseProduct: string;
  storyLink: string;
  pure: string;
  ingredient: string;
  netWeight: string;
  origin: string;
  originLabel: string;
  originEyebrow: string;
  originTitle: string;
  originBody: string;
  originNote: string;
  originLink: string;
  landscapeAlt: string;
  landscapeCaption: string;
  ritualEyebrow: string;
  ritualTitle: string;
  ritualIntro: string;
  ritualAlt: string;
  rituals: Record<"toast" | "yogurt" | "coffee", { title: string; body: string }>;
  shopEyebrow: string;
  shopTitle: string;
  shippingNote: string;
  orderNote: string;
  labelNote: string;
  gallery: {
    gallery: string;
    zoom: string;
    zoomIn: string;
    zoomOut: string;
    close: string;
    previous: string;
    next: string;
    product: string;
    front: string;
    back: string;
    lifestyle: string;
    loading: string;
    unavailable: string;
    retry: string;
  };
  faqEyebrow: string;
  faqTitle: string;
  faqIntro: string;
  faqs: Record<"storage" | "delivery", { question: string; answer: string }>;
  footerLine: string;
  backToStore: string;
  backToTop: string;
};

export const honeyStory: Localized<HoneyStory> = {
  ar: {
    eyebrow: "ESHAN",
    title: ["عسل", "أزهار القهوة"],
    intro: "عسل أزهار القهوة 100% من شمال تايلاند. حلاوة لطيفة لأطعمتك ومشروباتك المفضلة.",
    discover: "عرض تفاصيل المنتج",
    chooseProduct: "اختر العسل",
    storyLink: "تعرّف على هذا العسل",
    pure: "أزهار القهوة",
    ingredient: "عسل أزهار القهوة",
    netWeight: "الوزن الصافي",
    origin: "شمال تايلاند",
    originLabel: "المنشأ",
    originEyebrow: "المنشأ",
    originTitle: "من أزهار القهوة\nفي شمال تايلاند",
    originBody: "يُجمع عسل ESHAN من أزهار القهوة في شمال تايلاند، وفقًا للمعلومات الواردة على ملصق المنتج.",
    originNote: "لون كهرماني، وحلاوة لطيفة، ونكهة مميزة.",
    originLink: "اقرأ المزيد",
    landscapeAlt: "صورة توضيحية لجبال وأزهار قهوة في ضوء الصباح",
    landscapeCaption: "صورة توضيحية لطبيعة شمال تايلاند",
    ritualEyebrow: "طرق الاستمتاع به",
    ritualTitle: "لمسة حلاوة\nللطعام والشراب",
    ritualIntro: "استمتع به بمفرده أو أضفه إلى وصفاتك المفضلة. اختر الكمية التي تناسب ذوقك.",
    ritualAlt: "عسل ESHAN على مائدة إفطار مع فنجان قهوة وملعقة عسل",
    rituals: {
      toast: { title: "الخبز المحمّص", body: "أضفه إلى الخبز المحمّص الدافئ، مع الزبدة أو من دونها." },
      yogurt: { title: "الزبادي", body: "أضفه إلى الزبادي الطبيعي مع الفاكهة أو الغرانولا." },
      coffee: { title: "الشاي والقهوة", body: "أضف قليلًا منه وحرّك جيدًا، ثم اضبط الحلاوة حسب ذوقك." },
    },
    shopEyebrow: "ESHAN",
    shopTitle: "عسل أزهار القهوة",
    shippingNote: "السعر لا يشمل الشحن",
    orderNote: "سيؤكد فريقنا توافر المنتج وتفاصيل الشحن والدفع. إضافة المنتج إلى السلة لا تُعدّ طلب شراء.",
    labelNote: "تحقّق من تاريخ «يُفضّل استهلاكه قبل» وتفاصيل التشغيلة على العبوة التي تستلمها.",
    gallery: {
      gallery: "صور المنتج والملصقات",
      zoom: "تكبير الصورة",
      zoomIn: "تقريب",
      zoomOut: "إبعاد",
      close: "إغلاق الصورة",
      previous: "الصورة السابقة",
      next: "الصورة التالية",
      product: "المنتج",
      front: "الملصق الأمامي",
      back: "الملصق الخلفي",
      lifestyle: "على المائدة",
      loading: "جارٍ تحميل الصورة…",
      unavailable: "تعذّر تحميل هذه الصورة.",
      retry: "حاول مجددًا",
    },
    faqEyebrow: "معلومات إضافية",
    faqTitle: "الأسئلة الشائعة",
    faqIntro: "الحفظ والطلب.",
    faqs: {
      storage: { question: "كيف أحفظ العسل؟", answer: "احفظه في درجة حرارة الغرفة، وتحقّق من تاريخ «يُفضّل استهلاكه قبل» على العبوة التي تستلمها." },
      delivery: { question: "كيف أطلب أو أستفسر عن الشراء بالجملة؟", answer: "أضف العسل إلى سلتك أو تواصل مع VETRA STORE. سيؤكد فريقنا توافر المنتج وتفاصيل الشحن والدفع قبل متابعة الطلب. إضافة المنتج إلى السلة لا تُعدّ طلب شراء أو عملية دفع." },
    },
    footerLine: "عسل أزهار القهوة من شمال تايلاند.",
    backToStore: "العودة إلى VETRA STORE",
    backToTop: "العودة إلى أعلى الصفحة",
  },
  th: {
    eyebrow: "ESHAN",
    title: ["น้ำผึ้ง", "ดอกกาแฟ"],
    intro: "น้ำผึ้งดอกกาแฟ 100% จากภาคเหนือของไทย รสหวานนุ่ม สำหรับอาหารและเครื่องดื่มที่คุณชอบ",
    discover: "ดูรายละเอียดสินค้า",
    chooseProduct: "เลือกสินค้า",
    storyLink: "รู้จักน้ำผึ้งดอกกาแฟ",
    pure: "ดอกกาแฟ",
    ingredient: "น้ำผึ้งดอกกาแฟ",
    netWeight: "น้ำหนักสุทธิ",
    origin: "ภาคเหนือของไทย",
    originLabel: "แหล่งที่มาของน้ำผึ้ง",
    originEyebrow: "แหล่งที่มา",
    originTitle: "จากดอกกาแฟ\nทางภาคเหนือของไทย",
    originBody: "น้ำผึ้ง ESHAN เก็บเกี่ยวจากดอกกาแฟในภาคเหนือของประเทศไทย ตามข้อมูลบนฉลากสินค้า",
    originNote: "สีอำพัน รสหวานนุ่ม พร้อมกลิ่นรสเฉพาะตัว",
    originLink: "อ่านเพิ่มเติม",
    landscapeAlt: "ภาพประกอบบรรยากาศภูเขาและดอกกาแฟในแสงเช้า",
    landscapeCaption: "ภาพประกอบธรรมชาติทางภาคเหนือของไทย",
    ritualEyebrow: "วิธีรับประทาน",
    ritualTitle: "เติมความหวาน\nให้อาหารและเครื่องดื่ม",
    ritualIntro: "รับประทานโดยตรง หรือเติมในเมนูที่คุณชอบ ปรับปริมาณตามความต้องการ",
    ritualAlt: "น้ำผึ้ง ESHAN บนโต๊ะอาหารเช้า พร้อมถ้วยกาแฟและที่ตักน้ำผึ้ง",
    rituals: {
      toast: { title: "ขนมปัง", body: "ราดบนขนมปังอุ่น ๆ หรือรับประทานคู่กับเนย" },
      yogurt: { title: "โยเกิร์ต", body: "เติมในโยเกิร์ตรสธรรมชาติ คู่กับผลไม้หรือกราโนลา" },
      coffee: { title: "ชาและกาแฟ", body: "เติมทีละน้อย คนให้เข้ากัน แล้วปรับความหวานตามชอบ" },
    },
    shopEyebrow: "ESHAN",
    shopTitle: "น้ำผึ้งดอกกาแฟ",
    shippingNote: "ยังไม่รวมค่าจัดส่ง",
    orderNote: "ทีมงานจะยืนยันสินค้า ค่าจัดส่ง และการชำระเงิน การเพิ่มลงตะกร้ายังไม่ถือเป็นการสั่งซื้อ",
    labelNote: "ตรวจสอบวันควรบริโภคก่อนและข้อมูลล็อตบนกระปุกที่ได้รับ",
    gallery: {
      gallery: "ภาพสินค้าและฉลาก",
      zoom: "ขยายภาพ",
      zoomIn: "ซูมเข้า",
      zoomOut: "ซูมออก",
      close: "ปิดภาพ",
      previous: "ภาพก่อนหน้า",
      next: "ภาพถัดไป",
      product: "สินค้า",
      front: "ฉลากด้านหน้า",
      back: "ฉลากด้านหลัง",
      lifestyle: "บนโต๊ะอาหาร",
      loading: "กำลังโหลดภาพ…",
      unavailable: "โหลดภาพนี้ไม่สำเร็จ",
      retry: "ลองอีกครั้ง",
    },
    faqEyebrow: "ข้อมูลเพิ่มเติม",
    faqTitle: "คำถามที่พบบ่อย",
    faqIntro: "การเก็บรักษา และการสั่งซื้อ",
    faqs: {
      storage: { question: "ควรเก็บรักษาอย่างไร?", answer: "เก็บที่อุณหภูมิห้อง และตรวจสอบวันควรบริโภคก่อนบนกระปุกที่ได้รับ" },
      delivery: { question: "สั่งซื้อหรือสอบถามขายส่งอย่างไร?", answer: "เพิ่มสินค้าลงตะกร้า หรือติดต่อ VETRA STORE ทีมงานจะยืนยันสินค้า ค่าจัดส่ง และการชำระเงินก่อนดำเนินการ การเพิ่มลงตะกร้ายังไม่ใช่การสั่งซื้อหรือชำระเงิน" },
    },
    footerLine: "น้ำผึ้งดอกกาแฟ จากภาคเหนือของไทย",
    backToStore: "กลับสู่ VETRA STORE",
    backToTop: "กลับด้านบน",
  },
  en: {
    eyebrow: "ESHAN",
    title: ["Coffee Blossom", "Honey"],
    intro: "100% coffee blossom honey from northern Thailand. A gentle sweetness for your favourite food and drinks.",
    discover: "View product details",
    chooseProduct: "Choose honey",
    storyLink: "About this honey",
    pure: "Coffee blossom",
    ingredient: "Coffee blossom honey",
    netWeight: "Net weight",
    origin: "Northern Thailand",
    originLabel: "Origin",
    originEyebrow: "Origin",
    originTitle: "From coffee blossoms\nin northern Thailand",
    originBody: "ESHAN honey is harvested from coffee blossoms in northern Thailand, according to the product label.",
    originNote: "Amber colour, gentle sweetness and a distinctive flavour.",
    originLink: "Read more",
    landscapeAlt: "An illustrative mountain landscape with coffee blossoms in the morning light",
    landscapeCaption: "An illustration of northern Thailand’s landscape",
    ritualEyebrow: "Ways to enjoy",
    ritualTitle: "Sweetness for\nfood and drinks",
    ritualIntro: "Enjoy on its own or add to your favourite recipes. Adjust the amount to your taste.",
    ritualAlt: "ESHAN honey on a breakfast table with a coffee cup and honey dipper",
    rituals: {
      toast: { title: "Toast", body: "Drizzle over warm toast, with or without butter." },
      yogurt: { title: "Yogurt", body: "Add to plain yogurt with fruit or granola." },
      coffee: { title: "Tea & coffee", body: "Stir in a little at a time and adjust to taste." },
    },
    shopEyebrow: "ESHAN",
    shopTitle: "Coffee Blossom Honey",
    shippingNote: "Shipping not included",
    orderNote: "Our team will confirm availability, shipping and payment. Adding to your bag does not place an order.",
    labelNote: "Check your jar for its best-before date and batch details.",
    gallery: {
      gallery: "Product photos & labels",
      zoom: "Enlarge image",
      zoomIn: "Zoom in",
      zoomOut: "Zoom out",
      close: "Close image",
      previous: "Previous image",
      next: "Next image",
      product: "Product",
      front: "Front label",
      back: "Back label",
      lifestyle: "At the table",
      loading: "Loading image…",
      unavailable: "This image could not be loaded.",
      retry: "Try again",
    },
    faqEyebrow: "More information",
    faqTitle: "Frequently asked questions",
    faqIntro: "Storage and ordering.",
    faqs: {
      storage: { question: "How should I store it?", answer: "Store at room temperature and check the best-before date on your jar." },
      delivery: { question: "How do I order or enquire about wholesale?", answer: "Add honey to your bag or contact VETRA STORE. Our team will confirm availability, shipping and payment before proceeding. Adding to the bag does not place or pay for an order." },
    },
    footerLine: "Coffee blossom honey from northern Thailand.",
    backToStore: "Back to VETRA STORE",
    backToTop: "Back to top",
  },
};

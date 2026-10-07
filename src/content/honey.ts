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
  faqs: Record<"meaning" | "ingredients" | "storage" | "batch" | "international" | "delivery", { question: string; answer: string }>;
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
    faqIntro: "المكوّنات والمنشأ والحفظ وما ينبغي تأكيده قبل الطلب.",
    faqs: {
      meaning: { question: "ما المقصود بعسل أزهار القهوة؟", answer: "يشير اسم «أزهار القهوة» إلى المصدر الزهري للعسل، ولا يعني إضافة القهوة إليه. يذكر ملصق ESHAN المقدَّم أن العسل يُجمع من أزهار القهوة في شمال تايلاند." },
      ingredients: { question: "ما المكوّنات والوزن المذكوران على الملصق؟", answer: "يذكر ملصق العيّنة المقدَّمة عسل أزهار القهوة بنسبة 100%، تحت العلامة التجارية ESHAN، بوزن صافٍ قدره 380 غرامًا. والمنشأ المعلن هو شمال تايلاند. راجع صور الملصق وتعليمات العبوة التي تستلمها." },
      storage: { question: "كيف أحفظ العسل؟", answer: "احفظه في درجة حرارة الغرفة، وتحقّق من تاريخ «يُفضّل استهلاكه قبل» على العبوة التي تستلمها." },
      batch: { question: "هل تؤكد صور الملصق تشغيلة طلبي أو الشهادة الحالية؟", answer: "تعرض الصور عيّنة مقدَّمة من المنتج. لا تؤكد التواريخ وأرقام التشغيلات والعلامات على هذه العيّنة تشغيلة المنتج الذي ستستلمه أو سريان الشهادة الحالية. اطلب من فريقنا تأكيد تفاصيل المخزون ووثائق الشهادات الحالية قبل الطلب." },
      international: { question: "كيف أستفسر عن التوصيل خارج تايلاند؟", answer: "أرسل بلد الوجهة والمدينة والرمز البريدي إن كان لعنوانك رمز. يجب أن يؤكد فريقنا إمكانية التوصيل ورسومه ومواعيده قبل متابعة الطلب." },
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
    shippingNote: "จัดส่งฟรีในประเทศไทย",
    orderNote: "จัดส่งฟรีในประเทศไทย ทีมงานจะยืนยันสินค้า พื้นที่จัดส่ง และการชำระเงิน การเพิ่มลงตะกร้ายังไม่ถือเป็นการสั่งซื้อ",
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
    faqIntro: "ส่วนประกอบ แหล่งที่มา การเก็บรักษา และข้อมูลที่ควรยืนยันก่อนสั่งซื้อ",
    faqs: {
      meaning: { question: "น้ำผึ้งดอกกาแฟคืออะไร?", answer: "ชื่อดอกกาแฟหมายถึงแหล่งดอกไม้ที่มาของน้ำผึ้ง ไม่ได้หมายความว่ามีการเติมกาแฟลงไป ฉลาก ESHAN ที่ได้รับมาระบุว่าเป็นน้ำผึ้งจากดอกกาแฟในภาคเหนือของประเทศไทย" },
      ingredients: { question: "ฉลากระบุส่วนประกอบและน้ำหนักอย่างไร?", answer: "ฉลากสินค้าตัวอย่างที่ได้รับมาระบุส่วนประกอบเป็นน้ำผึ้งดอกกาแฟ 100% ตรา ESHAN น้ำหนักสุทธิ 380 กรัม และแหล่งที่มาจากภาคเหนือของไทย ดูภาพฉลากประกอบ และตรวจสอบข้อมูลบนกระปุกที่ได้รับ" },
      storage: { question: "ควรเก็บรักษาอย่างไร?", answer: "เก็บที่อุณหภูมิห้อง และตรวจสอบวันควรบริโภคก่อนบนกระปุกที่ได้รับ" },
      batch: { question: "ภาพฉลากยืนยันล็อตที่จะได้รับหรือใบรับรองปัจจุบันหรือไม่?", answer: "ภาพแสดงสินค้าตัวอย่างที่ได้รับมา วันที่ เลขล็อต และเครื่องหมายบนตัวอย่างไม่ได้ยืนยันล็อตที่จะส่งให้คุณหรือสถานะใบรับรองปัจจุบัน กรุณาขอให้ทีมงานยืนยันข้อมูลสินค้าที่พร้อมจำหน่ายและเอกสารรับรองปัจจุบันก่อนสั่งซื้อ" },
      international: { question: "สอบถามการจัดส่งนอกประเทศไทยได้อย่างไร?", answer: "แจ้งประเทศปลายทาง เมือง และรหัสไปรษณีย์หากมี ทีมงานต้องยืนยันว่าจัดส่งได้หรือไม่ พร้อมค่าจัดส่งและระยะเวลาก่อนดำเนินการสั่งซื้อ" },
      delivery: { question: "สั่งซื้อหรือสอบถามขายส่งอย่างไร?", answer: "เพิ่มสินค้าลงตะกร้า หรือติดต่อ VETRA STORE จัดส่งฟรีในประเทศไทย ทีมงานจะยืนยันสินค้า พื้นที่จัดส่ง และการชำระเงินก่อนดำเนินการ การเพิ่มลงตะกร้ายังไม่ใช่การสั่งซื้อหรือชำระเงิน" },
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
    faqIntro: "Ingredients, origin, storage and what to confirm before ordering.",
    faqs: {
      meaning: { question: "What is coffee blossom honey?", answer: "Coffee blossom describes the honey’s floral source; it does not mean coffee has been added. The supplied ESHAN label states that the honey is harvested from coffee blossoms in northern Thailand." },
      ingredients: { question: "What ingredients and weight does the label list?", answer: "The supplied sample label lists 100% coffee blossom honey, the ESHAN brand and a net weight of 380 g. Its stated origin is northern Thailand. Review the label photographs and check the information on the jar you receive." },
      storage: { question: "How should I store it?", answer: "Store at room temperature and check the best-before date on your jar." },
      batch: { question: "Do label photos confirm my batch or current certification?", answer: "The photographs show a supplied sample. Dates, lot numbers and marks on that sample do not confirm the batch you will receive or current certification. Ask our team to confirm current stock details and certification documents before ordering." },
      international: { question: "How do I enquire about delivery outside Thailand?", answer: "Share the destination country and city, with a postal code if your address has one. Our team must confirm whether delivery is available, its charges and timing before an order proceeds." },
      delivery: { question: "How do I order or enquire about wholesale?", answer: "Add honey to your bag or contact VETRA STORE. Our team will confirm availability, shipping and payment before proceeding. Adding to the bag does not place or pay for an order." },
    },
    footerLine: "Coffee blossom honey from northern Thailand.",
    backToStore: "Back to VETRA STORE",
    backToTop: "Back to top",
  },
};

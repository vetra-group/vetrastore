import type { Localized } from "@/lib/i18n";
import type {
  FooterLinkKey,
  HeroSlideKey,
  HomeCollectionKey,
  MainNavigationKey,
  TrustItemKey,
} from "./site-structure";
type SiteCopy = {
  homeTitle: string;
  homeDescription: string;
  mainNav: string;
  mobileNav: string;
  heroSlideAlts: Record<HeroSlideKey, string>;
  heroSlideLinks: Record<HeroSlideKey, string>;
  heroSlider: {
    carousel: string;
    previous: string;
    next: string;
    select: string;
    status: string;
    newTab: string;
  };
  naturalCollection: string;
  announcement: string;
  nav: Record<MainNavigationKey, string>;
  search: string;
  searchPlaceholder: string;
  searchHint: string;
  switchLanguage: string;
  close: string;
  menu: string;
  account: string;
  cart: string;
  skip: string;
  footerNavLabel: string;
  shop: string;
  links: Record<FooterLinkKey | "coffeeBlossomHoney", string>;
  copyright: string;
  bottom: string;
  heroEyebrow: string;
  heroTitle: string[];
  heroBody: string;
  shopNow: string;
  heroSecondary: string;
  trust: Record<TrustItemKey, { title: string; body: string }>;
  collectionEyebrow: string;
  collectionTitle: string;
  categories: Record<HomeCollectionKey, { title: string; sub: string; description: string; details: readonly string[]; tag: string; comingSoonLabel?: string }>;
};
export const siteCopy: Localized<SiteCopy> = {
  ar: {
    homeTitle: "منتجات واستفسارات للجملة والتجزئة",
    homeDescription: "استفسر عن الشراء بالتجزئة أو بالجملة. يؤكد فريقنا التوافر وترتيبات التوصيل.",
    mainNav: "التنقل الرئيسي",
    mobileNav: "قائمة التنقل على الهاتف",
    heroSlideAlts: {
      blossoms: "عبوة عسل أزهار القهوة من ESHAN بين أزهار القهوة البيضاء وتلال يلفها الضباب",
      coffeeCup: "عبوة عسل أزهار القهوة من ESHAN بجوار فنجان قهوة كحلي",
      ceramicBowl: "عبوة عسل أزهار القهوة من ESHAN مع وعاء خزفي وأزهار القهوة",
      honeyDipper: "عبوة عسل أزهار القهوة من ESHAN بجوار ملعقة عسل على مائدة الإفطار",
      coffeeLandscape: "أزهار قهوة بيضاء وثمار قهوة حمراء أمام تلال يلفها الضباب",
      morningRitual: "عسل ينساب من ملعقة خشبية إلى فنجان قهوة",
    },
    heroSlideLinks: {
      blossoms: "اكتشف عسل أزهار القهوة من ESHAN، 380 غرامًا",
      coffeeCup: "اكتشف عسل أزهار القهوة من ESHAN، 380 غرامًا",
      ceramicBowl: "اكتشف عسل أزهار القهوة من ESHAN، 380 غرامًا",
      honeyDipper: "اكتشف عسل أزهار القهوة من ESHAN، 380 غرامًا",
      coffeeLandscape: "تعرّف على VETRA",
      morningRitual: "اقرأ أفكارًا بسيطة للاستمتاع بالعسل",
    },
    heroSlider: {
      carousel: "مختارات VETRA STORE",
      previous: "الصورة السابقة",
      next: "الصورة التالية",
      select: "عرض الصورة {number} من {total}",
      status: "الصورة {number} من {total}",
      newTab: "يفتح في علامة تبويب جديدة",
    },
    naturalCollection: "من خيرات الطبيعة",
    announcement: "أشياء تستحق الاقتناء، نختارها بعناية.",
    nav: { home: "الرئيسية", shop: "المنتجات", story: "من نحن", journal: "المقالات" },
    search: "بحث",
    searchPlaceholder: "عمّ تبحث؟",
    searchHint: "ابحث في منتجاتنا وأدلتنا العملية لاختيار ما يناسبك.",
    switchLanguage: "تغيير اللغة إلى",
    close: "إغلاق",
    menu: "فتح القائمة",
    account: "المنتجات المحفوظة",
    cart: "سلة التسوق",
    skip: "انتقل إلى المحتوى",
    footerNavLabel: "روابط أسفل الصفحة",
    shop: "تسوّق",
    links: {
      allProducts: "جميع المنتجات",
      coffeeBlossomHoney: "عسل أزهار القهوة",
      contact: "تواصل معنا",
      shippingReturns: "الشحن والإرجاع",
      ourStory: "من نحن",
      theJournal: "المقالات",
    },
    copyright: "© 2026 VETRA STORE. جميع الحقوق محفوظة.",
    bottom: "منتجات عالية الجودة. قيمة تستحقها.",
    heroEyebrow: "من اختيار VETRA",
    heroTitle: ["منتجات عالية الجودة", "وقيمة استثنائية."],
    heroBody: "تجمع VETRA بين الخبرة والمعايير العالية في اختيار المنتجات، مع الاهتمام بالجودة والقيمة.",
    shopNow: "منتجاتنا",
    heroSecondary: "من نحن",
    trust: {
      productKnowledge: { title: "نعرف منتجاتنا جيدًا", body: "ندرس تفاصيل كل منتج بعناية." },
      wholesaleRetail: { title: "للجملة والتجزئة", body: "استفسر عن الكميات المناسبة لك أو لنشاطك التجاري." },
      consultation: { title: "نسعد بمساعدتك", body: "اهتمام ومشورة قبل كل عملية شراء وبعدها." },
    },
    collectionEyebrow: "منتجات VETRA",
    collectionTitle: "منتجاتنا",
    categories: {
      honey: {
        title: "عسل أزهار القهوة من ESHAN",
        sub: "عسل من أزهار القهوة في شمال تايلاند.",
        description: "عسل أزهار القهوة بلونه الكهرماني وحلاوته اللطيفة ونكهته المميزة. استمتع به بمفرده، أو أضف لمسته العطرية إلى أطعمتك ومشروباتك.",
        details: ["عسل أزهار القهوة 100%", "من شمال تايلاند", "علامة حلال على ملصق العيّنة؛ تحقّق من الشهادة الحالية"],
        tag: "عرض التفاصيل",
      },
      coffee: {
        title: "حبوب قهوة عالية الجودة",
        sub: "حبوب مختارة بعناية لكل فنجان.",
        description: "نختار حبوب القهوة وفقًا لمنشئها وجودتها وخصائص نكهتها، ليكون لكل فنجان طابعه الخاص.",
        details: ["حبوب قهوة مختارة", "من دوي واوي"],
        tag: "عرض التفاصيل",
        comingSoonLabel: "قريبًا",
      },
      instantCoffee: {
        title: "قهوة سريعة التحضير",
        sub: "قهوة طيبة المذاق، سهلة التحضير.",
        description: "سهولة التحضير مع الاهتمام بالجودة. نعمل على اختيار قهوة سريعة التحضير تجمع بين النكهة والعطر وسهولة الإعداد.",
        details: ["سهلة التحضير", "للاستمتاع بها كل يوم"],
        tag: "عرض التفاصيل",
        comingSoonLabel: "قريبًا",
      },
    },
  },
  en: {
    homeTitle: "Products & retail or wholesale enquiries",
    homeDescription: "Retail and wholesale enquiries. Confirm availability and delivery with our team.",
    mainNav: "Main navigation",
    mobileNav: "Mobile navigation",
    heroSlideAlts: {
      blossoms: "ESHAN Coffee Blossom Honey jar among white coffee blossoms and misty hills",
      coffeeCup: "ESHAN Coffee Blossom Honey jar beside a navy coffee cup",
      ceramicBowl: "ESHAN Coffee Blossom Honey jar with a ceramic bowl and coffee blossoms",
      honeyDipper: "ESHAN Coffee Blossom Honey jar beside a honey dipper on a breakfast table",
      coffeeLandscape: "White coffee blossoms and red coffee cherries overlooking misty hills",
      morningRitual: "Honey flowing from a wooden dipper into a cup of coffee",
    },
    heroSlideLinks: {
      blossoms: "View ESHAN Coffee Blossom Honey, 380 g",
      coffeeCup: "View ESHAN Coffee Blossom Honey, 380 g",
      ceramicBowl: "View ESHAN Coffee Blossom Honey, 380 g",
      honeyDipper: "View ESHAN Coffee Blossom Honey, 380 g",
      coffeeLandscape: "About VETRA",
      morningRitual: "Read simple honey pairings",
    },
    heroSlider: {
      carousel: "VETRA STORE highlights",
      previous: "Previous image",
      next: "Next image",
      select: "Show image {number} of {total}",
      status: "Image {number} of {total}",
      newTab: "opens in a new tab",
    },
    naturalCollection: "THE NATURAL COLLECTION",
    announcement: "Good things, thoughtfully chosen.",
    nav: { home: "Home", shop: "Shop", story: "About us", journal: "Blog" },
    search: "Search",
    searchPlaceholder: "What are you looking for?",
    searchHint: "Search our products and practical selection guides.",
    switchLanguage: "Switch to",
    close: "Close",
    menu: "Open menu",
    account: "Saved items",
    cart: "Shopping bag",
    skip: "Skip to content",
    footerNavLabel: "Footer navigation",
    shop: "Shop",
    links: {
      allProducts: "All products",
      coffeeBlossomHoney: "Coffee Blossom Honey",
      contact: "Contact us",
      shippingReturns: "Shipping & returns",
      ourStory: "About us",
      theJournal: "Blog",
    },
    copyright: "© 2026 VETRA STORE. All rights reserved.",
    bottom: "Quality products. Great value.",
    heroEyebrow: "SELECTED BY VETRA",
    heroTitle: ["Quality Products", "Outstanding Value."],
    heroBody:
      "VETRA brings expertise and high standards to product selection, with a focus on quality and value.",
    shopNow: "Our Products",
    heroSecondary: "About Us",
    trust: {
      productKnowledge: {
        title: "Know Every Product",
        body: "We study every product in detail.",
      },
      wholesaleRetail: {
        title: "Wholesale & Retail",
        body: "Ask about quantities for yourself or your business.",
      },
      consultation: {
        title: "Here to Advise",
        body: "Thoughtful support before and after every purchase.",
      },
    },
    collectionEyebrow: "PRODUCTS FROM VETRA",
    collectionTitle: "Our Products",
    categories: {
      honey: {
        title: "ESHAN Coffee Blossom Honey",
        sub: "Honey from coffee blossoms in northern Thailand.",
        description:
          "Amber-coloured coffee blossom honey with a gentle sweetness and distinctive flavour. Enjoy it on its own, or add a fragrant touch to food and drinks.",
        details: ["100% coffee blossom honey", "From northern Thailand", "Sample label: halal mark; verify current certification"],
        tag: "View details",
      },
      coffee: {
        title: "Quality Coffee Beans",
        sub: "Carefully selected beans for every cup.",
        description:
          "Coffee beans selected for their origin, quality, and flavour profile, so each cup has a character of its own.",
        details: ["Selected coffee beans", "From Doi Wawi"],
        tag: "View details",
        comingSoonLabel: "Coming soon",
      },
      instantCoffee: {
        title: "Instant Coffee",
        sub: "Good coffee, easy to prepare.",
        description:
          "Convenience without compromising quality. We are selecting instant coffee for its flavour, aroma, and ease of preparation.",
        details: ["Easy to prepare", "Ready for every day"],
        tag: "View details",
        comingSoonLabel: "Coming soon",
      },
    },
  },
  th: {
    homeTitle: "สินค้าและการสอบถามปลีกหรือขายส่ง",
    homeDescription: "สอบถามสินค้าได้ทั้งปลีกและขายส่ง ทีมงานจะยืนยันสินค้าและรายละเอียดการจัดส่ง",
    mainNav: "เมนูหลัก",
    mobileNav: "เมนูมือถือ",
    heroSlideAlts: {
      blossoms: "น้ำผึ้งดอกกาแฟ ESHAN ท่ามกลางดอกกาแฟสีขาวและภูเขาในสายหมอก",
      coffeeCup: "น้ำผึ้งดอกกาแฟ ESHAN ข้างถ้วยกาแฟเซรามิกสีน้ำเงิน",
      ceramicBowl: "น้ำผึ้งดอกกาแฟ ESHAN กับชามเซรามิกและดอกกาแฟ",
      honeyDipper: "น้ำผึ้งดอกกาแฟ ESHAN ข้างไม้ตักน้ำผึ้งบนโต๊ะอาหารเช้า",
      coffeeLandscape: "ดอกกาแฟสีขาวและผลกาแฟสีแดงหน้าภูเขาในสายหมอก",
      morningRitual: "น้ำผึ้งไหลจากไม้ตักลงในถ้วยกาแฟ",
    },
    heroSlideLinks: {
      blossoms: "รู้จักน้ำผึ้งดอกกาแฟ ESHAN 380 กรัม",
      coffeeCup: "รู้จักน้ำผึ้งดอกกาแฟ ESHAN 380 กรัม",
      ceramicBowl: "รู้จักน้ำผึ้งดอกกาแฟ ESHAN 380 กรัม",
      honeyDipper: "รู้จักน้ำผึ้งดอกกาแฟ ESHAN 380 กรัม",
      coffeeLandscape: "เกี่ยวกับ VETRA",
      morningRitual: "อ่านวิธีเติมความหวานด้วยน้ำผึ้ง",
    },
    heroSlider: {
      carousel: "ภาพแนะนำ VETRA STORE",
      previous: "ภาพก่อนหน้า",
      next: "ภาพถัดไป",
      select: "แสดงภาพที่ {number} จาก {total}",
      status: "ภาพที่ {number} จาก {total}",
      newTab: "เปิดในแท็บใหม่",
    },
    naturalCollection: "คอลเลกชันจากธรรมชาติ",
    announcement: "สิ่งดี ๆ ที่คัดสรรด้วยใจ",
    nav: {
      home: "หน้าแรก",
      shop: "สินค้า",
      story: "เกี่ยวกับเรา",
      journal: "บทความ",
    },
    search: "ค้นหา",
    searchPlaceholder: "กำลังมองหาอะไรอยู่?",
    searchHint: "ค้นหาสินค้าและบทความที่ช่วยให้คุณเลือกได้ง่ายขึ้น",
    switchLanguage: "เปลี่ยนเป็นภาษา",
    close: "ปิด",
    menu: "เปิดเมนู",
    account: "สินค้าที่บันทึกไว้",
    cart: "ถุงช้อปปิ้ง",
    skip: "ข้ามไปยังเนื้อหา",
    footerNavLabel: "เมนูส่วนท้าย",
    shop: "เลือกซื้อสินค้า",
    links: {
      allProducts: "สินค้าทั้งหมด",
      coffeeBlossomHoney: "น้ำผึ้งดอกกาแฟ",
      contact: "ติดต่อเรา",
      shippingReturns: "การจัดส่งและคืนสินค้า",
      ourStory: "เกี่ยวกับเรา",
      theJournal: "บทความ",
    },
    copyright: "© 2026 VETRA STORE สงวนลิขสิทธิ์",
    bottom: "รวมสินค้าคุณภาพดี และคุ้มค่า",
    heroEyebrow: "VETRA คัดเลือก",
    heroTitle: ["สินค้าคุณภาพดี", "คุ้มค่ามากที่สุด"],
    heroBody:
      "VETRA เชี่ยวชาญการคัดเลือกสินค้า มาตรฐานสูง ให้ความสำคัญกับคุณภาพ และความคุ้มค่า",
    shopNow: "สินค้าของเรา",
    heroSecondary: "เกี่ยวกับเรา",
    trust: {
      productKnowledge: {
        title: "รู้จักสินค้าจริง",
        body: "เราศึกษาสินค้าทุกชิ้น อย่างละเอียด",
      },
      wholesaleRetail: {
        title: "รองรับขายส่ง และปลีก",
        body: "สอบถามจำนวนสำหรับใช้เองหรือธุรกิจของคุณ",
      },
      consultation: {
        title: "ยินดีให้คำปรึกษา",
        body: "ใส่ใจดูแล ก่อนและหลังการขาย",
      },
    },
    collectionEyebrow: "สินค้าจาก VETRA",
    collectionTitle: "รายการสินค้า",
    categories: {
      honey: {
        title: "ESHAN น้ำผึ้งดอกกาแฟ",
        sub: "น้ำผึ้งจากดอกกาแฟทางภาคเหนือของไทย",
        description:
          "น้ำผึ้งดอกกาแฟ สีอำพัน รสหวานนุ่ม พร้อมกลิ่นรสเฉพาะตัว รับประทานโดยตรง หรือเติมความหอมหวานให้อาหารและเครื่องดื่ม",
        details: ["น้ำผึ้งดอกกาแฟ 100%", "จากภาคเหนือของไทย", "ฉลากตัวอย่างมีเครื่องหมายฮาลาล โปรดยืนยันใบรับรองปัจจุบัน"],
        tag: "ดูเพิ่มเติม",
      },
      coffee: {
        title: "เมล็ดกาแฟคุณภาพดี",
        sub: "เมล็ดกาแฟที่คัดสรรสำหรับทุกแก้ว",
        description:
          "เมล็ดกาแฟที่เราเลือกจากแหล่งที่มา คุณภาพ และลักษณะรสชาติ เพื่อให้แต่ละแก้วมีเอกลักษณ์ในแบบของตัวเอง",
        details: ["เมล็ดกาแฟคัดสรร", "จากดอยวาวี"],
        tag: "ดูเพิ่มเติม",
        comingSoonLabel: "พบกัน เร็วๆนี้",
      },
      instantCoffee: {
        title: "กาแฟสำเร็จรูป",
        sub: "กาแฟรสชาติดี ชงง่าย",
        description:
          "ความสะดวกที่ไม่ลดทอนคุณภาพ เรากำลังคัดเลือกกาแฟสำเร็จรูปที่โดดเด่นทั้งรสชาติ กลิ่น และความง่ายในการดื่ม",
        details: ["ชงง่าย", "พร้อมดื่มได้ทุกวัน"],
        tag: "ดูเพิ่มเติม",
        comingSoonLabel: "พบกัน เร็วๆนี้",
      },
    },
  },
};

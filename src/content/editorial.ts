import type { Localized } from "@/lib/i18n";

export type ArticleLink = { label: string; href: string };
export type ArticleSection = {
  title: string;
  text: string;
  bullets?: readonly string[];
  links?: readonly ArticleLink[];
  image?: { src: string; alt: string; caption?: string };
  table?: { headers: readonly string[]; rows: readonly (readonly string[])[] };
};
export type ArticleCopy = {
  category: string;
  title: string;
  excerpt: string;
  intro: string;
  sections: readonly ArticleSection[];
  seoTitle?: string;
  seoDescription?: string;
  imageAlt?: string;
  socialImage?: string;
  author?: string;
  references?: readonly ArticleLink[];
};
export type JournalArticle = {
  id?: string;
  slug: string;
  previousSlugs?: readonly string[];
  image: string;
  imagePosition?: string;
  featured?: boolean;
  publishedAt?: string;
  updatedAt?: string;
  relatedProductIds?: readonly string[];
  reviewRequired?: boolean;
  editorialNotes?: string;
  content: Localized<ArticleCopy>;
};

export const journalArticles = [
  {
    slug: "how-vetra-selects-products",
    image: "/images/hero-coffee-landscape.webp",
    content: {
      th: {
        category: "เลือกสินค้า",
        title: "VETRA คัดเลือกสินค้าอย่างไร ให้คุณภาพและความคุ้มค่าไปด้วยกัน",
        excerpt: "เริ่มจากความเข้าใจสินค้า ดูรายละเอียดที่ตรวจสอบได้ และพิจารณาว่าสิ่งที่เลือกเหมาะกับการใช้งานจริงอย่างไร",
        intro: "VETRA เชี่ยวชาญการคัดเลือกสินค้า มาตรฐานสูง ให้ความสำคัญกับคุณภาพ และความคุ้มค่า สำหรับเรา การเลือกสินค้าคุณภาพดีคุ้มค่ามากที่สุดเริ่มจากการเข้าใจว่าคุณจะนำไปใช้อย่างไร บทความนี้ชวนมองหลักคิดในการเลือกสินค้า ตั้งแต่ข้อมูลพื้นฐานจนถึงรายละเอียดที่ทำให้ตัดสินใจได้ง่ายขึ้น",
        sections: [
          {
            title: "เริ่มจากสิ่งที่สินค้าควรทำให้คุณ",
            text: "ก่อนเปรียบเทียบสินค้า ลองระบุความต้องการให้ชัดเจนสักหนึ่งประโยค เช่น ต้องการน้ำผึ้งไว้เติมในอาหารเช้า หรือกำลังมองหาสินค้าสำหรับวางขายในร้าน เมื่อรู้จุดประสงค์แล้ว จะเลือกดูรายละเอียดได้ตรงประเด็นขึ้น ทั้งขนาด วิธีใช้งาน และจำนวนที่เหมาะสม หลักคิดของ VETRA คือให้ความเหมาะสมกับการใช้งานเป็นจุดเริ่มต้น เพราะสินค้าที่ดูน่าสนใจอาจยังไม่ใช่สินค้าที่ตอบโจทย์ของคุณที่สุด",
          },
          {
            title: "รู้จักสินค้าให้มากกว่าชื่อบนบรรจุภัณฑ์",
            text: "ชื่อสินค้าและภาพสวยช่วยให้เราเริ่มสนใจ แต่การตัดสินใจควรมีข้อมูลรองรับ ลองดูว่ามีการระบุส่วนประกอบ วัสดุ ขนาด ผู้ผลิต หรือแหล่งที่มาไว้อย่างไร ข้อมูลแต่ละประเภทมีความสำคัญต่างกันตามชนิดสินค้า หากข้อความระบุเพียงว่า “พรีเมียม” โดยไม่อธิบายรายละเอียด ให้ใช้เป็นจุดเริ่มต้นของคำถามแทนข้อสรุป ข้อมูลที่ชัดเจนช่วยให้เห็นว่าสินค้าสองชิ้นต่างกันตรงไหนจริง ๆ",
          },
          {
            title: "มองคุณภาพผ่านรายละเอียดที่เกี่ยวกับการใช้งาน",
            text: "คุณภาพควรถูกอธิบายให้เชื่อมกับสิ่งที่คุณจะได้ใช้ สำหรับอาหาร อาจเริ่มจากส่วนประกอบและข้อมูลบนฉลาก สำหรับสินค้าใช้งาน อาจพิจารณาวัสดุ ขนาด และวิธีดูแล เลือกดูรายละเอียดที่มีผลกับคุณจริง ๆ แล้วแยกออกจากสิ่งที่เป็นเพียงความชอบส่วนตัว เช่น สีหรือรูปทรง วิธีนี้ทำให้การเปรียบเทียบมีเหตุผลชัดเจนขึ้น โดยยังเปิดพื้นที่ให้รสนิยมของคุณเป็นส่วนหนึ่งของการตัดสินใจ",
          },
          {
            title: "ให้ข้อมูลที่ชัดเจนเป็นส่วนหนึ่งของคุณค่า",
            text: "สินค้าที่มีข้อมูลอ่านง่ายช่วยให้คุณเตรียมพร้อมได้ตั้งแต่ก่อนซื้อ ดูว่าสามารถหาคำตอบเรื่องปริมาณ วิธีใช้ การเก็บรักษา และสิ่งที่ได้รับในหนึ่งชุดได้หรือไม่ ถ้าคำอธิบายกับภาพดูไม่ตรงกัน ควรสอบถามรายละเอียดของรุ่นหรือขนาดที่จะได้รับ การรู้ข้อจำกัดของสินค้าก็มีประโยชน์พอ ๆ กับการรู้จุดเด่น เพราะช่วยให้เลือกได้อย่างเหมาะสมและลดความคลาดเคลื่อนระหว่างสิ่งที่คาดหวังกับสิ่งที่สั่ง",
          },
          {
            title: "คิดเรื่องความคุ้มค่าจากสิ่งที่จะได้ใช้จริง",
            text: "ราคาบนป้ายเป็นข้อมูลส่วนหนึ่งของความคุ้มค่า ลองดูคู่กับปริมาณ ความเหมาะสม และจำนวนที่คาดว่าจะใช้ได้จริง สินค้าขนาดใหญ่อาจมีราคาต่อหน่วยต่ำกว่า แต่ขนาดเล็กอาจเหมาะกับคนที่เพิ่งลองมากกว่า หากซื้อสำหรับธุรกิจ ควรดูทั้งจำนวนต่อแพ็กและความพร้อมในการจัดเก็บ การเลือกที่คุ้มค่าจึงเป็นการหาสัดส่วนที่ลงตัวระหว่างสิ่งที่ต้องการ สิ่งที่ได้รับ และจำนวนที่พร้อมซื้อ",
          },
          {
            title: "เลือกด้วยเหตุผลที่อธิบายได้",
            text: "ก่อนตัดสินใจ ลองสรุปให้ได้ว่าสินค้านี้เหมาะกับคุณเพราะอะไรสองหรือสามข้อ และมีข้อมูลใดที่ยังต้องถามเพิ่มเติม แนวคิดนี้สะท้อนสิ่งที่ VETRA ให้ความสำคัญ คือการคัดเลือกอย่างใส่ใจและทำให้รายละเอียดเข้าใจง่าย คุณสามารถเริ่มจากหน้าสินค้า อ่านข้อมูลประกอบ แล้วส่งคำถามพร้อมชื่อสินค้าและรูปแบบการใช้งานที่สนใจ เพื่อให้การพูดคุยตรงกับสิ่งที่คุณต้องการเลือกมากขึ้น",
          },
        ],
      },
      ar: {
        category: "اختيار المنتجات",
        title: "كيف تنظر VETRA إلى اختيار المنتجات والجودة والقيمة؟",
        excerpt: "تعرّف على المنتج، وابحث عن تفاصيل واضحة، واربط الجودة بطريقة استخدامك الفعلية له.",
        intro: "تتخصص VETRA في اختيار المنتجات مع الاهتمام بالمعايير العالية والجودة والقيمة. ويبدأ الاختيار المجدي بفهم ما تحتاج إليه من المنتج. يقوم هذا النهج على قراءة التفاصيل، والنظر إلى الاستخدام اليومي، وطرح الأسئلة قبل اتخاذ القرار. وهي خطوات عملية لمقارنة المنتجات دون الاكتفاء باسم جذّاب أو صورة جميلة.",
        sections: [
          {
            title: "ابدأ بما تحتاج إليه من المنتج",
            text: "قبل مقارنة الخيارات، لخّص احتياجك في جملة واحدة. قد تبحث عن عسل للإفطار، أو عن منتج تعرضه في متجرك. تحدد هذه البداية التفاصيل التي تستحق اهتمامك: حجم العبوة، وطريقة الاستخدام، والكمية المطلوبة. تنطلق رؤية VETRA للاختيار من هذه الصلة بين المنتج والغرض منه. فقد يعجبك منتج، مع أنه لا ينسجم جيدًا مع روتينك اليومي.",
          },
          {
            title: "انظر إلى ما وراء الاسم على العبوة",
            text: "قد يلفت الاسم والصورة انتباهك، لكن القرار يحتاج إلى مزيد من التفاصيل. ابحث عن المكوّنات أو المواد والأبعاد والجهة المصنّعة والمنشأ المعلن، بحسب نوع المنتج. فلكل فئة معلوماتها المهمة. وكلمة مثل «فاخر» تدعوك إلى السؤال عمّا يميّز المنتج، لكنها لا تجيب وحدها. يساعدك الوصف الواضح على معرفة الفروق الفعلية بين خيارين قبل مقارنة أسعارهما.",
          },
          {
            title: "اربط الجودة بالتفاصيل العملية",
            text: "تصبح مناقشة الجودة أوضح حين ترتبط بما ستستخدمه فعلًا. في الأغذية، قد تبدأ بالمكوّنات المذكورة والمعلومات على العبوة. وفي المنتجات الأخرى، قد تكون المواد والأبعاد ومتطلبات العناية أكثر فائدة. ميّز هذه التفاصيل العملية عن تفضيلاتك الشخصية، كاللون أو الشكل. كلاهما قد يكون مهمًا، لكن فهم الفرق يساعدك على توضيح سبب ملاءمة المنتج لك، والتنازلات التي تقبل بها.",
          },
          {
            title: "اجعل وضوح المعلومات جزءًا من تجربة الشراء",
            text: "يساعدك الوصف المفيد على الاستعداد قبل الشراء. تحقّق من الكمية وطريقة الاستخدام وتعليمات الحفظ ومحتويات المجموعة. وإذا بدا أن الصور والوصف مختلفان، فاسأل عن الإصدار أو الحجم الذي ستستلمه تحديدًا. وقد تكون معرفة حدود المنتج مفيدة بقدر معرفة مزاياه؛ فهي تقرّب توقعاتك مما تفكر في شرائه، وتكشف الأسئلة التي ما زالت بحاجة إلى إجابة.",
          },
          {
            title: "قيّم ما ستستفيد منه فعلًا",
            text: "السعر المعروض عنصر واحد من عناصر القيمة. انظر إليه مع الكمية والملاءمة وما تتوقع استخدامه. قد يكون سعر الوحدة أقل في العبوة الكبيرة، بينما تلائم العبوة الصغيرة تجربتك الأولى أكثر. وعند الشراء لنشاط تجاري، تهم أيضًا أعداد الوحدات في العبوة ومساحة التخزين. يجمع الاختيار المجدي بين ما تحتاجه، وما يتضمنه العرض، والكمية التي تنوي شراءها، دون اختزال القرار في رقم واحد.",
          },
          {
            title: "اختر لأسباب تستطيع توضيحها",
            text: "قبل أن تقرر، حدّد سببين أو ثلاثة لملاءمة المنتج لك، وسجّل ما تحتاج إلى الاستفسار عنه. يعكس ذلك اهتمام VETRA بالاختيار المدروس والمعلومات المفهومة. ابدأ بصفحة المنتج، واقرأ التفاصيل، ثم أرسل سؤالك مع اسم المنتج والاستخدام المقصود. يساعد الوصف الواضح لاحتياجك على حوار أكثر فائدة، سواء اخترت منتجًا للمنزل أو خططت لمشتريات نشاطك التجاري.",
          },
        ],
      },
      en: {
        category: "Product selection",
        title: "How VETRA thinks about product selection, quality, and value",
        excerpt: "Understand the product, look for clear details, and connect quality with the way you will actually use it.",
        intro: "VETRA specialises in selecting products with high standards, quality, and value in mind. A worthwhile choice begins with understanding what you need from it. These are the principles behind that approach: read the details, consider everyday use, and make room for questions before deciding. They offer a practical way to compare products without relying on a name or an attractive photograph alone.",
        sections: [
          {
            title: "Begin with what the product should do for you",
            text: "Before comparing options, describe your need in one sentence. You might want honey for breakfast, or a product to stock in your shop. That starting point tells you which details deserve attention: the pack size, how it will be used, and the quantity you need. VETRA’s selection perspective begins with this connection between a product and its purpose. Something can be appealing while still being an awkward fit for your own routine.",
          },
          {
            title: "Look beyond the name on the packaging",
            text: "A name and a photograph can spark interest, but a decision needs more detail. Look for the ingredient or material, dimensions, maker, and stated origin where relevant. Different categories call for different information. A word such as “premium” is a useful reason to ask what distinguishes the product; it does not answer that question by itself. Clear descriptions help you identify the actual differences between two options before you compare their prices.",
          },
          {
            title: "Connect quality with practical details",
            text: "Quality becomes easier to discuss when it relates to something you will use. For food, that can begin with the listed ingredients and packaging information. For other products, materials, dimensions, and care requirements may be more useful. Separate those practical details from personal preferences such as colour or shape. Both can matter, but knowing which is which helps you explain why a product suits you and which compromises you are comfortable making.",
          },
          {
            title: "Treat clear information as part of the experience",
            text: "A useful product description helps you prepare before buying. Check whether you can find the quantity, directions, storage information, and contents of a set. If photographs and descriptions seem to differ, ask about the exact version or size you would receive. Understanding a limitation can be just as helpful as understanding a selling point. It makes it easier to align your expectations with the item you are considering and to spot any unanswered questions.",
          },
          {
            title: "Consider the value you will actually use",
            text: "The displayed price is one part of value. Consider it alongside quantity, suitability, and how much you expect to use. A larger pack may cost less per unit, while a smaller one may suit a first purchase better. For a business order, pack quantities and available storage also matter. A worthwhile choice brings together what you need, what is included, and the amount you are ready to buy, rather than treating one number as the whole decision.",
          },
          {
            title: "Choose for reasons you can explain",
            text: "Before deciding, name two or three reasons the product suits you and note anything you still need to ask. This reflects VETRA’s emphasis on thoughtful selection and understandable information. Start with the product page, read the supporting details, and share a question with the product name and your intended use. A clear brief makes the conversation more useful, whether you are choosing one item for home or planning a purchase for your business.",
          },
        ],
      },
    },
  },
  {
    slug: "read-product-labels",
    image: "/images/honey-back.jpg",
    imagePosition: "center",
    content: {
      th: {
        category: "รู้จักสินค้า",
        title: "อ่านฉลากสินค้าอย่างไร ให้ได้ข้อมูลที่ช่วยตัดสินใจ",
        excerpt: "วิธีดูชื่อสินค้า ปริมาณ ส่วนประกอบ และคำแนะนำ โดยใช้ฉลากเป็นจุดเริ่มต้นของการเลือกอย่างเข้าใจ",
        intro: "ฉลากมีรายละเอียดมากกว่าชื่อและภาพหน้ากระปุก การอ่านอย่างเป็นลำดับช่วยให้คุณเห็นสิ่งที่ได้รับจริง และรู้ว่าควรถามอะไรเพิ่มเติม ไม่จำเป็นต้องอ่านทุกบรรทัดพร้อมกัน เริ่มจากข้อมูลที่เกี่ยวกับสิ่งที่คุณกำลังจะซื้อ แล้วค่อยตรวจสอบรายละเอียดให้ครบก่อนตัดสินใจ",
        sections: [
          {
            title: "ตรวจชื่อและรุ่นให้ตรงกับสินค้าที่ต้องการ",
            text: "เริ่มจากชื่อเต็ม รุ่น รสชาติ หรือรูปแบบของสินค้า โดยเฉพาะเมื่อบรรจุภัณฑ์หลายรุ่นดูคล้ายกัน เปรียบเทียบชื่อบนภาพกับตัวเลือกที่กำลังสั่ง หากมีหลายขนาด อย่าใช้ภาพเพียงอย่างเดียวคาดเดาขนาดจริง ลองจดชื่อและขนาดไว้ด้วยกัน เช่น น้ำผึ้งดอกกาแฟ ESHAN 380 กรัม วิธีนี้ช่วยให้ส่งคำถามหรือทบทวนรายการสั่งซื้อได้ตรงกับสินค้าที่สนใจ และช่วยแยกสินค้าที่หน้าตาคล้ายกันได้ง่ายขึ้น",
          },
          {
            title: "ดูปริมาณและหน่วยให้เป็นเรื่องเดียวกัน",
            text: "สังเกตว่าสินค้าระบุเป็นกรัม มิลลิลิตร ชิ้น หรือชุด และราคานั้นครอบคลุมจำนวนเท่าไร หนึ่งกล่องอาจมีหลายชิ้น ส่วนหนึ่งชุดอาจมีของหลายประเภท หากต้องการเปรียบเทียบราคา ควรใช้หน่วยเดียวกันและดูว่าสินค้ามีลักษณะใกล้เคียงกันหรือไม่ ตัวอย่างเช่น ควรเทียบน้ำหนักกับน้ำหนัก ไม่ใช้ขนาดกระปุกในภาพแทนปริมาณสินค้า เมื่อหน่วยชัดเจนแล้ว การเปรียบเทียบจะทำได้ตรงประเด็นขึ้น",
          },
          {
            title: "อ่านส่วนประกอบหรือรายละเอียดของวัสดุ",
            text: "สำหรับอาหาร ให้ดูส่วนประกอบที่ระบุบนฉลากจริง สำหรับสินค้าใช้งาน ให้ดูข้อมูลวัสดุและรายละเอียดที่มีผลกับวิธีใช้ อ่านถ้อยคำตามที่ระบุโดยไม่เติมความหมายเอง เช่น ชื่อที่สื่อถึงแหล่งที่มาไม่ได้อธิบายส่วนประกอบทั้งหมดโดยอัตโนมัติ หากมีเงื่อนไขเฉพาะในการเลือกของคุณ ให้ตรวจสอบข้อมูลส่วนนั้นโดยตรง และสอบถามผู้ขายเมื่อยังไม่พบคำตอบที่ชัดเจน แทนการสรุปจากภาพหรือชื่อเรียกเพียงอย่างเดียว",
          },
          {
            title: "คำแนะนำบอกว่าสินค้าเข้ากับการใช้งานหรือไม่",
            text: "วิธีใช้และวิธีเก็บรักษาช่วยให้เห็นสิ่งที่ต้องเตรียมหลังซื้อ ลองดูว่ามีพื้นที่จัดเก็บเหมาะสมหรือไม่ และขั้นตอนใช้งานเข้ากับชีวิตประจำวันของคุณเพียงใด หากต้องซื้อหลายชิ้นสำหรับร้านค้า ควรอ่านคำแนะนำก่อนวางแผนพื้นที่เก็บด้วย อย่าคาดว่าของหน้าตาคล้ายกันจะใช้หรือดูแลเหมือนกันทั้งหมด ให้ยึดคำแนะนำของสินค้ารุ่นที่กำลังเลือก และเก็บข้อมูลนั้นไว้ใช้อ้างอิง",
          },
          {
            title: "วันที่และเลขล็อตต้องดูจากชิ้นที่ได้รับ",
            text: "หากมีวันผลิต วันหมดอายุ หรือเลขล็อต ให้ตรวจสอบบนบรรจุภัณฑ์จริงเมื่อได้รับสินค้า ภาพบนเว็บไซต์ใช้แสดงตัวสินค้า จึงไม่ควรนำวันที่ในภาพไปสรุปว่าเป็นวันที่ของสินค้าที่จะจัดส่ง หากช่วงวันที่มีผลกับการสั่งซื้อ โดยเฉพาะการซื้อจำนวนมาก ควรถามข้อมูลของสินค้าที่พร้อมจัดส่งก่อนยืนยันคำสั่งซื้อ เก็บภาพฉลากและเลขล็อตไว้หากจำเป็นต้องสอบถามรายละเอียดภายหลัง",
          },
          {
            title: "เปลี่ยนสิ่งที่ยังไม่ชัดให้เป็นคำถามสั้น ๆ",
            text: "เมื่ออ่านแล้ว ลองสรุปสามเรื่องให้ได้ว่าเป็นสินค้าอะไร ได้รับปริมาณเท่าไร และต้องใช้งานหรือจัดเก็บอย่างไร หากยังมีช่องว่าง ให้ถามอย่างเฉพาะเจาะจง เช่น “ราคานี้รวมกี่กระปุก” หรือ “ขอภาพฉลากด้านหลังที่อ่านได้ชัดเจน” การแนบชื่อสินค้าและส่วนที่ต้องการทราบช่วยให้ตอบได้ตรงประเด็น สำหรับ VETRA ข้อมูลที่ชัดเจนเป็นส่วนสำคัญของการเลือกสินค้าที่มีคุณภาพและเหมาะกับคุณ",
          },
        ],
      },
      ar: {
        category: "معرفة المنتجات",
        title: "كيف تقرأ ملصق المنتج قبل الشراء؟",
        excerpt: "افهم الأسماء والكميات والمكوّنات والتعليمات، وحوّل التفاصيل الناقصة إلى أسئلة مفيدة.",
        intro: "يحتوي الملصق على أكثر من اسم المنتج وصورته. وقراءته بترتيب بسيط تساعدك على معرفة ما ستستلمه وما لا يزال بحاجة إلى استفسار. ابدأ بالمعلومات التي تحدد المنتج، ثم اربط بقية التفاصيل باستخدامك المقصود. لا تحتاج إلى قراءة كل سطر دفعة واحدة لتجري مقارنة أكثر وعيًا.",
        sections: [
          {
            title: "طابق الاسم والإصدار مع اختيارك",
            text: "ابدأ بالاسم الكامل أو الإصدار أو النكهة أو الشكل، خاصة عندما تتشابه العبوات. قارن الملصق المصوّر بالخيار الذي تريد شراءه. وإذا توفرت أحجام متعددة، فلا تقدّر الكمية من الصورة وحدها. دوّن الاسم والحجم معًا، مثل عسل أزهار القهوة من ESHAN، بوزن 380 غرامًا. يصبح لديك بذلك مرجع واضح عند الاستفسار أو مراجعة الطلب أو مقارنة منتجات ذات عبوات متشابهة.",
          },
          {
            title: "افهم الكمية ووحدة قياسها",
            text: "تحقّق مما إذا كانت الكمية بالغرام أو الملليلتر أو القطع أو المجموعات، ومن عدد الوحدات التي يشملها السعر المعروض. فقد يحتوي الصندوق على قطع متعددة، بينما تجمع المجموعة منتجات مختلفة. للمقارنة المفيدة، استخدم وحدة قياس واحدة ومنتجات قابلة للمقارنة. قارن الوزن بالوزن مثلًا، ولا تعتبر حجم العبوة الظاهر في الصورة دليلًا على كمية المنتج. وضوح الوحدات يسهّل الخطوة التالية.",
          },
          {
            title: "اقرأ تفاصيل المكوّنات أو المواد",
            text: "في الأغذية، راجع المكوّنات المذكورة على الملصق الفعلي. وفي المنتجات الأخرى، انظر إلى المواد والمواصفات التي تؤثر في الاستخدام. اقرأ النص كما ورد دون إضافة افتراضات؛ فالاسم الذي يوحي بمنشأ معين لا يشرح بالضرورة جميع المكوّنات. إذا كانت معلومة بعينها مهمة لاختيارك، فابحث عنها مباشرة، واسأل البائع عند غيابها بدل افتراض أن الصورة أو الاسم يقدّمان الإجابة.",
          },
          {
            title: "استعن بالتعليمات لتقييم الملاءمة اليومية",
            text: "تساعدك تعليمات الاستخدام والحفظ على الاستعداد لاقتناء المنتج. فكّر في توافر مكان مناسب لحفظه، وفي مدى انسجام استخدامه مع روتينك. وإذا كنت تشتري عدة وحدات لمتجرك، فاقرأ هذه التفاصيل قبل تخطيط مساحة التخزين. قد تختلف تعليمات منتجات تبدو متشابهة، لذا ارجع إلى الإصدار الذي تختاره، واحتفظ بالتعليمات، واطلب التوضيح إذا لم تفهم خطوة أو متطلبًا.",
          },
          {
            title: "تحقّق من التواريخ والتشغيلة على المنتج الذي تستلمه",
            text: "عند وجود تاريخ تصنيع أو انتهاء صلاحية أو رقم تشغيلة، تحقّق منه على العبوة الفعلية عند وصول طلبك. صور الموقع تعرّف بالمنتج، ولا ينبغي اعتبار التواريخ الظاهرة فيها تواريخ المنتج الذي سيُرسل إليك. إذا كان التوقيت مهمًا لطلبك، وخاصة للكميات الكبيرة، فاستفسر عن المخزون المتاح قبل التأكيد. واحتفظ بصورة للملصق ورقم التشغيلة إذا احتجت إلى طرح سؤال لاحقًا.",
          },
          {
            title: "حوّل المعلومة غير الواضحة إلى سؤال محدد",
            text: "بعد القراءة، حاول توضيح ماهية المنتج وكميته وطريقة استخدامه أو حفظه. وحوّل أي نقص إلى سؤال قصير، مثل: «كم عبوةً يشمل هذا السعر؟» أو «هل يمكنني رؤية صورة أوضح للملصق الخلفي؟». اذكر اسم المنتج والتفصيل الذي تحتاجه. في VETRA، نعدّ وضوح المعلومات جزءًا من مساعدتك على اختيار منتج جيد يناسب احتياجاتك.",
          },
        ],
      },
      en: {
        category: "Product knowledge",
        title: "How to read a product label before you buy",
        excerpt: "Make sense of names, quantities, ingredients, and instructions, then turn missing details into useful questions.",
        intro: "A label contains more than a product name and a photograph. Reading it in a simple order helps you understand what you would receive and what you still need to ask. Begin with the details that identify your item, then connect the remaining information with your intended use. You do not need to read every line at once to make a more informed comparison.",
        sections: [
          {
            title: "Match the name and version to your selection",
            text: "Start with the full name, version, flavour, or format, especially when several packages look alike. Compare the photographed label with the option you are selecting. If multiple sizes are available, do not judge quantity from the photograph alone. Note the name and size together, such as ESHAN coffee blossom honey, 380 g. This gives you a clear reference when asking a question, reviewing your order, or comparing products that use similar packaging.",
          },
          {
            title: "Understand the quantity and its unit",
            text: "Check whether the quantity is given in grams, millilitres, pieces, or sets, and how many items the displayed price includes. A box may contain several pieces, while a set may combine different items. For a useful price comparison, use the same unit and comparable products. Compare weight with weight, for example, rather than treating the apparent jar size in a photograph as the amount of product. Clear units make the next step much simpler.",
          },
          {
            title: "Read the ingredients or material details",
            text: "For food, look at the ingredients listed on the actual label. For other products, consider the materials and specifications that affect use. Read the wording as stated without adding assumptions: a name that suggests an origin does not automatically explain every ingredient. If a particular detail matters to your choice, find that information directly. Ask the seller when it is missing instead of assuming that the photograph or the product name provides the answer.",
          },
          {
            title: "Use the instructions to assess everyday fit",
            text: "Directions and storage information help you prepare for ownership. Consider whether you have a suitable place to keep the product and whether its use fits your routine. If you are buying several items for a shop, read these details before planning storage space. Similar looking products may have different instructions. Refer to the version you are choosing, keep those instructions available, and ask for clarification when a step or requirement is not clear.",
          },
          {
            title: "Check dates and batch details on the item received",
            text: "Where manufacture dates, expiry dates, or lot numbers are provided, check the actual packaging when your order arrives. Website photographs illustrate a product; dates shown in them should not be treated as the dates of the item that will be dispatched. If timing matters to your order, particularly a larger purchase, ask about the available stock before confirming. Keep a photograph of the label and lot number if you need to raise a later question.",
          },
          {
            title: "Turn an unclear detail into a precise question",
            text: "After reading, try to explain what the product is, how much is included, and how it should be used or stored. Turn any gap into a short question: “How many jars does this price include?” or “Can I see a clearer photograph of the back label?” Include the product name and the detail you need. At VETRA, understandable information is part of helping you choose a quality product that suits your needs.",
          },
        ],
      },
    },
  },
  {
    slug: "compare-quality-and-value",
    image: "/images/hero-eshan-2.webp",
    content: {
      th: {
        category: "เลือกสินค้า",
        title: "เลือกสินค้าให้คุ้มค่า เปรียบเทียบอะไรนอกจากราคา",
        excerpt: "ใช้ปริมาณ รายละเอียด และการใช้งานจริงมาช่วยเปรียบเทียบ พร้อมตัวอย่างคำนวณราคาต่อหน่วยแบบง่าย ๆ",
        intro: "สินค้าราคาต่างกันอาจให้สิ่งที่ต่างกันด้วย การเปรียบเทียบที่มีประโยชน์จึงเริ่มจากดูว่าราคาแต่ละรายการรวมอะไร และสิ่งนั้นตรงกับความต้องการมากน้อยแค่ไหน VETRA ให้ความสำคัญกับคุณภาพและความคุ้มค่าควบคู่กัน หลักคิดต่อไปนี้ช่วยให้คุณหาข้อสรุปที่เหมาะกับการซื้อครั้งนั้นได้ชัดเจนขึ้น",
        sections: [
          {
            title: "ตั้งเกณฑ์สำคัญก่อนเปิดหลายตัวเลือก",
            text: "เขียนสิ่งที่จำเป็นกับการใช้งานไว้สักสามข้อ เช่น ส่วนประกอบที่ต้องการ ขนาดที่จัดเก็บได้ และจำนวนที่จะใช้ แยกสิ่งที่จำเป็นออกจากสิ่งที่อยากได้เพิ่มเติม เมื่อเปิดสินค้าหลายรายการ คุณจะใช้เกณฑ์เดียวกันเทียบได้โดยไม่เปลี่ยนใจตามจุดเด่นของแต่ละชิ้นตลอดเวลา หากสินค้าหนึ่งไม่ผ่านข้อที่จำเป็น ก็ควรพิจารณาข้อนั้นก่อนสนใจความต่างของราคา เพราะราคาเพียงอย่างเดียวไม่ได้บอกว่าจะใช้งานได้ตรงเป้าหมายหรือไม่",
          },
          {
            title: "เทียบราคาต่อหน่วย เมื่อสินค้าเทียบกันได้",
            text: "คำนวณง่าย ๆ ด้วยราคาหารด้วยปริมาณ เช่น ตัวอย่างสมมติ สินค้า 200 กรัม ราคา 160 บาท เท่ากับ 0.80 บาทต่อกรัม ส่วนสินค้า 380 กรัม ราคา 266 บาท เท่ากับ 0.70 บาทต่อกรัม ตัวเลขนี้เป็นเพียงตัวอย่าง ไม่ใช่ราคาสินค้าของ VETRA ก่อนใช้ผลเปรียบเทียบ ควรดูว่าส่วนประกอบ ลักษณะสินค้า และสิ่งที่รวมอยู่ใกล้เคียงกันหรือไม่ ราคาต่อหน่วยช่วยตอบเรื่องปริมาณ แต่ยังไม่ตอบเรื่องความเหมาะสมทั้งหมด",
          },
          {
            title: "ขนาดที่เหมาะอาจต่างกันในแต่ละคน",
            text: "ลองคิดว่าจะใช้สินค้าบ่อยแค่ไหนและมีพื้นที่เก็บเท่าไร ขนาดใหญ่ที่ดูคุ้มต่อหน่วยอาจเกินความต้องการของคนที่เพิ่งลอง ส่วนการซื้อให้ร้านค้าควรพิจารณาจำนวนต่อแพ็กให้สัมพันธ์กับการใช้งานหรือการวางขาย หากยังไม่เคยใช้สินค้า การเริ่มจากจำนวนที่ประเมินได้ง่ายช่วยให้คุณรู้จักสินค้าและวางแผนครั้งต่อไปจากประสบการณ์จริง แทนการเลือกจำนวนมากเพียงเพราะเห็นความต่างของราคาต่อหน่วย",
          },
          {
            title: "ระบุให้ได้ว่ารายละเอียดที่เพิ่มมามีประโยชน์อย่างไร",
            text: "เมื่อสินค้าหนึ่งมีราคาสูงกว่า ลองดูว่าต่างกันที่ส่วนประกอบ วัสดุ รูปแบบบรรจุ หรือสิ่งที่รวมในชุดหรือไม่ จากนั้นถามต่อว่าความต่างนั้นมีประโยชน์กับคุณจริงหรือเปล่า บรรจุภัณฑ์ที่เหมาะกับการให้เป็นของขวัญอาจเป็นข้อดีสำหรับบางโอกาส แต่ไม่ใช่สิ่งจำเป็นในการซื้อใช้ประจำ การอธิบายเหตุผลเช่นนี้ช่วยให้เลือกคุณสมบัติที่พร้อมจ่ายได้ชัดเจน โดยไม่ต้องสรุปว่าสินค้าราคาแพงกว่าจะเหมาะกว่าเสมอ",
          },
          {
            title: "ตรวจรายละเอียดของคำสั่งซื้อให้ครบ",
            text: "ก่อนตัดสินใจ ดูว่าราคาที่กำลังเปรียบเทียบครอบคลุมจำนวนเดียวกันหรือไม่ และมีข้อมูลการจัดส่งที่ต้องพิจารณาเพิ่มเติมอย่างไร สอบถามเงื่อนไขที่มีผลกับคุณ เช่น จำนวนต่อกล่องหรือเวลาที่คาดว่าจะส่งได้ ใช้ข้อมูลของคำสั่งซื้อจริงในเวลานั้น แทนการอ้างอิงจากภาพเก่าหรือประสบการณ์ของรายการอื่น การมีรายละเอียดครบช่วยให้เห็นภาพสิ่งที่จะได้รับและทำให้เปรียบเทียบตัวเลือกได้ตรงกันมากขึ้น",
          },
          {
            title: "สรุปการเปรียบเทียบให้เหลือสิ่งที่สำคัญ",
            text: "ทำตารางสั้น ๆ หรือจดสามบรรทัด ได้แก่ สิ่งที่จำเป็น สิ่งที่แต่ละตัวเลือกให้ได้ และคำถามที่ยังไม่มีคำตอบ คุณอาจพบว่าสองรายการมีคุณสมบัติใกล้เคียงกัน แต่ขนาดหนึ่งเข้ากับการใช้งานมากกว่า ความคุ้มค่าที่ดีสำหรับคุณจึงอธิบายได้ด้วยเหตุผล หากต้องการข้อมูลประกอบจาก VETRA ให้ส่งชื่อสินค้า ขนาด และจำนวนที่สนใจ เพื่อเริ่มต้นเปรียบเทียบจากข้อมูลชุดเดียวกัน",
          },
        ],
      },
      ar: {
        category: "اختيار المنتجات",
        title: "كيف تقارن قيمة المنتجات بما يتجاوز السعر؟",
        excerpt: "أدخل الكمية والتفاصيل المفيدة والملاءمة اليومية في المقارنة، مع مثال بسيط لحساب سعر الوحدة.",
        intro: "قد تتضمن الأسعار المختلفة أشياء مختلفة. تبدأ المقارنة المفيدة بفهم ما يقدّمه كل خيار ومدى توافقه مع احتياجاتك. تنظر VETRA إلى الجودة والقيمة معًا. وتساعدك الأسئلة العملية التالية على مقارنة ما تفكر في شرائه بوضوح، سواء كان منتجًا صغيرًا للاستخدام اليومي أو كمية أكبر لمتجرك.",
        sections: [
          {
            title: "حدّد أولوياتك قبل مقارنة الخيارات",
            text: "دوّن ثلاثة متطلبات، مثل المكوّن الذي تريده، وحجم يمكنك تخزينه، والكمية التي تتوقع استخدامها. افصل الضروريات عن الإضافات التي تعجبك. يمنحك ذلك مرجعًا ثابتًا أثناء تصفّح صفحات المنتجات، بدل تغيير معاييرك مع كل ميزة جديدة. وإذا غاب متطلب أساسي عن أحد الخيارات، فضع ذلك في حسابك قبل السعر. فالسعر وحده لا يخبرك إن كان المنتج يحقق غرضك.",
          },
          {
            title: "قارن سعر الوحدة بين منتجات متقاربة",
            text: "اقسم السعر على الكمية. في مثال توضيحي، تبلغ تكلفة الغرام 0.80 بات في منتج وزنه 200 غرام وسعره 160 باتًا، بينما تبلغ 0.70 بات في منتج وزنه 380 غرامًا وسعره 266 باتًا. هذه أرقام توضيحية وليست أسعار VETRA. وقبل اعتماد النتيجة، تحقّق من تقارب المكوّنات ونوع المنتج وما يشمله العرض. يجيب سعر الوحدة عن سؤال الكمية، لكنه لا يحسم كل ما يتعلق بالملاءمة أو الجودة.",
          },
          {
            title: "اختر كمية تناسب استخدامك الفعلي",
            text: "فكّر في تكرار استخدام المنتج ومساحة التخزين المتاحة. قد تتجاوز العبوة الكبيرة ذات سعر الوحدة الأقل حاجة من يجرّب المنتج للمرة الأولى. وللمتجر، انظر إلى تناسب كمية العبوة مع الاستخدام أو العرض الذي تخطط له. البدء بكمية يمكنك تقييمها يساعدك على بناء المشتريات اللاحقة على التجربة، بدل اختيار كمية أكبر لمجرد انخفاض سعر الوحدة.",
          },
          {
            title: "حدّد فائدة التفاصيل الإضافية",
            text: "عندما يكون أحد المنتجات أغلى، ابحث عن الفروق في المكوّنات أو المواد أو التغليف أو محتويات المجموعة، ثم اسأل إن كانت مفيدة لك. قد يكون التغليف المناسب للإهداء مهمًا في مناسبة معينة، لكنه يضيف القليل إلى شراء معتاد للمنزل. توضيح الفائدة بكلماتك يساعدك على اختيار الخصائص التي تقدّرها، دون افتراض أن السعر الأعلى يعني ملاءمة أفضل في جميع الحالات.",
          },
          {
            title: "راجع تفاصيل الطلب الفعلي",
            text: "تحقّق من أن الأسعار التي تقارنها تغطي الكمية نفسها، وحدّد تفاصيل التوصيل التي لا تزال بحاجة إلى مراجعة. اسأل عمّا يؤثر في اختيارك، مثل عدد الوحدات في الصندوق أو موعد الإرسال المتوقع. استخدم معلومات حديثة للطلب المقترح، بدل صورة قديمة أو تفاصيل شراء سابق. فالوصف الكامل للطلب يسهّل مقارنة ما ستستلمه فعلًا.",
          },
          {
            title: "اختصر المقارنة في الأمور المهمة",
            text: "أنشئ جدولًا صغيرًا أو دوّن ثلاث نقاط: ما تحتاجه، وما يقدّمه كل خيار، والأسئلة التي لم تجد لها إجابة. قد تكتشف أن منتجين متشابهان في الخصائص، لكن أحدهما يأتي بحجم أنسب. عندها يصبح تقييم القيمة قرارًا يمكنك شرحه. وإذا احتجت إلى معلومات من VETRA، فأرسل اسم المنتج والحجم والكمية التي تفكر فيها، لنبدأ الحوار من التفاصيل نفسها.",
          },
        ],
      },
      en: {
        category: "Product selection",
        title: "How to compare product value beyond the price tag",
        excerpt: "Bring quantity, useful details, and everyday fit into your comparison, with a simple unit-price example.",
        intro: "Different prices can include different things. A useful comparison begins with understanding what each option offers and how closely it matches your needs. VETRA considers quality and value together. These practical questions help you make a clear comparison for the purchase in front of you, whether you are choosing a small everyday item or considering a larger quantity for your shop.",
        sections: [
          {
            title: "Set your priorities before comparing options",
            text: "Write down three requirements, such as the ingredient you want, a size you can store, and the quantity you expect to use. Separate essential requirements from appealing extras. This gives you a consistent reference as you open different product pages, instead of changing your criteria with each new selling point. If an option misses an essential requirement, consider that before its price. The price alone cannot tell you whether it will serve your purpose.",
          },
          {
            title: "Compare unit prices when products are comparable",
            text: "Divide the price by the quantity. In an illustrative example, a 200 g item at 160 baht costs 0.80 baht per gram, while a 380 g item at 266 baht costs 0.70 baht per gram. These are example figures, not VETRA prices. Before using the result, check whether the ingredients, product type, and included items are comparable. A unit price answers a quantity question; it does not settle every question about suitability or quality.",
          },
          {
            title: "Choose a quantity that fits your actual use",
            text: "Consider how often you will use the product and how much storage space you have. A large pack with a lower unit price may exceed the needs of someone trying an item for the first time. For a shop, consider how the pack quantity fits your intended use or display. Starting with an amount you can assess helps you plan later purchases from experience, instead of choosing a larger quantity solely because of its unit price.",
          },
          {
            title: "Identify the benefit of an added detail",
            text: "When one product costs more, look for differences in ingredients, materials, packaging, or the contents of a set. Then ask whether those differences are useful to you. Packaging suitable for a gift may matter on one occasion while adding little to a routine purchase for home. Explaining the benefit in your own words helps you choose the features you value without assuming that a higher price automatically means a better fit for every situation.",
          },
          {
            title: "Review the details of the actual order",
            text: "Check whether the prices you are comparing cover the same quantity and which delivery details still need to be considered. Ask about anything that affects your choice, such as the number of items in a box or the expected dispatch timing. Use current information for the proposed order rather than an old photograph or details from a different purchase. A complete description of the order makes it easier to compare what you would receive.",
          },
          {
            title: "Reduce the comparison to what matters",
            text: "Make a short table or write three notes: what you need, what each option provides, and which questions remain unanswered. You may find that two products have similar features but one comes in a more suitable size. Value then becomes a choice you can explain. If you need supporting information from VETRA, share the product name, size, and quantity you are considering so the conversation begins with the same set of details.",
          },
        ],
      },
    },
  },
  {
    slug: "choose-products-for-everyday-use",
    image: "/images/hero-honey-ritual.webp",
    content: {
      th: {
        category: "ใช้และดูแล",
        title: "เลือกสินค้าที่ใช้ได้จริง เริ่มจากชีวิตประจำวันของคุณ",
        excerpt: "มองเวลา พื้นที่ และวิธีใช้งาน เพื่อเลือกสิ่งที่เข้ากับวันธรรมดาและมีโอกาสได้ใช้อย่างตั้งใจ",
        intro: "สินค้าที่ดีสำหรับชีวิตประจำวันควรเข้ากับสิ่งที่คุณทำอยู่แล้ว ลองเริ่มจากภาพการใช้งานจริงแทนการมองเฉพาะภาพสินค้าสวย ๆ คุณจะใช้เมื่อไร เก็บไว้ที่ไหน และต้องเตรียมอะไรบ้าง คำถามธรรมดาเหล่านี้ช่วยให้เห็นรายละเอียดที่มีผลกับความสะดวก ความพอใจ และความคุ้มค่าของสิ่งที่เลือก",
        sections: [
          {
            title: "เริ่มจากช่วงเวลาที่จะได้ใช้",
            text: "นึกถึงหนึ่งสถานการณ์ที่ชัดเจน เช่น เตรียมอาหารเช้าก่อนไปทำงาน จัดของบนโต๊ะ หรือเตรียมสินค้าไว้บริการลูกค้า แล้วลองอธิบายว่าของชิ้นนี้จะเข้าไปอยู่ตรงไหนในขั้นตอนนั้น หากต้องเปลี่ยนหลายอย่างเพื่อให้ได้ใช้ อาจต้องคิดต่อว่าคุณอยากเปลี่ยนกิจวัตรจริงหรือไม่ การเริ่มจากช่วงเวลาที่มีอยู่แล้วช่วยให้มองสินค้าอย่างเป็นรูปธรรม และเลือกดูคุณสมบัติที่จำเป็นได้ง่ายขึ้น",
          },
          {
            title: "เลือกความสะดวกที่เข้ากับจังหวะของคุณ",
            text: "ความสะดวกของแต่ละคนไม่เหมือนกัน บางคนพร้อมเตรียมหลายขั้นตอนในวันหยุด แต่ต้องการวิธีง่าย ๆ ในวันทำงาน อ่านวิธีใช้แล้วลองประเมินว่าต้องเตรียมอุปกรณ์หรือทำความสะอาดเพิ่มเติมมากน้อยแค่ไหน ถ้าใช้ร่วมกับคนอื่น ควรดูด้วยว่าทุกคนเข้าใจวิธีใช้ได้ตรงกันหรือไม่ เลือกรูปแบบที่คุณยินดีทำซ้ำ เพื่อให้สินค้าเป็นส่วนหนึ่งของกิจวัตรได้อย่างเป็นธรรมชาติ",
          },
          {
            title: "ดูพื้นที่จริงก่อนเลือกขนาด",
            text: "ตรวจว่าชั้นวาง ตู้ หรือพื้นที่ใช้งานรองรับขนาดที่ต้องการได้หรือไม่ โดยดูข้อมูลขนาดที่ระบุแทนการกะจากภาพ สำหรับสินค้าอาหาร ควรอ่านคำแนะนำการเก็บรักษาควบคู่ไปด้วย หากซื้อเป็นแพ็ก ให้นับพื้นที่ของทั้งแพ็ก ไม่ใช่เฉพาะหนึ่งชิ้น ขนาดที่พอดีกับพื้นที่ช่วยให้หยิบใช้และจัดของได้สะดวกขึ้น และช่วยให้รู้จำนวนที่เหมาะสมก่อนเริ่มสั่งซื้อ",
          },
          {
            title: "ให้ความชอบมีรายละเอียดที่อธิบายได้",
            text: "ลองแยกว่าคุณชอบสินค้าตรงรูปลักษณ์ รสชาติที่คุ้นเคย หรือวิธีใช้งาน หากยังไม่เคยลอง ไม่จำเป็นต้องคาดเดาประสบการณ์ทั้งหมดจากคำบรรยาย เลือกดูข้อมูลพื้นฐานที่ตรวจสอบได้ก่อน แล้วเริ่มจากปริมาณที่เหมาะกับการทดลองใช้ สำหรับอาหาร คุณอาจลองกับเมนูที่คุ้นเคยเพื่อดูว่าเข้ากับความชอบหรือไม่ ประสบการณ์ของคุณเองจะช่วยบอกได้ว่าควรเลือกอย่างไรในครั้งต่อไป",
          },
          {
            title: "ซื้อให้พอดีกับจำนวนคนและความถี่",
            text: "สินค้าที่ใช้คนเดียวกับสินค้าที่ใช้ร่วมกันอาจต้องการขนาดต่างกัน ลองประมาณจากความถี่ในการใช้ตามจริง ไม่ใช้ช่วงเวลาพิเศษเพียงครั้งเดียวเป็นตัวแทนของทั้งเดือน หากมีหลายคนใช้ร่วมกัน ให้พูดคุยเรื่องความชอบและที่เก็บให้ชัดก่อนซื้อ สำหรับร้านค้า ควรแยกจำนวนที่ใช้ภายในกับจำนวนที่จะนำไปวางขาย เพื่อให้เห็นความต้องการแต่ละส่วนและทบทวนได้ง่ายเมื่อถึงเวลาสั่งเพิ่ม",
          },
          {
            title: "ทบทวนจากสิ่งที่ได้ใช้จริง",
            text: "หลังใช้งานไปช่วงหนึ่ง ลองจดว่าสิ่งใดสะดวกและสิ่งใดยังไม่ตรงใจ คุณอาจชอบสินค้าแต่ต้องการขนาดอื่น หรือพบว่ามีรูปแบบการใช้ที่เหมาะกว่า การทบทวนสั้น ๆ ช่วยให้การซื้อครั้งถัดไปชัดเจนขึ้น VETRA ให้ความสำคัญกับคุณภาพและความคุ้มค่าที่เชื่อมกับการใช้งานจริง คุณสามารถใช้ข้อสังเกตเหล่านี้ประกอบคำถามเมื่อมองหาสินค้าหรือวางแผนซื้อในจำนวนที่ต่างจากเดิม",
          },
        ],
      },
      ar: {
        category: "الاستخدام والعناية",
        title: "اختر منتجات تناسب أسلوب حياتك",
        excerpt: "فكّر في وقتك ومساحتك وروتينك لتجد منتجات لها مكان مفيد في يومك.",
        intro: "ينبغي أن ينسجم المنتج اليومي المفيد مع ما تفعله فعلًا. إلى جانب الصورة الجذابة، تخيّل لحظة حقيقية لاستخدامه: متى ستحتاج إليه، وأين ستضعه، وماذا يلزمك لتحضيره؟ تكشف هذه الأسئلة البسيطة تفاصيل تؤثر في سهولة الاستخدام والاستمتاع بالمنتج ومدى استفادتك منه.",
        sections: [
          {
            title: "تخيّل موقفًا محددًا للاستخدام",
            text: "فكّر في موقف واضح: إعداد الإفطار قبل العمل، أو ترتيب مكتبك، أو تجهيز المنتجات للعملاء. حدّد موضع المنتج ضمن هذه الخطوات. وإذا كان استخدامه يتطلب تغييرات متعددة، ففكّر إن كنت ترغب فعلًا في إدخالها على روتينك. الانطلاق من لحظة موجودة أصلًا يجعل الاختيار أكثر واقعية، ويساعدك على تمييز الخصائص التي ستستخدمها عن تلك التي تبدو جذابة فحسب.",
          },
          {
            title: "اختر سهولة تناسب إيقاع يومك",
            text: "تختلف الراحة من شخص إلى آخر. قد تستمتع بخطوات تحضير متعددة في العطلة، وتفضّل طريقة أبسط خلال أسبوع العمل. اقرأ التعليمات وفكّر في الأدوات اللازمة والتنظيف بعد الاستخدام. وإذا كان المنتج مشتركًا، فتأكد من أن الجميع يستطيعون اتباع الطريقة نفسها. اختر أسلوبًا يسعدك تكراره؛ فالمنتج ينسجم مع روتينك أكثر حين تكون متطلبات استخدامه اليومية مناسبة لك.",
          },
          {
            title: "تحقّق من المساحة قبل اختيار الحجم",
            text: "انظر إلى الرف أو الخزانة أو مساحة العمل التي ستضع فيها المنتج. اعتمد على الأبعاد المذكورة بدل تقديرها من الصور. وللأغذية، اقرأ تعليمات الحفظ مع معلومات الحجم. وإذا كنت تنوي شراء عبوة تضم عدة وحدات، فاحسب المساحة اللازمة لها كاملة، لا لوحدة واحدة. الحجم المناسب يسهّل التنظيم والوصول إلى المنتج، ويساعدك على تحديد كمية الطلب.",
          },
          {
            title: "عبّر عن تفضيلاتك بوضوح",
            text: "حدّد ما يجذبك: المظهر، أم مذاق مألوف، أم طريقة معينة لاستخدام المنتج. وإذا لم تجرّبه من قبل، فلا تحتاج إلى توقّع التجربة كاملة من الوصف. ابدأ بالمعلومات التي يمكنك التحقق منها، واختر كمية مناسبة للتجربة الأولى. وفي الطعام، جرّبه مع وجبة أو مشروب تعرفه. ثم دع تجربتك الشخصية تساعدك على الاختيار في المرة التالية.",
          },
          {
            title: "ناسب الكمية مع عدد المستخدمين وتكرار الاستخدام",
            text: "قد يحتاج منتج لشخص واحد إلى حجم مختلف عن منتج يتشاركه عدة أشخاص. قدّر الاستخدام وفق الروتين المعتاد، دون اعتبار مناسبة خاصة واحدة نموذجًا للشهر كله. وإذا كان المنتج مشتركًا، فناقش التفضيلات وطريقة الحفظ قبل الشراء. وفي المتجر، ميّز المنتجات المخصصة للاستخدام الداخلي عن المخصصة للبيع. يساعد فصل الاحتياجات على مراجعة الكميات عند إعادة الطلب.",
          },
          {
            title: "راجع تجربتك الفعلية",
            text: "بعد فترة من الاستخدام، دوّن ما وجدته مريحًا وما لم يناسبك تمامًا. قد يعجبك المنتج لكنك تفضّل حجمًا مختلفًا، أو تكتشف له استخدامًا آخر. تمنحك مراجعة قصيرة بداية أوضح للشراء المقبل. ينسجم اهتمام VETRA بالجودة والقيمة مع هذا النهج العملي. استفد من ملاحظاتك عند الاستفسار عن منتج أو تحديد ما إذا كانت كمية أخرى أنسب لروتينك.",
          },
        ],
      },
      en: {
        category: "Use & care",
        title: "Choose products that fit the way you live",
        excerpt: "Consider your time, space, and routine to find items that have a useful place in an ordinary day.",
        intro: "A useful everyday product should fit the things you actually do. Start with a real moment of use alongside the attractive product photograph. When would you reach for it, where would it live, and what would you need to prepare? These ordinary questions reveal details that can affect convenience, enjoyment, and how much use you get from your purchase.",
        sections: [
          {
            title: "Picture one specific moment of use",
            text: "Think of a clear situation: preparing breakfast before work, arranging your desk, or getting products ready for customers. Describe where the item would fit into that sequence. If using it would require several changes, consider whether you actually want to make those changes to your routine. Starting with a moment that already exists makes the choice more concrete. It also helps you distinguish the features you would use from those that simply sound appealing.",
          },
          {
            title: "Choose convenience that suits your pace",
            text: "Convenience means different things to different people. You might enjoy several preparation steps on a weekend and prefer something simpler during the working week. Read the directions and consider any equipment or tidying involved. If the product will be shared, think about whether everyone can follow the same method. Choose an approach you are happy to repeat. A product is more likely to fit your routine when its everyday demands make sense to you.",
          },
          {
            title: "Check the actual space before choosing a size",
            text: "Look at the shelf, cupboard, or working area where the item would go. Use the stated measurements instead of estimating from photographs. For food products, read the storage instructions alongside the size information. If you plan to buy a multipack, consider the space for the whole pack rather than a single item. A suitable size makes it easier to organise and reach for your purchase and helps you decide how much to order.",
          },
          {
            title: "Give your preferences a practical description",
            text: "Identify whether the appeal comes from appearance, a familiar taste, or a particular way of using the product. If you have not tried it, you do not need to predict the whole experience from a description. Begin with the information you can check and choose a quantity suitable for a first use. With food, try it in a familiar meal or drink. Your own experience can then guide what you choose next time.",
          },
          {
            title: "Match quantity to people and frequency",
            text: "A product for one person may call for a different size from something shared. Estimate use from an ordinary routine rather than treating one special occasion as typical of the whole month. If several people will use it, discuss preferences and storage before buying. For a shop, distinguish items intended for internal use from those intended for sale. Keeping these needs separate makes it easier to review quantities when you are ready to order again.",
          },
          {
            title: "Review what you actually used",
            text: "After a period of use, note what felt convenient and what did not quite suit you. You may enjoy the product but prefer a different size, or discover another way to use it. A short review gives your next purchase a clearer starting point. VETRA’s emphasis on quality and value connects with this practical approach. Use your observations when asking about a product or deciding whether a different order quantity would fit your routine better.",
          },
        ],
      },
    },
  },
  {
    slug: "plan-a-wholesale-order",
    image: "/images/honey-front.jpg",
    imagePosition: "center",
    content: {
      th: {
        category: "สำหรับธุรกิจ",
        title: "เตรียมข้อมูลก่อนสั่งสินค้าขายส่ง ให้คุยกันได้ตรงความต้องการ",
        excerpt: "สิ่งที่ร้านค้าและธุรกิจควรเตรียม ตั้งแต่รายการสินค้าและจำนวน ไปจนถึงวันใช้งานและรายละเอียดรับสินค้า",
        intro: "การสั่งสินค้าให้ร้านค้าหรือธุรกิจมีรายละเอียดมากกว่าการเลือกหนึ่งชิ้นสำหรับตัวเอง การเตรียมข้อมูลสั้น ๆ ก่อนติดต่อผู้ขายช่วยให้สอบถามได้ตรงประเด็น และเปรียบเทียบตัวเลือกได้ง่ายขึ้น บทความนี้เป็นแนวทางจัดรายการสำหรับการพูดคุย โดยราคา จำนวนขั้นต่ำ และความพร้อมในการจัดส่งควรยืนยันสำหรับคำสั่งซื้อจริงแต่ละครั้ง",
        sections: [
          {
            title: "บอกจุดประสงค์ของคำสั่งซื้อ",
            text: "ระบุว่าจะนำสินค้าไปวางขาย ใช้ในร้าน จัดเป็นของขวัญ หรือใช้ในโอกาสใด เพราะแต่ละจุดประสงค์อาจให้ความสำคัญกับขนาดและรูปแบบบรรจุต่างกัน ไม่จำเป็นต้องส่งแผนธุรกิจทั้งหมด เพียงอธิบายประเภทการใช้งานและรายละเอียดที่เกี่ยวกับสินค้าก็พอ หากมีหลายการใช้งาน ให้แยกรายการไว้ตั้งแต่ต้น เพื่อให้ผู้ขายเข้าใจว่าจำนวนแต่ละส่วนต้องรองรับความต้องการแบบไหน",
          },
          {
            title: "ระบุสินค้าและขนาดให้ชัดเจน",
            text: "ใช้ชื่อเต็ม ขนาด และลิงก์สินค้าหากมี เพื่อลดความคลาดเคลื่อนจากชื่อเรียกที่สั้นเกินไป หากสนใจหลายรายการ ให้ทำตารางที่มีชื่อสินค้า ขนาด และจำนวนที่ต้องการในแต่ละบรรทัด ถ้ายังไม่แน่ใจรุ่นหรือขนาด ให้บอกสิ่งที่ต้องการใช้ประกอบคำถาม แทนการเลือกรุ่นจากภาพเพียงอย่างเดียว ข้อมูลที่ตรงกันตั้งแต่ต้นทำให้ตรวจทานคำตอบหรือรายละเอียดการสั่งซื้อได้ง่ายขึ้น",
          },
          {
            title: "แยกจำนวนที่ต้องการจากจำนวนต่อแพ็ก",
            text: "เขียนจำนวนเป็นหน่วยที่เข้าใจตรงกัน เช่น กระปุก ชิ้น หรือกล่อง แล้วสอบถามว่าหนึ่งแพ็กมีจำนวนเท่าไร อย่าสมมติว่าคำว่า “หนึ่งลัง” มีจำนวนเท่ากันในสินค้าทุกประเภท หากมีจำนวนขั้นต่ำหรือรูปแบบการจัดแพ็ก ให้ขอรายละเอียดก่อนปรับรายการ พิจารณาพื้นที่เก็บและจำนวนที่พร้อมรับควบคู่กัน เพื่อให้จำนวนที่ยืนยันสอดคล้องกับทั้งการใช้งานและการจัดการภายในร้านของคุณ",
          },
          {
            title: "แจ้งวันใช้งานและสถานที่รับให้ครบ",
            text: "ระบุวันที่ต้องการรับและวันที่จะนำไปใช้แยกกัน หากสองวันนั้นต่างกัน พร้อมแจ้งจังหวัดหรือพื้นที่ปลายทางที่จำเป็นต่อการประเมินการจัดส่ง ถามให้ชัดว่าเวลาที่แจ้งเป็นวันเตรียมสินค้า วันส่ง หรือวันที่คาดว่าจะถึง อย่าใช้ระยะเวลาของคำสั่งซื้อเก่ามายืนยันคำสั่งซื้อใหม่โดยอัตโนมัติ เมื่อมีการเปลี่ยนจำนวนหรือวันใช้งาน ควรตรวจสอบรายละเอียดที่เกี่ยวข้องอีกครั้งก่อนยืนยัน",
          },
          {
            title: "ขอรายละเอียดสำหรับการตัดสินใจในครั้งเดียว",
            text: "รวบรวมคำถามที่เกี่ยวกับคำสั่งซื้อ เช่น ราคาตามจำนวนที่สนใจ จำนวนต่อแพ็ก ความพร้อมของสินค้า รายละเอียดการจัดส่ง และเอกสารที่ธุรกิจต้องใช้ หากเป็นสินค้าที่มีวันที่บนบรรจุภัณฑ์และวันที่มีผลกับแผนของคุณ ควรสอบถามข้อมูลส่วนนี้ด้วย ขอให้สรุปรายการและจำนวนที่ใช้คำนวณให้ชัดเจน เพื่อให้ตรวจเทียบกับสิ่งที่ต้องการได้ง่าย โดยไม่ต้องเดาว่าราคาหรือคำตอบนั้นอ้างอิงสินค้ารุ่นใด",
          },
          {
            title: "เตรียมขั้นตอนรับสินค้าและทบทวนครั้งต่อไป",
            text: "ก่อนสินค้ามาถึง กำหนดผู้รับและพื้นที่จัดเก็บที่เหมาะกับคำแนะนำของสินค้า เมื่อได้รับแล้ว ตรวจชื่อ ขนาด และจำนวนเทียบกับรายละเอียดที่ยืนยันไว้ หากพบข้อสงสัย ให้เก็บภาพบรรจุภัณฑ์และข้อมูลของรายการนั้นเพื่อสอบถามได้ตรงจุด หลังจากนำไปใช้หรือวางขาย ลองทบทวนขนาดและจำนวนที่เหมาะสม ข้อมูลจากการสั่งครั้งก่อนช่วยให้วางรายการครั้งถัดไปได้ชัดเจนและคุยกับผู้ขายได้กระชับขึ้น",
          },
        ],
      },
      ar: {
        category: "لقطاع الأعمال",
        title: "ما الذي تجهّزه قبل الاستفسار عن طلب بالجملة؟",
        excerpt: "دليل عملي للمتاجر والشركات: أسماء المنتجات والكميات والمواعيد وتفاصيل استلام الطلب.",
        intro: "يتطلب الشراء لمتجر أو نشاط تجاري تفاصيل أكثر من اختيار منتج واحد لنفسك. يساعدك ملخّص قصير للمشتريات على طرح أسئلة محددة ومقارنة الإجابات. استخدم هذا الدليل لتنظيم الحوار. وينبغي تأكيد الأسعار والحد الأدنى للكميات وإمكانية التوصيل للطلب الفعلي، بدل افتراضها من شراء سابق أو صورة عامة للمنتج.",
        sections: [
          {
            title: "وضّح الغرض من الطلب",
            text: "اذكر إن كانت المنتجات لإعادة البيع، أو للاستخدام في مقر نشاطك، أو للإهداء، أو لمناسبة محددة. فقد يحتاج كل غرض إلى حجم أو تغليف مختلف. لا يلزم إرسال خطة عمل كاملة؛ يكفي توضيح الاستخدام المقصود وتفاصيل المنتج المرتبطة به. وإذا كان الطلب يخدم عدة أغراض، فافصلها منذ البداية ليسهل على البائع فهم ما تحتاج إليه كل كمية.",
          },
          {
            title: "حدّد كل منتج وحجمه بوضوح",
            text: "استخدم الاسم الكامل والحجم ورابط المنتج إن توفر. فقد تترك الأسماء المختصرة مجالًا للالتباس. وإذا كنت تريد عدة منتجات، فجهّز جدولًا بسيطًا يضم المنتج والحجم والكمية في كل سطر. وإذا لم تختر الإصدار بعد، فاشرح ما تحتاجه من المنتج بدل التخمين من الصورة. يسهل البدء بمراجع مشتركة مراجعة الرد والتحقق من تفاصيل الطلب المقترح.",
          },
          {
            title: "ميّز الكمية المطلوبة عن محتويات العبوة",
            text: "عبّر عن الكميات بوحدات واضحة، مثل العبوات أو القطع أو الصناديق، واسأل عن عدد الوحدات في كل عبوة. لا تفترض أن الصندوق يضم العدد نفسه في جميع المنتجات. استفسر عن الحد الأدنى للكميات وطريقة التعبئة قبل تعديل قائمتك. وراعِ المساحة المتاحة والكمية التي تستطيع استلامها. ينبغي أن تلائم الكمية المؤكدة استخدامك وطريقة إدارة المخزون في مقر نشاطك.",
          },
          {
            title: "اذكر الموعد والوجهة",
            text: "حدّد موعد الاستلام الذي تريده وموعد الاستخدام إذا كان مختلفًا، وأضف منطقة الوجهة اللازمة لمناقشة التوصيل. وضّح ما إذا كانت المدة المذكورة تخص التجهيز أو الإرسال أو الوصول المتوقع. لا تتحول مدة طلب سابق تلقائيًا إلى وعد لطلب جديد. وإذا غيّرت الكمية أو الموعد المطلوب، فأعد التأكد من الترتيبات المرتبطة بهما قبل تأكيد الطلب.",
          },
          {
            title: "اطلب المعلومات اللازمة لاتخاذ القرار",
            text: "اجمع الأسئلة المهمة في رسالة واحدة: سعر الكمية المقترحة، ومحتويات العبوة، والتوافر، وتفاصيل التوصيل، وأي مستندات يحتاجها نشاطك. وإذا كانت تواريخ العبوة تؤثر في خططك، فاستفسر عنها. اطلب ملخّصًا واضحًا للمنتجات والكميات التي يستند إليها الرد. يسهّل ذلك مقارنة المعلومات بطلبك الأصلي دون التخمين بشأن الإصدار الذي يشير إليه السعر.",
          },
          {
            title: "خطّط للاستلام واستفد في الطلب المقبل",
            text: "قبل وصول الطلب، حدّد من سيستلمه وجهّز مكان حفظ يتوافق مع تعليمات المنتج. وعند الوصول، قارن الأسماء والأحجام والكميات بالتفاصيل المؤكدة. إذا احتجت إلى توضيح، فاحتفظ بصور العبوات ومعلومات المنتجات ذات الصلة. وبعد الاستخدام أو البيع، راجع مدى ملاءمة الأحجام والكميات. تساعدك ملاحظات الطلب الفعلي على إعداد طلب أوضح وحوار أكثر تحديدًا مع البائع في المرة المقبلة.",
          },
        ],
      },
      en: {
        category: "For business",
        title: "What to prepare before asking about a wholesale order",
        excerpt: "A practical brief for shops and businesses: product names, quantities, timing, and the details needed to receive your order.",
        intro: "Buying for a shop or business involves more details than choosing one item for yourself. A short purchasing brief helps you ask focused questions and compare the answers. Use this guide to organise the conversation. Prices, minimum quantities, and delivery availability should be confirmed for the actual order rather than assumed from a previous purchase or a general product photograph.",
        sections: [
          {
            title: "Explain the purpose of the order",
            text: "Say whether the products are for resale, use in your premises, gifts, or a particular occasion. Each purpose may call for different sizes or packaging. You do not need to send your entire business plan; explain the intended use and the product details relevant to it. If one order serves several purposes, separate them from the start. This helps the seller understand what each part of the quantity needs to support.",
          },
          {
            title: "Identify each product and size clearly",
            text: "Use the full product name, size, and a product link where available. Short names can leave room for confusion. For several items, prepare a simple table with one product, size, and quantity on each line. If you have not chosen a version, explain what you need it for rather than guessing from a photograph. Starting with shared references makes it easier to check the reply and review the details of the proposed order.",
          },
          {
            title: "Separate your required quantity from the pack size",
            text: "Express quantities in clear units, such as jars, pieces, or boxes, and ask how many items a pack contains. Do not assume a carton means the same quantity for every product. Ask about any minimum quantity or packing arrangement before adjusting your list. Consider the space available and the amount you are ready to receive. The quantity you confirm should make sense for both your intended use and the way your premises handle stock.",
          },
          {
            title: "Share the timing and destination",
            text: "Give the date you would like to receive the items and the date you plan to use them, if these differ. Include the destination area needed to discuss delivery. Clarify whether a stated time refers to preparation, dispatch, or expected arrival. A previous order’s timing should not automatically become a promise for a new one. If you change the quantity or intended date, check the related arrangements again before confirming the order.",
          },
          {
            title: "Ask for the information needed to decide",
            text: "Gather the relevant questions in one message: the price for your proposed quantity, pack contents, availability, delivery details, and any documents your business needs. For products with dates on the packaging, ask about those details if they affect your plans. Request a clear summary of the items and quantities used in the reply. This makes it easier to compare the information with your original brief without guessing which version a price refers to.",
          },
          {
            title: "Plan receipt and review the next order",
            text: "Before arrival, arrange a recipient and storage that follows the product instructions. When the order arrives, compare the names, sizes, and quantities with the confirmed details. If something needs clarification, keep photographs of the packaging and relevant item information. After using or selling the products, review whether the sizes and quantities suited your needs. Observations from the actual order can make your next brief clearer and your next conversation with the seller more focused.",
          },
        ],
      },
    },
  },
  {
    slug: "questions-before-buying",
    image: "/images/hero-eshan-3.webp",
    content: {
      th: {
        category: "เลือกสินค้า",
        title: "คำถามก่อนซื้อสินค้า ที่ช่วยให้เลือกได้ตรงใจมากขึ้น",
        excerpt: "ถามให้ตรงเรื่อง ตั้งแต่สิ่งที่จะได้รับไปจนถึงการใช้งาน เพื่อเปลี่ยนความลังเลให้เป็นข้อมูลที่นำไปตัดสินใจได้",
        intro: "การถามก่อนซื้อเป็นส่วนหนึ่งของการเลือกอย่างใส่ใจ คำถามที่ดีไม่จำเป็นต้องยาว แต่ควรบอกว่าคุณสนใจสินค้าใดและยังไม่แน่ใจเรื่องอะไร ลองใช้คำถามต่อไปนี้เป็นแนวทาง แล้วเลือกเฉพาะข้อที่มีผลกับการใช้งานของคุณ เพื่อให้ได้คำตอบที่ช่วยตัดสินใจอย่างมีเหตุผลและตรงความต้องการ",
        sections: [
          {
            title: "ราคานี้ได้อะไรและจำนวนเท่าไร",
            text: "เริ่มจากสิ่งพื้นฐานที่สุด คือชื่อสินค้า ขนาด จำนวน และสิ่งที่รวมอยู่ในรายการ หากภาพมีอุปกรณ์หรือของตกแต่งหลายอย่าง ให้ถามว่าส่วนใดเป็นสินค้าในชุดจริง คำถามอย่าง “รายการนี้เป็นหนึ่งกระปุกขนาดเท่าไร” ชัดเจนกว่าการถามเพียงว่า “ได้ตามภาพไหม” การรู้สิ่งที่จะได้รับอย่างแน่นอนทำให้เปรียบเทียบกับรายการอื่นได้ และช่วยตรวจทานตัวเลือกก่อนยืนยันคำสั่งซื้อ",
          },
          {
            title: "สินค้าเหมาะกับวิธีใช้ที่คิดไว้หรือไม่",
            text: "อธิบายสถานการณ์สั้น ๆ เช่น ต้องการใช้ที่บ้านเป็นครั้งคราว หรือต้องการนำไปใช้ประจำในร้าน แล้วถามรายละเอียดที่เกี่ยวข้องโดยตรง หากเรื่องขนาดหรือวิธีเตรียมมีผลกับคุณ ให้ระบุไปด้วย ผู้ขายจะเข้าใจคำถามได้ง่ายขึ้นเมื่อมีบริบท แทนการถามว่าสินค้า “ดีไหม” เพียงอย่างเดียว คุณยังสามารถใช้คำตอบเทียบกับข้อมูลบนหน้าสินค้าเพื่อดูว่าทุกส่วนสอดคล้องกันหรือไม่",
          },
          {
            title: "มีข้อมูลส่วนไหนให้ตรวจสอบเพิ่มเติม",
            text: "ถ้าส่วนประกอบ วัสดุ แหล่งที่มา หรือวิธีดูแลมีผลกับการเลือก ให้ขอข้อมูลของส่วนนั้นอย่างชัดเจน เช่น ภาพฉลากด้านหลังหรือรายละเอียดขนาด อย่าสรุปจากคำโฆษณากว้าง ๆ เพียงคำเดียว การถามว่า “ข้อมูลส่วนประกอบอยู่ตรงไหน” จะได้จุดอ้างอิงที่นำไปอ่านต่อได้ง่ายกว่า หากคำตอบยังไม่ตรงประเด็น ให้ถามต่อโดยระบุข้อมูลที่ยังขาดอยู่ และเก็บรายละเอียดสำคัญไว้เปรียบเทียบ",
          },
          {
            title: "จะได้รับสินค้าเมื่อไรและต้องเตรียมรับอย่างไร",
            text: "หากมีวันที่ต้องใช้สินค้า ให้แจ้งวันและพื้นที่ปลายทางก่อนสอบถามเวลาจัดส่ง แยกคำถามเรื่องวันส่งออกจากวันที่คาดว่าจะได้รับ เพราะเป็นคนละขั้นตอน สำหรับการสั่งจำนวนมาก ให้ถามรูปแบบการแพ็กที่เกี่ยวข้องกับการรับและจัดเก็บด้วย ยืนยันรายละเอียดของคำสั่งซื้อปัจจุบันให้ครบ ไม่ใช้ข้อมูลจากรีวิวหรือภาพเก่ามาแทนคำตอบของรายการที่คุณกำลังจะสั่ง",
          },
          {
            title: "หากต้องสอบถามหลังรับสินค้า ควรเตรียมข้อมูลอะไร",
            text: "รู้ช่องทางติดต่อและข้อมูลที่ควรเก็บไว้ก่อนรับสินค้า เช่น รายการสั่งซื้อ ชื่อสินค้า และภาพบรรจุภัณฑ์ หากสินค้ามีเลขล็อต ให้เก็บข้อมูลนั้นไว้ด้วย เมื่อต้องสอบถาม ให้บอกข้อสังเกตตามจริงและแนบภาพที่เกี่ยวข้อง วิธีนี้ช่วยให้เริ่มตรวจสอบจากสินค้าและคำสั่งซื้อเดียวกัน หากมีเงื่อนไขบริการที่สำคัญต่อคุณ ควรอ่านข้อมูลที่ประกาศไว้หรือขอคำอธิบายก่อนซื้อ",
          },
          {
            title: "ข้อมูลเพียงพอให้ตัดสินใจแล้วหรือยัง",
            text: "ก่อนกดสั่ง ลองตอบให้ได้ว่าคุณเลือกสินค้านี้เพราะอะไร จะใช้เมื่อไร และปริมาณที่เลือกเหมาะอย่างไร หากยังมีคำถามที่เปลี่ยนการตัดสินใจได้ ให้เก็บไว้ถามต่อ การตัดสินใจที่ชัดเจนไม่จำเป็นต้องใช้ข้อมูลทุกอย่างที่หาได้ แต่ควรมีข้อมูลส่วนที่สำคัญกับคุณ VETRA มุ่งให้การเลือกสินค้าที่มีคุณภาพและคุ้มค่าเริ่มจากความเข้าใจ จึงควรนำคำถามจริงของคุณมาเป็นส่วนหนึ่งของการเลือกเสมอ",
          },
        ],
      },
      ar: {
        category: "اختيار المنتجات",
        title: "أسئلة مفيدة قبل شراء أي منتج",
        excerpt: "حوّل ما يثير حيرتك إلى أسئلة عملية عن محتويات العرض وطريقة الاستخدام وتفاصيل الطلب.",
        intro: "الاستفسار قبل الشراء جزء من الاختيار المدروس. لا يحتاج السؤال المفيد إلى إطالة؛ يكفي أن يحدد المنتج والمعلومة غير الواضحة. ابدأ بالأسئلة التالية، واختر منها ما يؤثر في مشترياتك. فالغاية الحصول على إجابات تستفيد منها، بدل جمع المزيد من المعلومات دون غرض واضح.",
        sections: [
          {
            title: "ماذا يشمل هذا السعر؟",
            text: "ابدأ باسم المنتج وحجمه وكميته ومحتويات العرض. وإذا تضمنت الصورة عناصر للزينة أو ملحقات متعددة، فاسأل عمّا ستستلمه فعلًا. سؤال «هل السعر لعبوة واحدة، وما وزنها الصافي؟» أدق من «هل سأستلم ما في الصورة؟». تمنحك معرفة المحتويات مرجعًا واضحًا للمقارنة، وتساعدك على مراجعة اختيارك قبل تأكيد الطلب.",
          },
          {
            title: "هل يناسب الطريقة التي سأستخدمه بها؟",
            text: "صف موقفًا قصيرًا، مثل الاستخدام بين حين وآخر في المنزل أو الاستخدام المنتظم في متجرك، ثم اسأل عن التفاصيل المرتبطة به. اذكر الحجم أو التحضير إذا كانا يؤثران في اختيارك. يجعل هذا السياق سؤالك أوضح من الاكتفاء بالسؤال إن كان المنتج جيدًا. ويمكنك أيضًا مقارنة الرد بصفحة المنتج للتحقق من اتساق المعلومات ومن الإجابة عن احتياجك الفعلي.",
          },
          {
            title: "ما التفاصيل التي يمكنني التحقق منها بنفسي؟",
            text: "إذا أثرت المكوّنات أو المواد أو المنشأ أو متطلبات العناية في قرارك، فاطلب معلومات محددة، مثل صورة الملصق الخلفي أو الأبعاد المذكورة. تجنّب بناء استنتاجك على كلمة ترويجية عامة. سؤال «أين يمكنني قراءة معلومات المكوّنات؟» يمنحك مرجعًا تراجعه. وإذا بقي نقص في الرد، فحدّد المعلومة الناقصة في سؤالك التالي، واحتفظ بالتفاصيل المهمة لمقارنة الخيارات.",
          },
          {
            title: "متى يصل الطلب، وكيف سيُسلَّم؟",
            text: "إذا احتجت إلى المنتج بحلول تاريخ محدد، فاذكر التاريخ ومنطقة الوجهة قبل الاستفسار عن التوصيل. ميّز تاريخ الإرسال عن موعد الوصول المتوقع، فكل منهما يصف مرحلة مختلفة. وللطلبات الكبيرة، اسأل عن تفاصيل التعبئة التي تؤثر في الاستلام والتخزين. أكّد ترتيبات طلبك الحالي، ولا تعتبر مراجعة قديمة أو صورة إجابة عن المشتريات التي تنوي القيام بها الآن.",
          },
          {
            title: "ما الذي أحتفظ به إذا احتجت إلى الاستفسار لاحقًا؟",
            text: "اعرف وسيلة التواصل، واحتفظ بالمراجع المفيدة، مثل تفاصيل الطلب واسم المنتج وصور العبوة، ورقم التشغيلة إن وجد. وإذا احتجت إلى السؤال عن المنتج بعد وصوله، فصف ما لاحظته وأرفق الصور المناسبة. بذلك يبدأ الحوار حول المنتج والطلب نفسيهما. اقرأ شروط الخدمة المنشورة التي تهمك، أو اطلب توضيحها قبل الشراء.",
          },
          {
            title: "هل لديّ معلومات كافية لاتخاذ القرار؟",
            text: "قبل الطلب، وضّح لماذا اخترت المنتج، ومتى تنوي استخدامه، ولماذا تناسبك الكمية. وإذا كان سؤال لم يُجب عنه قد يغيّر قرارك، فاطرحه. لا يتطلب الاختيار الواضح كل تفصيل يمكن العثور عليه، بل التفاصيل التي تهمك. يبدأ نهج VETRA في الجودة والقيمة بالفهم، لذا اجعل أسئلتك الفعلية جزءًا من عملية الاختيار.",
          },
        ],
      },
      en: {
        category: "Product selection",
        title: "Useful questions to ask before buying a product",
        excerpt: "Turn uncertainty into practical questions about what is included, how you will use it, and the details of your order.",
        intro: "Asking before buying is part of a thoughtful choice. A useful question does not need to be long; it needs to identify the product and the detail you are unsure about. Use these prompts as a starting point and keep the ones that affect your own purchase. The aim is to gather answers you can use, rather than collect more information without a clear purpose.",
        sections: [
          {
            title: "What does this price include?",
            text: "Begin with the product name, size, quantity, and contents of the listing. If the photograph includes props or several accessories, ask which items are actually supplied. “Is this one jar, and what is its net weight?” is more precise than “Will I receive what is in the picture?” Knowing the contents gives you a clear reference for comparison and helps you review your selected option before confirming an order.",
          },
          {
            title: "Does it suit the way I plan to use it?",
            text: "Describe a short scenario, such as occasional use at home or regular use in your shop, then ask about the details relevant to it. Mention size or preparation if those affect your choice. Context makes your question easier to understand than simply asking whether a product is good. You can also compare the reply with the product page to see whether the information is consistent and whether your intended use has been addressed.",
          },
          {
            title: "Which details can I check for myself?",
            text: "If ingredients, materials, origin, or care requirements affect your decision, ask for the specific information, such as a back-label photograph or stated dimensions. Avoid building a conclusion around one broad promotional word. “Where can I read the ingredient information?” gives you a reference you can review. If the reply still leaves a gap, identify the missing detail in your follow-up and keep the relevant information available for comparing your options.",
          },
          {
            title: "When should I expect the order, and how will it arrive?",
            text: "If you need the product by a particular date, share that date and the destination area before asking about delivery. Separate the dispatch date from the expected arrival date, because they describe different stages. For a larger order, ask about packing details that affect receipt and storage. Confirm the arrangements for your current order instead of treating an old review or photograph as the answer for the purchase you are about to make.",
          },
          {
            title: "What should I keep if I have a question later?",
            text: "Know the contact route and keep useful references, such as your order details, the product name, and photographs of the packaging. Retain the lot number where one is provided. If you need to ask about the item after arrival, describe what you observed and include relevant photographs. This starts the conversation with the same product and order. Read any published service terms that matter to you or ask for clarification before buying.",
          },
          {
            title: "Do I have enough information to decide?",
            text: "Before ordering, explain why you have chosen the product, when you plan to use it, and why the quantity makes sense. If an unanswered question could change your decision, ask it. A clear choice does not require every detail you can possibly find; it needs the details that matter to you. VETRA’s approach to quality and value begins with understanding, so bring your actual questions into the selection process.",
          },
        ],
      },
    },
  },
  {
    slug: "a-taste-of-coffee-blossom",
    image: "/images/nature-story.webp",
    content: {
      th: {
        category: "รู้จักสินค้า",
        title: "รู้จักน้ำผึ้งดอกกาแฟ จากภาคเหนือของไทย",
        excerpt:
          "เรื่องราวของดอกกาแฟ และรายละเอียดเล็ก ๆ บนฉลากที่ช่วยให้รู้จักน้ำผึ้งในกระปุกมากขึ้น",
        intro:
          "บางครั้ง การรู้จักสิ่งที่อยู่บนโต๊ะอาหารเริ่มต้นง่าย ๆ จากการอ่านฉลาก สำหรับน้ำผึ้งดอกกาแฟ ESHAN ข้อมูลบนกระปุกบอกเล่าถึงวัตถุดิบและแหล่งที่มาไว้อย่างชัดเจน",
        sections: [
          {
            title: "ดอกกาแฟคือที่มาของชื่อ",
            text: "ฉลาก ESHAN ระบุว่าน้ำผึ้งนี้เก็บเกี่ยวจากดอกกาแฟที่ปลูกในภาคเหนือของประเทศไทย ชื่อ “น้ำผึ้งดอกกาแฟ” จึงบอกถึงแหล่งดอกไม้ ไม่ได้หมายถึงน้ำผึ้งที่เติมกาแฟลงไป เมื่อต้องเปรียบเทียบกับน้ำผึ้งชนิดอื่น ลองอ่านชื่อและส่วนประกอบควบคู่กัน อย่าใช้ชื่อเพียงอย่างเดียวคาดเดารายละเอียดทั้งหมดของสินค้า เพราะข้อมูลบนฉลากช่วยให้แยกสิ่งที่ระบุจริงออกจากสิ่งที่เรานึกไปเองได้",
          },
          {
            title: "ส่วนประกอบเดียวที่ระบุบนฉลาก",
            text: "ส่วนประกอบที่ระบุคือ น้ำผึ้งดอกกาแฟ 100% ในกระปุกน้ำหนักสุทธิ 380 กรัม ดูภาพฉลากจริงได้ในหน้าสินค้า หากกำลังเปรียบเทียบหลายรายการ ควรใช้หน่วยน้ำหนักเดียวกันและตรวจว่าแต่ละราคาครอบคลุมกี่กระปุก การจดชื่อเต็มพร้อมน้ำหนักไว้ด้วยกันช่วยให้สอบถามรายละเอียดได้ตรงรุ่น และช่วยตรวจทานสินค้าที่เลือกก่อนสั่งซื้อได้ง่ายกว่าการดูจากขนาดในภาพ",
          },
          {
            title: "เริ่มจากการชิมในแบบของคุณ",
            text: "ลองใช้น้ำผึ้งปริมาณเล็กน้อยกับขนมปัง โยเกิร์ต หรือเครื่องดื่มที่คุณชอบ ชิมก่อนแล้วค่อยปรับปริมาณตามรสที่ต้องการ การเริ่มกับเมนูที่คุ้นเคยช่วยให้คุณอธิบายความชอบของตัวเองได้ง่ายขึ้น ไม่จำเป็นต้องเตรียมเมนูพิเศษหลายอย่างในครั้งแรก เลือกวัตถุดิบที่เหมาะกับการรับประทานของคุณ และจดวิธีที่ชอบไว้ใช้ในครั้งต่อไป",
          },
          {
            title: "เลือกจำนวนให้เข้ากับการใช้ของคุณ",
            text: "ก่อนเลือกจำนวน ลองคิดว่าจะใช้คนเดียวหรือแบ่งกันในบ้าน และจะหยิบใช้ในมื้อใดบ้าง หากยังไม่เคยลอง ให้เริ่มจากจำนวนที่เหมาะกับการรู้จักสินค้า สำหรับร้านค้าหรือธุรกิจ ควรระบุทั้งจำนวนที่สนใจและวัตถุประสงค์เมื่อติดต่อสอบถาม เพื่อให้พูดคุยเรื่องสินค้ารายการเดียวกันได้ชัดเจน การเลือกขนาดและจำนวนอย่างตั้งใจเป็นส่วนหนึ่งของการมองความคุ้มค่าในการใช้งานจริง",
          },
          {
            title: "ใช้กระปุกที่ได้รับเป็นข้อมูลอ้างอิง",
            text: "เมื่อได้รับสินค้า ให้ตรวจข้อมูลบนบรรจุภัณฑ์จริง รวมถึงคำแนะนำการเก็บรักษาและวันที่ที่พิมพ์ไว้ ฉลาก ESHAN ระบุให้เก็บที่อุณหภูมิห้อง แต่ควรอ่านกระปุกของคุณอีกครั้งเพื่อดูข้อมูลของสินค้าที่ได้รับ ภาพเว็บไซต์ใช้แสดงสินค้าและไม่ได้ยืนยันวันที่ของทุกล็อต หากต้องสอบถาม ให้เก็บชื่อสินค้า เลขล็อต และภาพส่วนที่เกี่ยวข้องไว้ประกอบคำถาม",
          },
        ],
      },
      ar: {
        category: "معرفة المنتجات",
        title: "عسل أزهار القهوة من شمال تايلاند",
        excerpt: "تعرّف على الزهرة وراء الاسم، وعلى التفاصيل الصغيرة المدوّنة على العبوة.",
        intro: "يمكن أن تبدأ معرفة ما على مائدتك بعادة بسيطة: قراءة الملصق. تمنحنا عبوة ESHAN نقطة انطلاق واضحة لمعرفة المكوّن والمنشأ.",
        sections: [
          {
            title: "الأزهار وراء الاسم",
            text: "يذكر ملصق ESHAN أن هذا العسل يُجمع من أزهار القهوة التي تنمو في شمال تايلاند. وتصف عبارة «أزهار القهوة» مصدر الرحيق، ولا تعني إضافة القهوة إلى العسل. عند مقارنة أنواع العسل، اقرأ الاسم مع قائمة المكوّنات. فالاسم نقطة بداية، بينما يساعد الملصق على تمييز المعلومات المذكورة فعلًا عن الافتراضات حول المنتج.",
          },
          {
            title: "مكوّن واحد على الملصق",
            text: "المكوّن المذكور هو عسل أزهار القهوة 100%، بوزن صافٍ يبلغ 380 غرامًا للعبوة. ويمكنك رؤية صور العبوة الأصلية في صفحة المنتج. عند مقارنة العروض، استخدم وحدة الوزن نفسها، وتحقّق من عدد العبوات التي يشملها كل سعر. ويسهّل جمع الاسم الكامل والوزن في مرجع واحد الاستفسار عن المنتج الذي تفكر فيه تحديدًا.",
          },
          {
            title: "اكتشف طريقتك للاستمتاع به",
            text: "جرّب كمية صغيرة مع الخبز المحمّص أو الزبادي أو مشروب تحبه. تذوّق قبل إضافة المزيد، واضبط الكمية حسب ذوقك. تساعدك وجبة مألوفة على وصف ما يعجبك دون إعداد عدة وصفات جديدة دفعة واحدة. اختر مكوّنات تناسب احتياجاتك الغذائية، وسجّل التركيبة التي ترغب في تكرارها. وقد تختلف الكمية التي تفضّلها من طبق إلى آخر.",
          },
          {
            title: "اختر كمية تناسب روتينك",
            text: "فكّر إن كان العسل لك وحدك أم لأسرة تتشاركه، وفي الوجبات التي ستستخدمه معها. في الشراء الأول، اختر كمية مناسبة للتعرّف على المنتج. ويمكن للمتاجر والشركات ذكر الاستخدام المقصود والكمية المقترحة عند الاستفسار. فالكمية العملية جزء من تقييم القيمة بناءً على الاستفادة التي تتوقعها.",
          },
          {
            title: "ارجع إلى العبوة التي تستلمها",
            text: "تحقّق من العبوة الفعلية عند وصول طلبك، بما في ذلك تعليمات الحفظ والتواريخ المطبوعة. ينص ملصق ESHAN على الحفظ في درجة حرارة الغرفة؛ وعبوتك هي المرجع للمنتج الذي استلمته. صور الموقع تعرّف بالمنتج، ولا تؤكد تواريخ كل تشغيلة. احتفظ باسم المنتج ورقم التشغيلة وصور العبوة ذات الصلة إذا احتجت إلى الاستفسار.",
          },
        ],
      },
      en: {
        category: "Product knowledge",
        title: "Coffee blossom honey, rooted in northern Thailand",
        excerpt:
          "A closer look at the flower behind the name, and the small details on the jar.",
        intro:
          "Getting to know what is on your table can begin with a simple habit: reading the label. The ESHAN jar gives us a clear starting point for its ingredient and origin.",
        sections: [
          {
            title: "The blossom behind the name",
            text: "The ESHAN label states that this honey is harvested from coffee blossoms grown in northern Thailand. “Coffee blossom” describes the floral source; it does not mean coffee has been added. When comparing honey products, read the name alongside the listed ingredients. The name gives you a starting point, while the label helps distinguish the information actually supplied from an assumption about the product.",
          },
          {
            title: "One ingredient on the label",
            text: "The listed ingredient is 100% coffee blossom honey, with a net weight of 380 g per jar. You can see photographs of the original packaging on the product page. When comparing listings, use the same weight unit and check how many jars each price covers. Keeping the full name and weight together makes it easier to ask about the exact item you are considering.",
          },
          {
            title: "Find your own way to enjoy it",
            text: "Try a small amount with toast, yogurt, or a drink you already enjoy. Taste before adding more and adjust to your preference. A familiar meal makes it easier to describe what you like without preparing several new recipes at once. Choose ingredients that suit your own dietary needs, and note the combination you would like to repeat. Your preferred amount can vary from one dish to another.",
          },
          {
            title: "Match the quantity to your routine",
            text: "Consider whether the honey is for you or for a shared household, and which meals you expect to use it in. For a first purchase, choose an amount suitable for getting to know the product. Shops and businesses can include their intended use and proposed quantity when making an enquiry. Choosing a practical quantity is part of understanding value through the use you expect to get.",
          },
          {
            title: "Refer to the jar you receive",
            text: "Check the actual packaging when your order arrives, including storage instructions and printed dates. The ESHAN label says to keep the honey at room temperature; read your own jar as the reference for the item received. Website photographs illustrate the product and do not confirm every batch date. Keep the product name, lot number, and relevant packaging photographs if you need to ask a question.",
          },
        ],
      },
    },
  },
  {
    slug: "simple-honey-pairings",
    image: "/images/hero-eshan-1.webp",
    imagePosition: "center",
    content: {
      th: {
        category: "ใช้และดูแล",
        title: "สามไอเดียง่าย ๆ เติมน้ำผึ้งให้มื้อธรรมดา",
        excerpt:
          "ขนมปัง โยเกิร์ต และเครื่องดื่มแก้วโปรด — ความอร่อยที่เริ่มจากสิ่งใกล้ตัว",
        intro:
          "ไม่จำเป็นต้องมีสูตรซับซ้อนเพื่อเพลิดเพลินกับน้ำผึ้ง เริ่มต้นจากอาหารที่คุณชอบอยู่แล้ว และใช้ความหวานเพียงเล็กน้อยตามที่ต้องการ",
        sections: [
          {
            title: "ขนมปังกับเช้าที่ไม่เร่งรีบ",
            text: "ปิ้งขนมปังตามชอบ ทาเนยบาง ๆ แล้วราดน้ำผึ้งเล็กน้อย เริ่มจากครึ่งช้อนชาแล้วชิมก่อนเติมเพิ่ม หากอยากเปลี่ยนบ้าง ลองวางกล้วยหั่นชิ้นหรือเสิร์ฟกับผลไม้ที่มีอยู่ เลือกขนมปังที่คุณชอบและปรับระดับการปิ้งในแบบเดิมก่อน เพื่อให้ลองความต่างจากน้ำผึ้งได้ง่ายขึ้น จัดน้ำผึ้งแยกไว้ให้แต่ละคนปรับปริมาณเองหากรับประทานร่วมกัน",
          },
          {
            title: "โยเกิร์ตในแบบที่คุณเลือก",
            text: "ตักโยเกิร์ตรสธรรมชาติใส่ถ้วย เติมผลไม้หั่นชิ้นและน้ำผึ้งตามชอบ ชิมส่วนผสมก่อนตัดสินใจเติมน้ำผึ้งเพิ่ม เพราะผลไม้ที่เลือกแต่ละครั้งอาจให้รสต่างกัน หากต้องการความกรุบกรอบ ลองใส่กราโนลาหรือถั่วที่คุณรับประทานได้ เลือกส่วนผสมให้เหมาะกับข้อจำกัดด้านอาหารของคุณ เริ่มจากวัตถุดิบไม่กี่อย่างเพื่อให้จำได้ว่าชอบการผสมแบบใด",
          },
          {
            title: "เครื่องดื่มแก้วโปรด",
            text: "ลองใช้น้ำผึ้งในชาหรือกาแฟที่คุณชอบ คนให้เข้ากันแล้วชิมก่อนเติมเพิ่ม สำหรับเครื่องดื่มเย็น อาจผสมน้ำผึ้งกับน้ำอุ่นปริมาณเล็กน้อยก่อนนำไปใส่ในแก้วเพื่อให้คนได้ง่ายขึ้น นับน้ำส่วนนี้รวมกับปริมาณเครื่องดื่มด้วย เพื่อไม่ให้รสต่างจากที่ต้องการมากเกินไป ใช้แก้วและปริมาณเครื่องดื่มที่คุ้นเคยเมื่อทดลองครั้งแรก แล้วปรับครั้งละเล็กน้อย",
          },
          {
            title: "เปลี่ยนทีละอย่างเพื่อหาแบบที่ชอบ",
            text: "เมื่ออยากปรับสูตร ลองเปลี่ยนเพียงปริมาณน้ำผึ้งหรือส่วนผสมหนึ่งอย่างต่อครั้ง วิธีนี้ช่วยให้รู้ว่าความต่างที่ชอบมาจากอะไร ไม่จำเป็นต้องใช้ปริมาณเดียวกันกับทุกเมนู จดแบบง่าย ๆ ว่าใช้กับอะไรและชอบประมาณเท่าไร หากทำให้หลายคน ให้แยกส่วนผสมที่เติมเพิ่มได้ไว้บนโต๊ะ เพื่อให้แต่ละคนจัดมื้อของตัวเองตามความชอบ",
          },
          {
            title: "อ่านข้อมูลสินค้าก่อนนำมาใช้",
            text: "ตรวจชื่อ ส่วนประกอบ และคำแนะนำบนกระปุกจริงก่อนใช้ สำหรับ ESHAN ฉลากระบุส่วนประกอบเป็นน้ำผึ้งดอกกาแฟ 100% และน้ำหนักสุทธิ 380 กรัม อ่านคำแนะนำการเก็บรักษาบนกระปุกที่ได้รับ และเก็บบรรจุภัณฑ์ไว้เป็นข้อมูลอ้างอิง หากมีข้อสงสัยเกี่ยวกับสินค้า ให้ส่งชื่อและรายละเอียดบนฉลากผ่านช่องทางติดต่อ เพื่อให้พูดคุยถึงสินค้ารายการเดียวกันได้ชัดเจน",
          },
        ],
      },
      ar: {
        category: "الاستخدام والعناية",
        title: "ثلاث طرق بسيطة للاستمتاع بالعسل على المائدة",
        excerpt: "خبز محمّص، ووعاء زبادي، وفنجانك المفضّل. أفكار صغيرة للاستمتاع كل يوم.",
        intro: "لا تحتاج إلى وصفة معقدة للاستمتاع بعبوة عسل. ابدأ بشيء تحبه، وأضف إليه قليلًا من الحلاوة بما يناسب ذوقك.",
        sections: [
          {
            title: "صباح هادئ مع الخبز المحمّص",
            text: "حمّص خبزك المفضّل، وادهنه بقليل من الزبدة، ثم أضف خيطًا خفيفًا من العسل. ابدأ بنصف ملعقة صغيرة، وتذوّق قبل إضافة المزيد. جرّب شرائح الموز أو فاكهة متوفرة لديك. في البداية، استخدم خبزًا ودرجة تحميص تعرفهما لتلاحظ أثر الإضافة. وإذا كنت تتشارك الإفطار، فدع كل شخص يضبط كمية العسل في حصته.",
          },
          {
            title: "وعاء زبادي على ذوقك",
            text: "ضع زبادي طبيعيًا في وعاء، ثم أضف فاكهة مقطّعة وعسلًا حسب ذوقك. تذوّق المزيج قبل إضافة المزيد من العسل، فقد تختلف الفاكهة من مرة إلى أخرى. وللمسة مقرمشة، أضف غرانولا أو مكسرات تناسب نظامك الغذائي. راعِ احتياجاتك الغذائية عند اختيار كل مكوّن. وابدأ بعدد قليل من المكوّنات ليسهل تذكّر التركيبة التي أعجبتك أكثر.",
          },
          {
            title: "فنجانك المفضّل",
            text: "جرّب قليلًا من العسل في الشاي أو القهوة، وحرّك جيدًا وتذوّق قبل إضافة المزيد. وللمشروب البارد، امزج العسل أولًا بكمية صغيرة من الماء الدافئ ليسهل امتزاجه. احسب هذا الماء ضمن الكمية الإجمالية للمشروب ليبقى قريبًا مما قصدته. استخدم فنجانًا وكمية مشروب مألوفين في التجربة الأولى، ثم عدّل تدريجيًا.",
          },
          {
            title: "غيّر شيئًا واحدًا في كل مرة",
            text: "عند تعديل فكرة، غيّر كمية العسل أو مكوّنًا آخر واحدًا في كل مرة. يساعدك ذلك على معرفة سبب الفرق الذي أعجبك. ولا تحتاج إلى استخدام كمية واحدة في جميع الأطباق. دوّن ملاحظة بسيطة عن المكوّنات والكمية التقريبية. وعند إعداد الطعام لعدة أشخاص، اترك الإضافات الاختيارية على المائدة ليكمل كل شخص حصته حسب ذوقه.",
          },
          {
            title: "اقرأ معلومات المنتج قبل الاستخدام",
            text: "تحقّق من الاسم والمكوّنات والتعليمات على عبوتك الفعلية. يذكر ملصق ESHAN عسل أزهار القهوة 100% ووزنًا صافيًا قدره 380 غرامًا. اتبع تعليمات الحفظ على العبوة التي تستلمها، واحتفظ بالعبوة للرجوع إليها. وإذا كان لديك سؤال عن المنتج، فاذكر اسمه وتفاصيل الملصق ذات الصلة عند التواصل معنا، ليكون الحديث عن المنتج نفسه.",
          },
        ],
      },
      en: {
        category: "Use & care",
        title: "Three simple ways to bring honey to the table",
        excerpt:
          "Toast, a bowl of yogurt, and your favourite cup. Small ideas for everyday enjoyment.",
        intro:
          "You do not need an elaborate recipe to enjoy a jar of honey. Start with something you already like, and add a little sweetness to suit your taste.",
        sections: [
          {
            title: "A slower morning with toast",
            text: "Toast your favourite bread, spread a little butter, and finish with a light drizzle of honey. Start with half a teaspoon and taste before adding more. Try sliced banana or fruit you already have. Keep the bread and level of toasting familiar at first so you can notice the addition. If you are sharing breakfast, let each person adjust the honey on their own serving.",
          },
          {
            title: "A bowl made your way",
            text: "Spoon plain yogurt into a bowl, then add chopped fruit and honey to taste. Try the combination before adding more honey, since your chosen fruit may vary between bowls. For crunch, add granola or nuts that suit your diet. Choose every ingredient with your own dietary needs in mind. Begin with a few ingredients so it is easy to remember the combination you most enjoyed.",
          },
          {
            title: "Your favourite cup",
            text: "Try a little honey in tea or coffee, stir well, and taste before adding more. For a cold drink, first mix the honey with a small amount of warm water to help it blend. Include that water in the total drink quantity so the result stays close to what you intended. Use a familiar cup and drink amount for your first attempt, then adjust a little at a time.",
          },
          {
            title: "Change one thing at a time",
            text: "When adapting an idea, change the honey quantity or one other ingredient at a time. This helps you identify what made the difference you enjoyed. There is no need to use the same amount in every dish. Keep a simple note of the combination and approximate quantity. When preparing food for several people, leave optional additions on the table so each person can finish their own serving.",
          },
          {
            title: "Read the product information before use",
            text: "Check the name, ingredients, and instructions on your actual jar. The ESHAN label lists 100% coffee blossom honey and a net weight of 380 g. Follow the storage information on the jar you receive and retain the packaging as a reference. If you have a product question, include its name and relevant label details when contacting us so the conversation refers to the same item.",
          },
        ],
      },
    },
  },
  {
    slug: "care-for-your-jar",
    image: "/images/coffee-ritual.webp",
    content: {
      th: {
        category: "ใช้และดูแล",
        title: "อ่านฉลาก เก็บให้ถูก และเพลิดเพลินกับทุกกระปุก",
        excerpt:
          "สิ่งที่ควรรู้เกี่ยวกับวิธีเก็บรักษา และข้อมูลที่ควรตรวจสอบบนกระปุกที่คุณได้รับ",
        intro:
          "การดูแลน้ำผึ้งเริ่มต้นจากคำแนะนำของผู้ผลิต ฉลากบนกระปุกจริงเป็นข้อมูลอ้างอิงสำหรับสินค้าที่คุณได้รับเสมอ",
        sections: [
          {
            title: "ตรวจสินค้าที่ได้รับก่อนนำไปเก็บ",
            text: "เปรียบเทียบชื่อสินค้า ขนาด และจำนวนกับรายการที่สั่ง แล้วดูว่าข้อมูลบนบรรจุภัณฑ์อ่านได้ชัดเจนหรือไม่ หากพบสิ่งที่ต้องการสอบถาม ให้เก็บภาพของกระปุก บรรจุภัณฑ์ และรายละเอียดที่เกี่ยวข้องไว้ก่อน ข้อมูลเหล่านี้ช่วยอธิบายข้อสังเกตได้ตรงกว่าเพียงข้อความสั้น ๆ และช่วยให้พูดคุยเกี่ยวกับสินค้าและคำสั่งซื้อเดียวกันได้โดยไม่ต้องคาดเดา",
          },
          {
            title: "เก็บรักษาตามฉลาก",
            text: "ฉลาก ESHAN ระบุให้เก็บรักษาที่อุณหภูมิห้อง ตรวจสอบคำแนะนำบนกระปุกที่ได้รับอีกครั้งก่อนจัดเก็บ เพราะเป็นข้อมูลอ้างอิงของสินค้าล็อตนั้นโดยตรง เลือกพื้นที่เก็บโดยดูคำแนะนำทั้งหมดที่ผู้ผลิตให้มา ไม่ยึดวิธีดูแลของสินค้าอีกชนิดแทน หากคำแนะนำส่วนใดอ่านไม่ชัดหรือยังมีคำถาม ให้เก็บภาพฉลากไว้ประกอบการสอบถามก่อนเปลี่ยนวิธีเก็บรักษา",
          },
          {
            title: "ตรวจสอบวันที่บนกระปุก",
            text: "มองหาวันผลิต วันหมดอายุ และเลขล็อตที่พิมพ์บนบรรจุภัณฑ์ ภาพบนเว็บไซต์ใช้ประกอบการแสดงสินค้า วันที่ในภาพจึงไม่ใช่การยืนยันวันที่ของกระปุกที่จะจัดส่ง หากซื้อหลายกระปุก ให้ดูข้อมูลของสินค้าที่ได้รับและจัดวางให้เห็นรายละเอียดได้สะดวก หากวันที่เป็นส่วนสำคัญของแผนใช้งาน ควรสอบถามข้อมูลก่อนสั่งซื้อแทนการคาดเดาจากภาพประกอบ",
          },
          {
            title: "เก็บข้อมูลสำคัญไว้ให้หาได้ง่าย",
            text: "ถ่ายภาพฉลากที่เห็นชื่อสินค้า วันที่ และเลขล็อตได้ชัดเจน แล้วเก็บไว้กับข้อมูลการสั่งซื้อ หากมีหลายกระปุกหรือหลายรายการ ให้ระบุว่าแต่ละภาพเป็นของรายการใด เก็บบรรจุภัณฑ์ที่มีข้อมูลสำคัญไว้ด้วยเมื่อจำเป็นต้องสอบถาม การจัดข้อมูลเล็กน้อยตั้งแต่ต้นช่วยให้คุณส่งรายละเอียดได้ครบขึ้นเมื่อต้องติดต่อ และลดความสับสนระหว่างสินค้าที่ซื้อคนละครั้ง",
          },
          {
            title: "หากมีข้อสงสัยเกี่ยวกับสินค้า",
            text: "ติดต่อผ่านช่องทางที่ระบุในหน้าติดต่อเรา พร้อมชื่อสินค้า ข้อมูลคำสั่งซื้อ และข้อสังเกตที่ต้องการสอบถาม หากคำถามเกี่ยวกับฉลากหรือบรรจุภัณฑ์ ให้แนบภาพส่วนที่เกี่ยวข้องและเลขล็อต ไม่จำเป็นต้องสรุปสาเหตุด้วยตัวเองก่อนส่งคำถาม บอกสิ่งที่พบตามจริงก็เพียงพอ หากกำลังเลือกซื้อครั้งถัดไป สามารถระบุขนาด จำนวน และรูปแบบการใช้งานที่ต้องการเพิ่มเติมได้เช่นกัน",
          },
        ],
      },
      ar: {
        category: "الاستخدام والعناية",
        title: "اقرأ الملصق واعتنِ بعبوة العسل",
        excerpt: "دليل بسيط لتعليمات الحفظ وتفاصيل التشغيلة على عبوة العسل.",
        intro: "تبدأ العناية بالعسل باتباع تعليمات الجهة المصنّعة. ويظل الملصق على العبوة التي تستلمها المرجع لذلك المنتج بعينه.",
        sections: [
          {
            title: "تحقّق من المنتج قبل تخزينه",
            text: "قارن اسم المنتج وحجمه وكميته بطلبك، ثم تأكد من وضوح معلومات العبوة. وإذا لاحظت ما تريد الاستفسار عنه، فاحتفظ بصور للعبوة وتغليفها والتفصيل المعني. تمنح هذه الصور مرجعًا أوضح من وصف قصير وحده، وتساعد على إبقاء الحوار مرتبطًا بالمنتج والطلب نفسيهما دون الاعتماد على الافتراضات.",
          },
          {
            title: "اتبع تعليمات الحفظ",
            text: "يوصي ملصق ESHAN بحفظ العسل في درجة حرارة الغرفة. اقرأ ملصق عبوتك قبل حفظها، فهو المرجع المباشر لتلك التشغيلة. راعِ جميع تعليمات الجهة المصنّعة عند اختيار مكان الحفظ، ولا تستبدل بها طريقة العناية بمنتج آخر. وإذا لم تتضح معلومة، فاحتفظ بصورة للملصق واستفسر قبل تغيير طريقة الحفظ.",
          },
          {
            title: "راجع التواريخ على العبوة",
            text: "ابحث عن تاريخ التصنيع وانتهاء الصلاحية ورقم التشغيلة المطبوع على العبوة. صور الموقع تعرّف بالمنتج، ولا تؤكد التواريخ الظاهرة فيها تواريخ العبوة التي ستُرسل إليك. وإذا كان لديك عدة عبوات، فراجع ما استلمته ورتّبه بحيث يسهل الوصول إلى تفاصيله. وإذا أثرت التواريخ في استخدامك المخطط له، فاستفسر قبل الطلب بدل تقديرها من صورة المنتج.",
          },
          {
            title: "اجمع المراجع المفيدة في مكان واحد",
            text: "التقط صورة واضحة تُظهر اسم المنتج والتواريخ ورقم التشغيلة، واحتفظ بها مع تفاصيل طلبك. وإذا كان لديك عدة منتجات، فحدّد المنتج الذي تخصه كل صورة. احتفظ بالعبوة التي تحمل المعلومات المهمة عندما تحتاج إلى الاستفسار. قليل من التنظيم في البداية يساعدك على مشاركة التفاصيل كاملة لاحقًا، ويجنّبك الخلط بين منتجات اشتريتها في طلبات مختلفة.",
          },
          {
            title: "إذا كان لديك سؤال عن المنتج",
            text: "استخدم وسيلة التواصل في صفحة «تواصل معنا»، واذكر اسم المنتج وتفاصيل الطلب وما ترغب في توضيحه. وللاستفسار عن الملصق أو العبوة، أرفق الصورة المناسبة ورقم التشغيلة. لا تحتاج إلى تحديد سبب المشكلة قبل التواصل؛ يكفي وصف ما لاحظته. ويمكنك أيضًا مشاركة الحجم والكمية والاستخدام المقصود إذا كنت تخطط لشراء لاحق.",
          },
        ],
      },
      en: {
        category: "Use & care",
        title: "Read the label. Care for your jar.",
        excerpt:
          "A simple guide to the storage instructions and batch details on your honey.",
        intro:
          "Looking after your honey starts with the maker’s instructions. The label on the jar you receive is always the reference for that particular product.",
        sections: [
          {
            title: "Check the item before putting it away",
            text: "Compare the product name, size, and quantity with your order, then check that the packaging information is readable. If you notice something you would like to ask about, keep photographs of the jar, packaging, and relevant detail. These provide a clearer reference than a short description alone and help keep the conversation connected to the same product and order without relying on assumptions.",
          },
          {
            title: "Follow the storage instructions",
            text: "The ESHAN label says to keep the honey at room temperature. Read your own jar before storing it, as its packaging is the direct reference for that batch. Consider the full instructions supplied by the maker when choosing a storage place. Do not substitute the care routine for a different product. If anything is unclear, keep a label photograph and ask before changing how you store it.",
          },
          {
            title: "Check the dates on your jar",
            text: "Look for the manufacture date, expiry date, and lot number printed on the packaging. Website photographs illustrate the product; the dates shown do not confirm the dates of a jar that will be dispatched. With several jars, review the items received and arrange them so their details remain accessible. If dates matter to your planned use, ask before ordering instead of estimating them from a product photograph.",
          },
          {
            title: "Keep the useful references together",
            text: "Take a clear photograph showing the product name, dates, and lot number, and keep it with your order details. For several items, identify which photograph belongs to which product. Retain packaging that carries relevant information when you need to ask a question. A small amount of organisation at the beginning helps you share complete details later and avoids confusing products bought in separate orders.",
          },
          {
            title: "If you have a product question",
            text: "Use the contact route on our contact page and include the product name, order details, and what you would like to clarify. For a label or packaging question, include the relevant photograph and lot number. You do not need to diagnose a cause before contacting us; describe what you observed. For a future purchase, you can also share the size, quantity, and intended use you are considering.",
          },
        ],
      },
    },
  },
] as const satisfies readonly JournalArticle[];

export type JournalSlug = (typeof journalArticles)[number]["slug"];

export function findArticle(slug: string) {
  return journalArticles.find((article) => article.slug === slug);
}

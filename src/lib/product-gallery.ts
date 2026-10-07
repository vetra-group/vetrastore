import type { CatalogProduct, ProductGalleryImage } from "./catalog";

// Legacy products inherit the original gallery until an editor explicitly saves
// a gallery. An empty saved array intentionally returns to the main packshot.
export function defaultHoneyGallery(product: CatalogProduct): ProductGalleryImage[] {
  return [
    { id: "product", src: product.image, alt: { th: product.card.th.imageAlt, en: product.card.en.imageAlt, ar: product.card.ar.imageAlt }, caption: { th: "ภาพสินค้า", en: "Product", ar: "المنتج" } },
    { id: "front", src: "/images/honey-front.jpg", alt: { th: "ฉลากด้านหน้าน้ำผึ้งดอกกาแฟ ESHAN", en: "Front label of ESHAN coffee blossom honey", ar: "الملصق الأمامي لعبوة عسل أزهار القهوة من ESHAN" }, caption: { th: "ฉลากด้านหน้า", en: "Front label", ar: "الملصق الأمامي" } },
    { id: "back", src: "/images/honey-back.jpg", alt: { th: "ฉลากด้านหลังน้ำผึ้งดอกกาแฟ ESHAN", en: "Back label of ESHAN coffee blossom honey", ar: "الملصق الخلفي لعبوة عسل أزهار القهوة من ESHAN" }, caption: { th: "ฉลากด้านหลัง", en: "Back label", ar: "الملصق الخلفي" } },
    { id: "lifestyle", src: "/images/hero-eshan-4.webp", alt: { th: "ภาพประกอบน้ำผึ้งดอกกาแฟกับอาหารเช้า", en: "Illustrative coffee blossom honey breakfast scene", ar: "مشهد توضيحي لعسل أزهار القهوة مع الإفطار" }, caption: { th: "ไอเดียการรับประทาน", en: "Serving inspiration", ar: "أفكار للتقديم" } },
  ];
}

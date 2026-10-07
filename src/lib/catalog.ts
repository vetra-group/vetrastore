import type { Locale, Localized } from "./i18n";

export const HONEY_ID = "coffee-blossom-honey";
export const MAX_QUANTITY = 20;
export type ProductCategory = "honey" | "coffee";
export type ProductGalleryImage = { id: string; src: string; alt: Localized<string>; caption?: Localized<string> };
export type CatalogProduct = {
  id: string;
  slug: string;
  brand: string;
  category: ProductCategory;
  price: number;
  weight: number;
  image: string;
  gallery?: readonly ProductGalleryImage[];
  previousSlugs?: readonly string[];
  searchTerms: readonly string[];
  name: Localized<string>;
  description: Localized<string>;
  card: Localized<{ captionPrefix: string; imageAlt: string; cta: string }>;
};
export const honey = {
  id: HONEY_ID,
  slug: HONEY_ID,
  brand: "ESHAN",
  category: "honey",
  price: 480,
  weight: 380,
  image: "/images/honey-product.png",
  searchTerms: ["ESHAN", "อิชาน", "إيشان", "عسل", "أزهار القهوة"],
  name: {
    ar: "عسل أزهار القهوة",
    th: "น้ำผึ้งดอกกาแฟ",
    en: "Coffee Blossom Honey",
  } satisfies Localized<string>,
  description: {
    ar: "عسل أزهار القهوة 100% من ESHAN، من شمال تايلاند. عبوة بوزن 380 غرامًا للأطعمة والمشروبات.",
    th: "น้ำผึ้งดอกกาแฟ 100% ตรา ESHAN จากภาคเหนือของไทย ขนาด 380 กรัม สำหรับอาหารและเครื่องดื่ม",
    en: "100% coffee blossom honey by ESHAN from northern Thailand. A 380 g jar for food and drinks.",
  } satisfies Localized<string>,
  card: {
    ar: {
      captionPrefix: "عسل أزهار القهوة 100%",
      imageAlt: "عسل أزهار القهوة من ESHAN، عبوة بوزن 380 غرامًا",
      cta: "اكتشف العسل",
    },
    th: {
      captionPrefix: "น้ำผึ้งดอกกาแฟ 100%",
      imageAlt: "น้ำผึ้งดอกกาแฟอิชาน ขนาด 380 กรัม",
      cta: "รู้จักน้ำผึ้งของเรา",
    },
    en: {
      captionPrefix: "100% coffee blossom honey",
      imageAlt: "ESHAN coffee blossom honey, 380 g jar",
      cta: "Discover the honey",
    },
  },
} satisfies CatalogProduct;

// Add a product here only after its own detail page and order flow are ready.
export const catalogProducts: readonly CatalogProduct[] = defineCatalog([honey]);

function defineCatalog(products: readonly CatalogProduct[]) {
  const ids = new Set<string>();
  const slugs = new Set<string>();
  for (const product of products) {
    if (ids.has(product.id) || slugs.has(product.slug)) {
      throw new Error(`Duplicate catalog product: ${product.id} / ${product.slug}`);
    }
    ids.add(product.id);
    slugs.add(product.slug);
  }
  return products;
}

export function formatProductCaption(
  product: CatalogProduct,
  locale: Locale,
  weightUnit: string,
) {
  return `${product.card[locale].captionPrefix} · ${product.weight} ${weightUnit}`;
}

export function formatPrice(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "THB",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

import type { Locale, Localized } from "./i18n";

export const HONEY_ID = "coffee-blossom-honey";
export const MAX_QUANTITY = 96;
export type ProductCategory = "honey" | "coffee";
export type ProductGalleryImage = { id: string; src: string; alt: Localized<string>; caption?: Localized<string> };
export type Currency = "THB" | "USD";
export type PriceTier = { quantity: number; total: number };
export type ProductPricing = Record<Currency, PriceTier[]>;
export type CatalogProduct = {
  id: string;
  slug: string;
  brand: string;
  category: ProductCategory;
  price: number;
  pricing?: ProductPricing;
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
  price: 380,
  pricing: {
    THB: [
      { quantity: 1, total: 380 },
      { quantity: 2, total: 700 },
      { quantity: 6, total: 1980 },
      { quantity: 12, total: 3800 },
      { quantity: 24, total: 7200 },
      { quantity: 48, total: 13000 },
      { quantity: 96, total: 24000 },
    ],
    // Initial foreign schedule: five times each THB bundle, at a fixed
    // pricing basis of THB 35 per USD. CMS editors can set each USD total.
    USD: [
      { quantity: 1, total: 54.29 },
      { quantity: 2, total: 100 },
      { quantity: 6, total: 282.86 },
      { quantity: 12, total: 542.86 },
      { quantity: 24, total: 1028.57 },
      { quantity: 48, total: 1857.14 },
      { quantity: 96, total: 3428.57 },
    ],
  },
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

export function currencyForLocale(locale: Locale): Currency {
  return locale === "th" ? "THB" : "USD";
}

const toMinorUnits = (value: number) => Math.round(value * 100);

/** Price an exact bottle count with the least expensive combination of packs.
 * Both the browser and server use this function so cart totals cannot drift. */
export function quoteProduct(product: CatalogProduct, quantity: number, locale: Locale) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    throw new RangeError("Choose a valid product quantity.");
  }
  const currency = currencyForLocale(locale);
  const tiers = product.pricing?.[currency];
  if (!tiers?.length) {
    if (currency !== "THB") throw new Error(`USD price unavailable for ${product.id}.`);
    const total = Math.round(toMinorUnits(product.price) * quantity) / 100;
    return { currency, total, unitPrice: product.price };
  }
  const totals = new Array<number>(quantity + 1).fill(Number.POSITIVE_INFINITY);
  totals[0] = 0;
  for (let count = 1; count <= quantity; count++) {
    for (const tier of tiers) {
      if (tier.quantity <= count) {
        totals[count] = Math.min(totals[count], totals[count - tier.quantity] + toMinorUnits(tier.total));
      }
    }
  }
  if (!Number.isFinite(totals[quantity])) throw new Error(`No ${currency} price for ${quantity} bottles of ${product.id}.`);
  const total = totals[quantity] / 100;
  return { currency, total, unitPrice: total / quantity };
}

export function formatPrice(value: number, locale: Locale, currency: Currency = "THB") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: currency === "USD" ? "code" : "narrowSymbol",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

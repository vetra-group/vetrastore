import type { Locale, Localized } from "./i18n";

export const HONEY_ID = "coffee-blossom-honey";
export const MAX_QUANTITY = 192;
export type Market = "TH" | "INTL";
export const displayCurrencies = ["AED", "SAR", "KWD", "QAR", "MYR", "BND", "SGD", "CAD", "AUD", "GBP", "EUR", "USD", "THB"] as const;
export type DisplayCurrency = (typeof displayCurrencies)[number];
export type ProductCategory = "honey" | "coffee";
export type ProductGalleryImage = { id: string; src: string; alt: Localized<string>; caption?: Localized<string> };
export type Currency = "THB" | "USD";
export type PriceTier = { quantity: number; total: number };
export type ProductPricing = { THB: PriceTier[]; internationalTHB?: PriceTier[]; USD?: PriceTier[] };
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
      { quantity: 4, total: 1360 },
      { quantity: 6, total: 1980 },
      { quantity: 12, total: 3800 },
      { quantity: 24, total: 7200 },
      { quantity: 48, total: 13000 },
      { quantity: 96, total: 24000 },
      { quantity: 192, total: 46000 },
    ],
    internationalTHB: [
      { quantity: 1, total: 5000 },
      { quantity: 2, total: 8000 },
      { quantity: 4, total: 11200 },
      { quantity: 6, total: 13200 },
      { quantity: 12, total: 21600 },
      { quantity: 24, total: 38400 },
      { quantity: 48, total: 67200 },
      { quantity: 96, total: 115200 },
      { quantity: 192, total: 192000 },
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

export function priceTiers(product: CatalogProduct, market: Market): readonly PriceTier[] {
  return market === "TH" ? product.pricing?.THB ?? [{ quantity: 1, total: product.price }] : product.pricing?.internationalTHB ?? [];
}

export function allowedQuantities(product: CatalogProduct, market: Market): number[] {
  return priceTiers(product, market).map((tier) => tier.quantity);
}

const toMinorUnits = (value: number) => Math.round(value * 100);

/** The listed bundles are the only purchasable quantities in each market. */
export function quoteProduct(product: CatalogProduct, quantity: number, market: Market) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    throw new RangeError("Choose a valid product quantity.");
  }
  const tier = priceTiers(product, market).find((entry) => entry.quantity === quantity);
  if (!tier) throw new Error(`No ${market} bundle for ${quantity} bottles of ${product.id}.`);
  const total = toMinorUnits(tier.total) / 100;
  return { currency: "THB" as const, total, unitPrice: total / quantity };
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

import { catalogProducts } from "@/lib/catalog";
import { siteCopy } from "@/content/site";
import { heroSlides } from "@/content/site-structure";
import { honeyStory } from "@/content/honey";
import { commerce } from "@/content/commerce";
import { storeDetails } from "@/content/store-details";
import { journalArticles } from "@/content/editorial";
import { pageCopySources } from "@/content/pages";
import type { CmsContent, CmsState } from "./types";
export { applyCopy } from "./apply-copy";

export const copySources = { site: siteCopy, honey: honeyStory, commerce, store: storeDetails, pages: pageCopySources };
export function flattenCopy(value: unknown, prefix = "", result: Record<string, string> = {}): Record<string, string> {
  if (typeof value === "string") result[prefix] = value;
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, entry]) => flattenCopy(entry, prefix ? `${prefix}.${key}` : key, result));
  return result;
}
export const defaultCopy = flattenCopy(copySources);

// Keep the complete key set for older saved snapshots. The editor offers only
// copy used by the current interface; slide descriptions have their own editor.
const retiredCommerceFields = new Set([
  "coffeeBeansAlt", "coffeeRitualAlt", "coffeePauseAlt", "coffeeEyebrow", "coffeeName", "coffeeIntro",
  "instantEyebrow", "instantName", "instantIntro", "collectionNote", "ourStory", "shop",
  "collectionEyebrow", "collectionTitle", "sort", "featured", "priceLow", "priceHigh", "curated", "size",
  "productEyebrow", "productTagline", "productOrigin", "ingredient", "ingredientValue", "origin", "originValue",
  "storage", "storageValue", "ingredients", "use", "shipping", "detailTitle", "detailBody", "ingredientBody",
  "useBody", "shippingBody", "editorialEyebrow", "editorialTitle", "editorialBody", "frontImage", "backImage",
  "lifestyleImage", "imageLabel", "reference", "demoRetry", "bagShortcut",
]);
export const editableCopy = Object.fromEntries(Object.entries(defaultCopy).filter(([path]) => {
  const [source, group, field, detail] = path.split(".");
  if (source === "site") return !["naturalCollection", "shop", "heroSlideAlts", "heroSlideLinks"].includes(field) && !(field === "links" && detail === "coffeeBlossomHoney");
  if (source === "commerce") return !retiredCommerceFields.has(field);
  if (source === "store") return detail === "description";
  if (source === "pages" && group === "story") return !["body2", "quote", "quoteSub"].includes(detail);
  return true;
}));
export function defaultContent(): CmsContent {
  return {
    products: catalogProducts.map((product) => ({ ...structuredClone(product), status: "published", stock: null, featured: true })),
    slides: heroSlides.map((slide) => ({ ...slide, alt: { en: siteCopy.en.heroSlideAlts[slide.key], ar: siteCopy.ar.heroSlideAlts[slide.key], th: siteCopy.th.heroSlideAlts[slide.key] }, linkLabel: { en: siteCopy.en.heroSlideLinks[slide.key], ar: siteCopy.ar.heroSlideLinks[slide.key], th: siteCopy.th.heroSlideLinks[slide.key] }, enabled: true })),
    articles: journalArticles.map((article) => ({ ...structuredClone(article), status: "published" })),
    copy: {}, media: [], settings: { storeName: "VETRA STORE", email: "", phone: "", address: { en: "", ar: "", th: "" }, currency: "THB" },
  };
}
export function defaultState(): CmsState {
  const content = defaultContent();
  return { version: 1, revision: 0, draft: structuredClone(content), published: content, publishedAt: null, audit: [], trash: [] };
}

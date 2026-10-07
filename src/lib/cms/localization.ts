import type { Locale } from "@/lib/i18n";
import type { CatalogProduct } from "@/lib/catalog";
import type { CmsArticle, CmsContent, CmsSlide } from "./types";

function blank(value: unknown): unknown {
  if (typeof value === "string") return "";
  if (Array.isArray(value)) return [];
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, blank(entry)]));
  return value;
}

/** Add missing Arabic in memory. Never replace an existing translation or infer
 * a translation for edited copy from a different English/Thai source. */
export function upgradeLocalized(value: unknown, seed?: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry, index) => upgradeLocalized(entry, Array.isArray(seed) ? seed[index] : undefined));
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const source = seed && typeof seed === "object" ? seed as Record<string, unknown> : undefined;
  if (Object.hasOwn(record, "en") && Object.hasOwn(record, "th")) {
    if (Object.hasOwn(record, "ar")) return value;
    const matches = source && JSON.stringify(record.en) === JSON.stringify(source.en) && JSON.stringify(record.th) === JSON.stringify(source.th);
    return { ...record, ar: matches && source.ar !== undefined ? structuredClone(source.ar) : blank(record.en) };
  }
  return Object.fromEntries(Object.entries(record).map(([key, entry]) => [key, upgradeLocalized(entry, source?.[key])]));
}

export function productLocaleReady(product: CatalogProduct, locale: Locale): boolean {
  const card = product.card[locale];
  return !!product.name[locale]?.trim() && !!product.description[locale]?.trim() && !!card?.captionPrefix.trim() && !!card?.imageAlt.trim() && !!card?.cta.trim() && (product.gallery ?? []).every((image) => !!image.alt[locale]?.trim());
}

export function articleLocaleReady(article: CmsArticle, locale: Locale): boolean {
  const copy = article.content[locale];
  return !!copy?.title.trim() && !!copy.category.trim() && !!copy.excerpt.trim() && !!copy.intro.trim() && copy.sections.length > 0 && copy.sections.every((section) => !!section.title.trim() && (!!section.text.trim() || !!section.bullets?.length || !!section.table || !!section.image));
}

export function slideLocaleReady(slide: CmsSlide, locale: Locale): boolean {
  return !!slide.alt[locale]?.trim() && !!slide.linkLabel[locale]?.trim();
}

export function untranslatedCopyKeys(content: CmsContent, defaults: Record<string, string>): string[] {
  return [...new Set(Object.entries(content.copy).filter(([key, value]) => /\.(en|th)\./.test(key) && value !== defaults[key]).map(([key]) => key.replace(/\.(en|th)\./, ".ar.")).filter((key) => key in defaults && !content.copy[key]?.trim()))];
}

import { HONEY_ID, type CatalogProduct } from "./catalog";
import { productLocaleReady } from "./cms/localization";
import { locales, localizedPath, type Locale } from "./i18n";

/** A saved item remains usable when its requested translation is incomplete.
 * Link only to a complete public detail page; never create a translated page
 * by treating English copy as Arabic. Prices and quantities stay authoritative. */
export function savedProductDetails(product: CatalogProduct, requested: Locale) {
  const candidates: Locale[] = [...new Set<Locale>([requested, "en", "th", ...locales])];
  const detailLocale = candidates.find((locale) => productLocaleReady(product, locale));
  const textLocale = detailLocale ?? candidates.find((locale) => product.name[locale]?.trim()) ?? "en";
  const name = product.name[textLocale]?.trim() || product.brand || product.id;
  return {
    ready: Boolean(detailLocale),
    locale: textLocale,
    fallback: textLocale !== requested || !detailLocale,
    name,
    alt: product.card[textLocale]?.imageAlt?.trim() || name,
    href: detailLocale
      ? localizedPath(detailLocale, product.id === HONEY_ID ? "/coffee-blossom-honey" : `/products/${product.slug}`)
      : localizedPath(requested, "/products"),
  };
}

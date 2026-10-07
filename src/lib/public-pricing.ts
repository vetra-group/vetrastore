import { currencyForLocale, quoteProduct, type CatalogProduct } from "./catalog";
import type { Locale } from "./i18n";

/** A missing USD schedule must not display a Thai amount with a dollar symbol. */
export function publicQuote(product: CatalogProduct, quantity: number, locale: Locale) {
  const currency = currencyForLocale(locale);
  if (currency === "USD" && !product.pricing?.USD?.length) return null;
  return quoteProduct(product, quantity, locale);
}

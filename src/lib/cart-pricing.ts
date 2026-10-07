import { currencyForLocale, quoteProduct, type CatalogProduct } from "./catalog";
import type { CartItem } from "./cart";
import type { Locale } from "./i18n";

/** Reprice the whole bag from current published products. Never trust amounts sent by a browser. */
export function quoteCart(items: readonly CartItem[], products: readonly CatalogProduct[], locale: Locale) {
  const currency = currencyForLocale(locale);
  const lines = items.map(({ id, quantity }) => {
    const product = products.find((entry) => entry.id === id);
    if (!product) throw new Error("Product is unavailable.");
    const quote = quoteProduct(product, quantity, locale);
    if (quote.currency !== currency) throw new Error("Currencies in a bag must match.");
    return { id, quantity, unitPrice: quote.unitPrice, lineTotal: quote.total };
  });
  return { currency, items: lines, subtotal: lines.reduce((sum, line) => sum + Math.round(line.lineTotal * 100), 0) / 100 };
}

export function tryQuoteCart(items: readonly CartItem[], products: readonly CatalogProduct[], locale: Locale) {
  try { return quoteCart(items, products, locale); }
  catch { return null; }
}

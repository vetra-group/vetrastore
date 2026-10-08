import { allowedQuantities, catalogProducts, displayCurrencies, type CatalogProduct, type DisplayCurrency, type Market } from "./catalog";
import { cartQuantityLimit } from "./cart-actions";
import { isLocale, type Locale } from "./i18n";

export type CartItem = { id: string; quantity: number };
export const STORE_KEY = "vetra-store-v1";
export type StoredCart = { items: CartItem[]; wishlist: string[]; market: Market; displayCurrency: DisplayCurrency; displayCurrencyLocale?: Locale };
export function defaultDisplayCurrency(locale: Locale): DisplayCurrency {
  return locale === "th" ? "THB" : "USD";
}
export function parseStoredCart(value: unknown, products: readonly CatalogProduct[] = catalogProducts, marketOverride?: Market, localeOverride?: Locale): StoredCart {
  if (!value || typeof value !== "object") return { items: [], wishlist: [], market: marketOverride ?? "TH", displayCurrency: localeOverride ? defaultDisplayCurrency(localeOverride) : "USD" };
  const data = value as Record<string, unknown>;
  const market: Market = marketOverride ?? (data.market === "INTL" ? "INTL" : "TH");
  const displayCurrencyLocale = typeof data.displayCurrencyLocale === "string" && isLocale(data.displayCurrencyLocale) ? data.displayCurrencyLocale : undefined;
  const quantities = new Map<string, number>();
  if (Array.isArray(data.items)) {
    for (const entry of data.items) {
      const product = products.find((product) => product.id === entry?.id);
      const limit = cartQuantityLimit(product);
      if (!entry || !product || !Number.isInteger(entry.quantity) || entry.quantity <= 0 || !limit) continue;
      if (product.pricing) {
        const bundles = allowedQuantities(product, market).filter((quantity) => quantity <= limit);
        if (!bundles.length || !allowedQuantities(product, market).includes(entry.quantity)) continue;
        quantities.set(product.id, entry.quantity <= limit ? entry.quantity : bundles[bundles.length - 1]);
      } else {
        quantities.set(product.id, Math.min(limit, (quantities.get(product.id) ?? 0) + entry.quantity));
      }
    }
  }
  return {
    market,
    displayCurrency: localeOverride && displayCurrencyLocale !== localeOverride ? defaultDisplayCurrency(localeOverride) : typeof data.displayCurrency === "string" && displayCurrencies.includes(data.displayCurrency as DisplayCurrency) ? data.displayCurrency as DisplayCurrency : "USD",
    ...(displayCurrencyLocale ? { displayCurrencyLocale } : {}),
    items: [...quantities].filter(([, quantity]) => quantity > 0).map(([id, quantity]) => ({ id, quantity })),
    wishlist:
      Array.isArray(data.wishlist) ? [...new Set(data.wishlist.filter((id): id is string => typeof id === "string" && products.some((product) => product.id === id)))] : [],
  };
}

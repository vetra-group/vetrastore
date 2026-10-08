import { quoteProduct, type CatalogProduct, type Market } from "./catalog";

export function publicQuote(product: CatalogProduct, quantity: number, market: Market = "TH") {
  try { return quoteProduct(product, quantity, market); }
  catch { return null; }
}

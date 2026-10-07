import { MAX_QUANTITY, quoteProduct, type CatalogProduct, type Currency } from "../catalog";
import type { CartItem } from "../cart";
import type { Locale } from "../i18n";

/** The fixed display basis for the current foreign price schedule. This is a
 * merchandising price conversion, not a live exchange-rate quote. */
export const FOREIGN_THB_PER_USD = 35;

export type PaymentOrderLine = {
  id: string;
  quantity: number;
  /** Exact charged THB amount for this line. A bundle can have a fractional
   * average unit price, so the line total is authoritative. */
  lineTotal: number;
  lineTotalMinor: number;
};

export type PaymentDisplayLine = { id: string; quantity: number; lineTotal: number };

export type PaymentOrderQuote = {
  currency: "THB";
  items: PaymentOrderLine[];
  subtotal: number;
  subtotalMinor: number;
  display: {
    currency: Currency;
    approximate: boolean;
    items: PaymentDisplayLine[];
    subtotal: number;
  };
};

/** Build a THB charge snapshot only from the server's published product data.
 * Thai prices use the published THB tiers. Foreign prices use the separately
 * editable USD tiers, then convert each entire line to whole THB at the fixed
 * pricing basis. The USD display is approximate because THB is charged. */
export function quotePaymentOrder(
  items: readonly CartItem[],
  products: readonly CatalogProduct[],
  locale: Locale,
): PaymentOrderQuote {
  if (!Array.isArray(items) || items.length < 1 || items.length > 200) {
    throw new Error("Choose a valid bag.");
  }
  if (locale !== "th" && locale !== "en" && locale !== "ar") {
    throw new Error("Choose a valid language.");
  }
  const foreign = locale !== "th";
  const seen = new Set<string>();
  const chargeLines: PaymentOrderLine[] = [];
  const displayLines: PaymentDisplayLine[] = [];
  for (const item of items) {
    if (
      !item || typeof item.id !== "string" || seen.has(item.id) ||
      !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY
    ) throw new Error("Choose a valid bag.");
    seen.add(item.id);
    const product = products.find((candidate) => candidate.id === item.id);
    if (!product) throw new Error("Product is unavailable.");
    const displayed = quoteProduct(product, item.quantity, locale);
    const displayMinor = Math.round(displayed.total * 100);
    // Multiplying integer USD cents avoids a floating-point edge at a .5-baht
    // boundary. A THB tier retains its published satang precision.
    const chargeMinor = foreign
      ? Math.round((displayMinor * FOREIGN_THB_PER_USD) / 100) * 100
      : displayMinor;
    if (!Number.isSafeInteger(chargeMinor) || chargeMinor < 1) {
      throw new Error("The current price is unavailable.");
    }
    chargeLines.push({ id: item.id, quantity: item.quantity, lineTotal: chargeMinor / 100, lineTotalMinor: chargeMinor });
    displayLines.push({ id: item.id, quantity: item.quantity, lineTotal: displayMinor / 100 });
  }
  const subtotalMinor = chargeLines.reduce((total, line) => total + line.lineTotalMinor, 0);
  if (!Number.isSafeInteger(subtotalMinor)) throw new Error("The order total is unavailable.");
  const displaySubtotalMinor = displayLines.reduce((total, line) => total + Math.round(line.lineTotal * 100), 0);
  return {
    currency: "THB",
    items: chargeLines,
    subtotal: subtotalMinor / 100,
    subtotalMinor,
    display: {
      currency: foreign ? "USD" : "THB",
      approximate: foreign,
      items: displayLines,
      subtotal: displaySubtotalMinor / 100,
    },
  };
}

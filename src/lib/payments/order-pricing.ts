import { MAX_QUANTITY, quoteProduct, type CatalogProduct, type Currency } from "../catalog";
import type { CartItem } from "../cart";
import type { Locale } from "../i18n";

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

/** Build an exact THB charge snapshot from the server's Thai bundle prices. */
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
    const displayed = quoteProduct(product, item.quantity, "TH");
    const displayMinor = Math.round(displayed.total * 100);
    const chargeMinor = displayMinor;
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
      currency: "THB",
      approximate: false,
      items: displayLines,
      subtotal: displaySubtotalMinor / 100,
    },
  };
}

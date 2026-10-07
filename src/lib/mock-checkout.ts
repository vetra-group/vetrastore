import type { CatalogProduct } from "./catalog";

// Local simulations only. These rules never become published shipping terms.
export type MockShippingRule = { id: string; label: string; postcodePrefix: string; fee: number; freeOver: number | null };
export type MockShippingQuote = { state: "quoted"; ruleId: string; label: string; postcode: string; subtotal: number; fee: number; total: number } | { state: "pending"; reason: "unconfigured" | "destination-missing" | "unsupported"; postcode: string; subtotal: number; fee: null; total: null };
export type MockInventoryHold = { orderId: string; items: { id: string; quantity: number }[]; state: "reserved" | "committed" | "released"; expiresAt?: string };
export const MOCK_RESERVATION_MS = 15 * 60 * 1000;
export class MockStockError extends Error {}
const cents = (value: number) => Math.round(value * 100) / 100;
const amount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1_000_000 && Math.abs(cents(value) - value) < 0.000001;

export function normalizeMockShippingRules(value: unknown): MockShippingRule[] {
  if (!Array.isArray(value) || value.length > 20) throw new Error("Check simulated shipping rules");
  const ids = new Set<string>(), prefixes = new Set<string>();
  return value.map((rule) => {
    if (!rule || typeof rule !== "object" || typeof rule.id !== "string" || !/^[\w-]{1,100}$/.test(rule.id) || ids.has(rule.id) || typeof rule.label !== "string" || !rule.label.trim() || rule.label.length > 100 || typeof rule.postcodePrefix !== "string" || !/^(\*|\d{1,5})$/.test(rule.postcodePrefix) || prefixes.has(rule.postcodePrefix) || !amount(rule.fee) || (rule.freeOver !== null && !amount(rule.freeOver))) throw new Error("Check simulated shipping rules");
    ids.add(rule.id); prefixes.add(rule.postcodePrefix);
    return { id: rule.id, label: rule.label.trim(), postcodePrefix: rule.postcodePrefix, fee: rule.fee, freeOver: rule.freeOver };
  });
}

export function quoteMockShipping(rules: readonly MockShippingRule[], postcode: string, subtotal: number): MockShippingQuote {
  if (!Number.isFinite(subtotal) || subtotal < 0 || typeof postcode !== "string" || postcode.length > 1000) throw new Error("Check simulated shipping details");
  const destination = postcode.trim(), value = cents(subtotal);
  const pending = (reason: "unconfigured" | "destination-missing" | "unsupported"): MockShippingQuote => ({ state: "pending", reason, postcode: destination, subtotal: value, fee: null, total: null });
  const validated = normalizeMockShippingRules(rules);
  if (!validated.length) return pending("unconfigured");
  if (!/^\d{5}$/.test(destination)) return pending("destination-missing");
  const rule = validated.sort((a, b) => (b.postcodePrefix === "*" ? 0 : b.postcodePrefix.length) - (a.postcodePrefix === "*" ? 0 : a.postcodePrefix.length)).find((entry) => entry.postcodePrefix === "*" || destination.startsWith(entry.postcodePrefix));
  if (!rule) return pending("unsupported");
  const fee = rule.freeOver !== null && value >= rule.freeOver ? 0 : rule.fee;
  return { state: "quoted", ruleId: rule.id, label: rule.label, postcode: destination, subtotal: value, fee, total: cents(value + fee) };
}

export function parseMockShippingQuote(value: unknown, subtotal: number): MockShippingQuote | undefined {
  if (!value || typeof value !== "object") return undefined;
  const quote = value as MockShippingQuote;
  if (typeof quote.postcode !== "string" || quote.postcode.length > 1000 || quote.subtotal !== cents(subtotal)) return undefined;
  if (quote.state === "pending" && ["unconfigured", "destination-missing", "unsupported"].includes(quote.reason) && quote.fee === null && quote.total === null) return { state: "pending", reason: quote.reason, postcode: quote.postcode, subtotal: quote.subtotal, fee: null, total: null };
  if (quote.state === "quoted" && typeof quote.ruleId === "string" && /^[\w-]{1,100}$/.test(quote.ruleId) && typeof quote.label === "string" && quote.label.length <= 100 && amount(quote.fee) && quote.total === cents(quote.subtotal + quote.fee)) return { state: "quoted", ruleId: quote.ruleId, label: quote.label, postcode: quote.postcode, subtotal: quote.subtotal, fee: quote.fee, total: quote.total };
  return undefined;
}

export function parseMockInventory(value: unknown): MockInventoryHold[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  return value.filter((hold): hold is MockInventoryHold => {
    if (!hold || typeof hold !== "object" || typeof hold.orderId !== "string" || !/^[\w-]{1,100}$/.test(hold.orderId) || ids.has(hold.orderId) || !["reserved", "committed", "released"].includes(hold.state) || !Array.isArray(hold.items) || !hold.items.length || hold.items.length > 200 || hold.items.some((item: { id?: unknown; quantity?: unknown }) => !item || typeof item.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(item.id) || !Number.isSafeInteger(item.quantity) || Number(item.quantity) < 1 || Number(item.quantity) > 20) || new Set(hold.items.map((item: { id: string }) => item.id)).size !== hold.items.length || (hold.state === "reserved" && (typeof hold.expiresAt !== "string" || !Number.isFinite(Date.parse(hold.expiresAt))))) return false;
    ids.add(hold.orderId); return true;
  }).map((hold) => ({ orderId: hold.orderId, items: hold.items.map(({ id, quantity }) => ({ id, quantity })), state: hold.state, ...(hold.state === "reserved" ? { expiresAt: hold.expiresAt } : {}) }));
}

export function expireMockInventory(holds: MockInventoryHold[], now: number): MockInventoryHold[] {
  let changed = false;
  const result = holds.map((hold) => {
    if (hold.state !== "reserved" || Date.parse(hold.expiresAt!) > now) return hold;
    changed = true; return { orderId: hold.orderId, items: hold.items, state: "released" as const };
  });
  return changed ? result : holds;
}

export function availableMockStock(product: CatalogProduct, holds: readonly MockInventoryHold[], now = Date.now(), exceptOrder?: string): number | null {
  if (!("stock" in product) || typeof product.stock !== "number") return null;
  const used = holds.reduce((sum, hold) => sum + (hold.orderId !== exceptOrder && (hold.state === "committed" || (hold.state === "reserved" && Date.parse(hold.expiresAt!) > now)) ? hold.items.find((item) => item.id === product.id)?.quantity || 0 : 0), 0);
  return Math.max(0, product.stock - used);
}

export function allocateMockStock(holds: readonly MockInventoryHold[], orderId: string, items: readonly { id: string; quantity: number }[], state: "reserved" | "committed", products: readonly CatalogProduct[], now: number): MockInventoryHold[] {
  if (!Number.isFinite(now)) throw new Error("Invalid reservation date");
  for (const item of items) {
    const product = products.find((entry) => entry.id === item.id);
    const available = product ? availableMockStock(product, holds, now, orderId) : 0;
    if (!product || (available !== null && item.quantity > available)) throw new MockStockError("Not enough stock for this simulated order");
  }
  const next: MockInventoryHold = { orderId, items: items.map(({ id, quantity }) => ({ id, quantity })), state, ...(state === "reserved" ? { expiresAt: new Date(now + MOCK_RESERVATION_MS).toISOString() } : {}) };
  return [...holds.filter((hold) => hold.orderId !== orderId), next];
}

export function releaseMockStock(holds: readonly MockInventoryHold[], orderId: string): MockInventoryHold[] {
  return holds.map((hold) => hold.orderId === orderId ? { orderId, items: hold.items, state: "released" } : hold);
}

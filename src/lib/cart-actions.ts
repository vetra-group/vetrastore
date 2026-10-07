import { MAX_QUANTITY, type CatalogProduct } from "./catalog";
import type { CartItem } from "./cart";

export type RemovedCartItem = { item: CartItem; index: number };

export function cartQuantityLimit(product?: CatalogProduct) {
  if (!product) return 0;
  const stock = "stock" in product ? product.stock : null;
  return typeof stock === "number"
    ? Number.isFinite(stock) ? Math.max(0, Math.min(MAX_QUANTITY, Math.floor(stock))) : 0
    : MAX_QUANTITY;
}

export function addCartItem(items: readonly CartItem[], id: string, quantity: number, limit: number) {
  if (!Number.isFinite(quantity) || quantity < 1 || !Number.isInteger(limit) || limit < 1) return items;
  const existing = items.find((item) => item.id === id);
  const next = Math.min(limit, (existing?.quantity ?? 0) + Math.floor(quantity));
  if (existing && next <= existing.quantity) return items;
  // Preserve the row's position while its quantity changes.
  return existing
    ? items.map((item) => item.id === id ? { ...item, quantity: next } : item)
    : [...items, { id, quantity: next }];
}

export function restoreCartItem(items: readonly CartItem[], removed: RemovedCartItem, limit: number) {
  const next = addCartItem(items, removed.item.id, removed.item.quantity, limit);
  if (next === items || items.some((item) => item.id === removed.item.id)) return next;
  const restored = next.find((item) => item.id === removed.item.id)!;
  const result = next.filter((item) => item.id !== restored.id);
  result.splice(Math.max(0, Math.min(result.length, removed.index)), 0, restored);
  return result;
}

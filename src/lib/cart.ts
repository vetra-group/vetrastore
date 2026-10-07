import { catalogProducts, type CatalogProduct } from "./catalog";
import { cartQuantityLimit } from "./cart-actions";

export type CartItem = { id: string; quantity: number };
export const STORE_KEY = "vetra-store-v1";
export type StoredCart = { items: CartItem[]; wishlist: string[] };
export function parseStoredCart(value: unknown, products: readonly CatalogProduct[] = catalogProducts): StoredCart {
  if (!value || typeof value !== "object") return { items: [], wishlist: [] };
  const data = value as Record<string, unknown>;
  const quantities = new Map<string, number>();
  if (Array.isArray(data.items)) {
    for (const entry of data.items) {
      const product = products.find((product) => product.id === entry?.id);
      const limit = cartQuantityLimit(product);
      if (
        entry &&
        product &&
        Number.isInteger(entry.quantity) &&
        entry.quantity > 0
      )
        quantities.set(product.id, Math.min(limit, (quantities.get(product.id) ?? 0) + entry.quantity));
    }
  }
  return {
    items: [...quantities].filter(([, quantity]) => quantity > 0).map(([id, quantity]) => ({ id, quantity })),
    wishlist:
      Array.isArray(data.wishlist) ? [...new Set(data.wishlist.filter((id): id is string => typeof id === "string" && products.some((product) => product.id === id)))] : [],
  };
}

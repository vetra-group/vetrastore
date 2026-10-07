"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { catalogProducts, type CatalogProduct } from "@/lib/catalog";
import { addCartItem, cartQuantityLimit, restoreCartItem, type RemovedCartItem } from "@/lib/cart-actions";
import {
  parseStoredCart,
  STORE_KEY,
  type CartItem,
  type StoredCart,
} from "@/lib/cart";

type Store = StoredCart & {
  products: readonly CatalogProduct[];
  subtotal: number;
  hydrated: boolean;
  itemCount: number;
  addItem: (id: string, quantity?: number) => boolean;
  setQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  toggleWishlist: (id: string) => void;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  removedItem: RemovedCartItem | null;
  undoRemoval: () => boolean;
  cartFeedback: { kind: "added" | "updated" | "removed" | "restored" | "unavailable"; id: string } | null;
};
const StoreContext = createContext<Store | null>(null);
const empty: StoredCart = { items: [], wishlist: [] };
let snapshot: unknown = empty;
let initialized = false;
const listeners = new Set<() => void>();
function getSnapshot() {
  if (!initialized) {
    initialized = true;
    try {
      snapshot = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    } catch {
      snapshot = empty;
    }
  }
  return snapshot;
}
function notify() {
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const sync = (event: StorageEvent) => {
    if (event.key !== STORE_KEY && event.key !== null) return;
    try {
      snapshot = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    } catch {
      snapshot = empty;
    }
    notify();
  };
  window.addEventListener("storage", sync);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", sync);
  };
}
const serverSnapshot = () => empty;
const isClient = () => true;
const isServer = () => false;

export function StoreProvider({ children, products = catalogProducts }: { children: ReactNode; products?: readonly CatalogProduct[] }) {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [removedItem, setRemovedItem] = useState<RemovedCartItem | null>(null);
  const removedRef = useRef<RemovedCartItem | null>(null);
  const [cartFeedback, setCartFeedback] = useState<Store["cartFeedback"]>(null);
  const openCart = useCallback(() => {
    // Never stack the bag above an image preview, search, or another modal.
    if (document.querySelector('dialog[open]:not(#mini-cart)')) return;
    setCartFeedback(null);
    setOpenPath(pathname);
  }, [pathname]);
  const closeCart = useCallback(() => setOpenPath(null), []);
  const raw = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
  const store = parseStoredCart(raw, products);
  const hydrated = useSyncExternalStore(subscribe, isClient, isServer);
  const update = useCallback((change: (previous: StoredCart) => StoredCart) => {
    snapshot = change(parseStoredCart(getSnapshot(), products));
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(snapshot));
    } catch {
      /* Cart remains usable when browser storage is unavailable. */
    }
    notify();
  }, [products]);
  const limitFor = useCallback((id: string) => {
    return cartQuantityLimit(products.find((entry) => entry.id === id));
  }, [products]);
  const addItem = useCallback(
    (id: string, quantity = 1) => {
      const limit = limitFor(id);
      let added = false;
      update((previous) => {
        const items = addCartItem(previous.items, id, quantity, limit);
        added = items !== previous.items;
        return added ? { ...previous, items: [...items] } : previous;
      });
      if (added) { openCart(); setCartFeedback({ kind: "added", id }); }
      return added;
    },
    [update, limitFor, openCart],
  );
  const setQuantity = useCallback(
    (id: string, quantity: number) => {
      const limit = limitFor(id);
      if (!Number.isFinite(quantity)) return;
      update((previous) => ({
        ...previous,
        items:
          quantity <= 0 || !limit
            ? previous.items.filter((item) => item.id !== id)
            : previous.items.map((item) => item.id === id ? { id, quantity: Math.min(limit, Math.max(1, Math.floor(quantity))) } : item),
      }));
      setCartFeedback({ kind: "updated", id });
    },
    [update, limitFor],
  );
  const removeItem = useCallback(
    (id: string) => {
      const previous = parseStoredCart(getSnapshot(), products);
      const index = previous.items.findIndex((item) => item.id === id);
      if (index < 0) return;
      removedRef.current = { item: previous.items[index], index };
      setRemovedItem(removedRef.current);
      update((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
      setCartFeedback({ kind: "removed", id });
    },
    [update, products],
  );
  const undoRemoval = useCallback(() => {
    const removed = removedRef.current;
    if (!removed) return false;
    // Consume the undo immediately, including two clicks in one render frame.
    removedRef.current = null;
    let restored = false;
    update((previous) => {
      const items = restoreCartItem(previous.items, removed, limitFor(removed.item.id));
      restored = items !== previous.items;
      return restored ? { ...previous, items: [...items] } : previous;
    });
    setCartFeedback({ kind: restored ? "restored" : "unavailable", id: removed.item.id });
    setRemovedItem(null);
    return restored;
  }, [update, limitFor]);
  const clearCart = useCallback(
    () => { update((previous) => ({ ...previous, items: [] })); removedRef.current = null; setRemovedItem(null); setCartFeedback(null); },
    [update],
  );
  const toggleWishlist = useCallback(
    (id: string) => {
      if (!products.some((entry) => entry.id === id)) return;
      update((previous) => ({
        ...previous,
        wishlist: previous.wishlist.includes(id) ? previous.wishlist.filter((entry) => entry !== id) : [...previous.wishlist, id],
      }));
    },
    [update, products],
  );
  const items: CartItem[] = store.items;
  return (
    <StoreContext.Provider
      value={{
        ...store,
        products,
        subtotal: items.reduce((total, item) => total + (products.find((product) => product.id === item.id)?.price ?? 0) * item.quantity, 0),
        items,
        hydrated,
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
        addItem,
        setQuantity,
        removeItem,
        clearCart,
        toggleWishlist,
        isCartOpen: openPath === pathname,
        openCart,
        closeCart,
        removedItem,
        undoRemoval,
        cartFeedback,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be rendered inside StoreProvider");
  return store;
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { allowedQuantities, catalogProducts, type CatalogProduct, type DisplayCurrency, type Market } from "@/lib/catalog";
import { tryQuoteCart } from "@/lib/cart-pricing";
import { addCartItem, cartQuantityLimit, restoreCartItem, type RemovedCartItem } from "@/lib/cart-actions";
import {
  parseStoredCart,
  defaultDisplayCurrency,
  STORE_KEY,
  type CartItem,
  type StoredCart,
} from "@/lib/cart";

type Store = StoredCart & {
  products: readonly CatalogProduct[];
  subtotal: number;
  pricingAvailable: boolean;
  hydrated: boolean;
  itemCount: number;
  market: Market;
  displayCurrency: DisplayCurrency;
  setDisplayCurrency: (currency: DisplayCurrency) => void;
  setLanguageCurrency: (locale: Locale) => void;
  exchangeRate: { rate: number; date: string; source: "ECB" | "ExchangeRate-API" } | null;
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
const empty: StoredCart = { items: [], wishlist: [], market: "TH", displayCurrency: "USD" };
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

export function StoreProvider({ children, locale, products = catalogProducts }: { children: ReactNode; locale: Locale; products?: readonly CatalogProduct[] }) {
  const market: Market = locale === "th" ? "TH" : "INTL";
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [removedItem, setRemovedItem] = useState<RemovedCartItem | null>(null);
  const removedRef = useRef<RemovedCartItem | null>(null);
  const [cartFeedback, setCartFeedback] = useState<Store["cartFeedback"]>(null);
  const [exchangeRates, setExchangeRates] = useState<{ rates: Record<string, { rate: number; date: string; source: "ECB" | "ExchangeRate-API" }> } | null>(null);
  useEffect(() => {
    if (!cartFeedback) return;
    const timeout = window.setTimeout(() => setCartFeedback(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [cartFeedback]);
  const openCart = useCallback(() => {
    // Never stack the bag above an image preview, search, or another modal.
    if (document.querySelector('dialog[open]:not(#mini-cart)')) return;
    setCartFeedback(null);
    setOpenPath(pathname);
  }, [pathname]);
  const closeCart = useCallback(() => setOpenPath(null), []);
  const raw = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
  const store = parseStoredCart(raw, products, market, locale);
  const hydrated = useSyncExternalStore(subscribe, isClient, isServer);
  const update = useCallback((change: (previous: StoredCart) => StoredCart, currencyLocale: Locale = locale) => {
    snapshot = { ...change(parseStoredCart(getSnapshot(), products, market, locale)), displayCurrencyLocale: currencyLocale };
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(snapshot));
    } catch {
      /* Cart remains usable when browser storage is unavailable. */
    }
    notify();
  }, [products, market, locale]);
  const limitFor = useCallback((id: string) => {
    return cartQuantityLimit(products.find((entry) => entry.id === id));
  }, [products]);
  const addItem = useCallback(
    (id: string, quantity = 1) => {
      const limit = limitFor(id);
      let added = false;
      update((previous) => {
        const product = products.find((entry) => entry.id === id);
        const bundles = product ? allowedQuantities(product, previous.market) : [];
        const items = product?.pricing
          ? bundles.includes(quantity) && quantity <= limit
            ? previous.items.some((item) => item.id === id)
              ? previous.items.map((item) => item.id === id ? { id, quantity } : item)
              : [...previous.items, { id, quantity }]
            : previous.items
          : addCartItem(previous.items, id, quantity, limit);
        added = items !== previous.items;
        return added ? { ...previous, items: [...items] } : previous;
      });
      if (added) { openCart(); setCartFeedback({ kind: "added", id }); }
      return added;
    },
    [update, limitFor, openCart, products],
  );
  const setQuantity = useCallback(
    (id: string, quantity: number) => {
      const limit = limitFor(id);
      if (!Number.isInteger(quantity)) return;
      update((previous) => {
        if (quantity <= 0 || !limit) return { ...previous, items: previous.items.filter((item) => item.id !== id) };
        const product = products.find((entry) => entry.id === id);
        if (!product || quantity > limit || (product.pricing && !allowedQuantities(product, previous.market).includes(quantity))) return previous;
        return { ...previous, items: previous.items.map((item) => item.id === id ? { id, quantity } : item) };
      });
      setCartFeedback({ kind: "updated", id });
    },
    [update, limitFor, products],
  );
  const removeItem = useCallback(
    (id: string) => {
      const previous = parseStoredCart(getSnapshot(), products, market, locale);
      const index = previous.items.findIndex((item) => item.id === id);
      if (index < 0) return;
      removedRef.current = { item: previous.items[index], index };
      setRemovedItem(removedRef.current);
      update((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
      setCartFeedback({ kind: "removed", id });
    },
    [update, products, market, locale],
  );
  const undoRemoval = useCallback(() => {
    const removed = removedRef.current;
    if (!removed) return false;
    // Consume the undo immediately, including two clicks in one render frame.
    removedRef.current = null;
    let restored = false;
    update((previous) => {
      const product = products.find((entry) => entry.id === removed.item.id);
      if (product?.pricing && !allowedQuantities(product, previous.market).includes(removed.item.quantity)) return previous;
      const items = restoreCartItem(previous.items, removed, limitFor(removed.item.id));
      restored = items !== previous.items;
      return restored ? { ...previous, items: [...items] } : previous;
    });
    setCartFeedback({ kind: restored ? "restored" : "unavailable", id: removed.item.id });
    setRemovedItem(null);
    return restored;
  }, [update, limitFor, products]);
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
  const quote = tryQuoteCart(items, products, store.market);
  const setDisplayCurrency = useCallback((displayCurrency: DisplayCurrency) => update((previous) => ({ ...previous, displayCurrency })), [update]);
  const setLanguageCurrency = useCallback((selectedLocale: Locale) => update((previous) => ({ ...previous, displayCurrency: defaultDisplayCurrency(selectedLocale) }), selectedLocale), [update]);
  useEffect(() => {
    if (store.displayCurrency === "THB" || exchangeRates) return;
    const controller = new AbortController();
    void fetch("/api/exchange-rates", { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("Rates unavailable");
      return response.json() as Promise<{ rates: Record<string, { rate: number; date: string; source: "ECB" | "ExchangeRate-API" }> }>;
    }).then((rates) => setExchangeRates(rates)).catch(() => setExchangeRates(null));
    return () => controller.abort();
  }, [store.displayCurrency, exchangeRates]);
  const exchangeRate = store.displayCurrency === "THB" ? null : (exchangeRates?.rates[store.displayCurrency] ?? null);
  return (
    <StoreContext.Provider
      value={{
        ...store,
        products,
        subtotal: quote?.subtotal ?? 0,
        pricingAvailable: quote !== null,
        items,
        hydrated,
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
        market: store.market,
        displayCurrency: store.displayCurrency,
        setDisplayCurrency,
        setLanguageCurrency,
        exchangeRate,
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

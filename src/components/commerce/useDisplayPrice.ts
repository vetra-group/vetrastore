"use client";

import { formatPrice } from "@/lib/catalog";
import type { Locale } from "@/lib/i18n";
import { useStore } from "./StoreProvider";

export function useDisplayPrice(locale: Locale) {
  const { displayCurrency, exchangeRate } = useStore();
  const estimated = displayCurrency !== "THB" && exchangeRate !== null;
  return {
    estimated,
    format(amountTHB: number) {
      if (!estimated) return formatPrice(amountTHB, locale, "THB");
      const decimals = displayCurrency === "KWD" ? 3 : 2;
      const value = new Intl.NumberFormat(locale, {
        style: "currency",
        currency: displayCurrency,
        currencyDisplay: "code",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(amountTHB * exchangeRate.rate);
      return `≈ ${value}`;
    },
  };
}

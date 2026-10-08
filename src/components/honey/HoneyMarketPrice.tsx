"use client";

import type { CatalogProduct } from "@/lib/catalog";
import { publicQuote } from "@/lib/public-pricing";
import { publicPricingCopy } from "@/content/public-pricing";
import type { Locale } from "@/lib/i18n";
import { useStore } from "@/components/commerce/StoreProvider";
import { useDisplayPrice } from "@/components/commerce/useDisplayPrice";

export function HoneyMarketPrice({ product, locale }: { product: CatalogProduct; locale: Locale }) {
  const { market } = useStore();
  const display = useDisplayPrice(locale);
  const quote = publicQuote(product, 1, market);
  return <bdi>{quote ? display.format(quote.total) : publicPricingCopy[locale].unavailable}</bdi>;
}

export function HoneyMarketShipping({ locale }: { locale: Locale }) {
  const { market } = useStore();
  return <>{market === "INTL" ? publicPricingCopy[locale].freeShippingWorldwide : publicPricingCopy[locale].freeShippingThailand}</>;
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Heart, ShoppingBag } from "lucide-react";
import Quantity from "@/components/commerce/Quantity";
import PriceTiers from "@/components/commerce/PriceTiers";
import { useStore } from "@/components/commerce/StoreProvider";
import { commerce } from "@/content/commerce";
import { honeyStory } from "@/content/honey";
import { publicPricingCopy } from "@/content/public-pricing";
import { publicPaymentCopy } from "@/content/payment-checkout";
import { workflowCopy } from "@/content/workflow";
import { currencyForLocale, formatPrice, HONEY_ID, MAX_QUANTITY } from "@/lib/catalog";
import { publicQuote } from "@/lib/public-pricing";
import { usePublished, usePublishedCopy } from "@/components/cms/PublishedProvider";
import { localizedPath, type Locale } from "@/lib/i18n";
import styles from "./HoneyPurchase.module.css";

export default function HoneyPurchase({ locale, preview = false, paymentsEnabled = false }: { locale: Locale; preview?: boolean; paymentsEnabled?: boolean }) {
  const { products } = usePublished();
  const honey = products.find((product) => product.id === HONEY_ID);
  const t = usePublishedCopy(commerce[locale], `commerce.${locale}`);
  const c = usePublishedCopy(honeyStory[locale], `honey.${locale}`);
  const p = publicPricingCopy[locale];
  const { addItem, items, itemCount, wishlist, toggleWishlist } = useStore();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  if (!honey) return null;
  const saved = wishlist.includes(honey.id);
  const bagQuantity = items.find((item) => item.id === honey.id)?.quantity ?? 0;
  const showAdded = added && bagQuantity > 0;
  const remaining = Math.max(0, Math.min(MAX_QUANTITY, honey.stock ?? MAX_QUANTITY) - bagQuantity);
  const tiers = honey.pricing?.[currencyForLocale(locale)];
  const availableTiers = tiers?.filter((tier) => tier.quantity <= remaining) ?? [];
  const selectedQuantity = tiers?.length
    ? (availableTiers.some((tier) => tier.quantity === quantity) ? quantity : availableTiers.at(-1)?.quantity ?? 1)
    : Math.min(quantity, Math.max(1, remaining));
  const selectedQuote = publicQuote(honey, selectedQuantity, locale);

  return (
    <div className={styles.purchase}>
      {!!tiers?.length && (
        <PriceTiers product={honey} locale={locale} value={selectedQuantity} max={remaining} onChange={(value) => { setQuantity(value); setAdded(false); }} />
      )}
      <div className={styles.selectedTotal} aria-live="polite" aria-atomic="true">
        <span>{p.selectedTotal}</span>
        <strong>{selectedQuote ? <bdi>{formatPrice(selectedQuote.total, locale, selectedQuote.currency)}</bdi> : p.unavailable}</strong>
      </div>
      <div className={styles.controls} id="honey-purchase-controls" tabIndex={-1}>
        {!tiers?.length && <Quantity
          locale={locale}
          value={selectedQuantity}
          max={Math.max(1, remaining)}
          onChange={(value) => {
            setQuantity(value);
            setAdded(false);
          }}
        />}
        <button
          className={styles.add}
          type="button"
          disabled={preview || remaining === 0 || !selectedQuote}
          onClick={() => {
            if (preview || remaining === 0 || !selectedQuote) return;
            setAdded(addItem(honey.id, selectedQuantity));
          }}
        >
          {showAdded ? <Check size="1.1875rem" aria-hidden="true" /> : <ShoppingBag size="1.1875rem" aria-hidden="true" />}
          {showAdded ? t.added : t.add}
        </button>
        <button
          className={`${styles.save} ${saved ? styles.saved : ""}`}
          type="button"
          aria-label={saved ? t.saved : t.save}
          aria-pressed={saved}
          disabled={preview}
          onClick={() => toggleWishlist(honey.id)}
        >
          <Heart size="1.3125rem" strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      <div className={styles.feedback} role="status" aria-atomic="true">
        {remaining === 0 ? <span>{honey.stock === 0 ? (locale === "th" ? "สินค้าหมดชั่วคราว" : locale === "ar" ? "نفدت الكمية مؤقتًا" : "Currently out of stock") : t.fullBag}</span> : showAdded ? (
          <span>{t.added} ({locale === "ar" ? `عدد القطع: ${new Intl.NumberFormat(locale).format(itemCount)}` : `${itemCount} ${itemCount === 1 ? t.item : t.items}`})</span>
        ) : null}
        {(remaining === 0 || showAdded) && (
          <Link href={localizedPath(locale, "/cart")}>
            {t.viewBag} <ArrowUpRight size="1.0625rem" aria-hidden="true" />
          </Link>
        )}
      </div>
      <p className={styles.delivery}>{paymentsEnabled && !preview ? publicPaymentCopy[locale].deliveryNote : c.orderNote}</p>
      <Link className={styles.contact} href={localizedPath(locale, "/contact")}>
        {t.contact} <ArrowUpRight size="1.125rem" aria-hidden="true" />
      </Link>
      <Link className={styles.contact} href={localizedPath(locale, `/contact?subject=wholesale&product=${encodeURIComponent(honey.id)}&quantity=${selectedQuantity}`)}>{workflowCopy[locale].wholesaleLink}<ArrowUpRight size="1.125rem" aria-hidden="true" /></Link>
    </div>
  );
}

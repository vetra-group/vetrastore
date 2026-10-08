"use client";

import { formatPrice, priceTiers, type CatalogProduct } from "@/lib/catalog";
import { publicPricingCopy } from "@/content/public-pricing";
import type { Locale } from "@/lib/i18n";
import { useStore } from "./StoreProvider";
import { useDisplayPrice } from "./useDisplayPrice";
import styles from "./PriceTiers.module.css";

export default function PriceTiers({ product, locale, value, max, onChange }: {
  product: CatalogProduct;
  locale: Locale;
  value: number;
  max: number;
  onChange: (quantity: number) => void;
}) {
  const { market } = useStore();
  const display = useDisplayPrice(locale);
  const tiers = priceTiers(product, market);
  if (!tiers?.length) return null;
  const copy = publicPricingCopy[locale];
  return (
    <fieldset className={styles.group}>
      <legend>{copy.select}</legend>
      <div className={styles.options}>
        {tiers.map((tier) => {
          const selected = tier.quantity === value;
          return (
            <label className={`${styles.option} ${selected ? styles.selected : ""}`} key={tier.quantity}>
              <input
                type="radio"
                name={`quantity-${product.id}`}
                value={tier.quantity}
                checked={selected}
                disabled={tier.quantity > max}
                onChange={() => onChange(tier.quantity)}
              />
              <span className={styles.quantity}>{copy.jars(tier.quantity)}</span>
              <strong className={styles.price}>
                <bdi>{display.format(tier.total)}</bdi>
              </strong>
              {display.estimated && <span className={styles.exact}><bdi>{formatPrice(tier.total, locale, "THB")}</bdi> THB</span>}
            </label>
          );
        })}
      </div>
      <p className={styles.currencyNote}>{market === "INTL" ? copy.freeShippingWorldwide : copy.freeShippingThailand}</p>
    </fieldset>
  );
}

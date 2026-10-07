"use client";

import { formatPrice, currencyForLocale, type CatalogProduct } from "@/lib/catalog";
import { publicPricingCopy } from "@/content/public-pricing";
import type { Locale } from "@/lib/i18n";
import styles from "./PriceTiers.module.css";

export default function PriceTiers({ product, locale, value, max, onChange }: {
  product: CatalogProduct;
  locale: Locale;
  value: number;
  max: number;
  onChange: (quantity: number) => void;
}) {
  const currency = currencyForLocale(locale);
  const tiers = product.pricing?.[currency];
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
                {currency === "USD" && <><span className="srOnly">{copy.approximately} </span><span aria-hidden="true">≈ </span></>}
                <bdi>{formatPrice(tier.total, locale, currency)}</bdi>
              </strong>
              {tier.quantity > 1 && (
                <span className={styles.unit}>
                  {(currency === "USD" || Math.round(tier.total * 100) % tier.quantity !== 0) && <>{copy.approximately} </>}
                  <bdi>{formatPrice(tier.total / tier.quantity, locale, currency)}</bdi> {copy.perJar}
                </span>
              )}
            </label>
          );
        })}
      </div>
      {currency === "USD" && <p className={styles.currencyNote}>{copy.usdChargeNote}</p>}
    </fieldset>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Icon from "@/components/Icon";
import { commerce } from "@/content/commerce";
import { mockCheckoutCopy } from "@/content/mock-checkout";
import type { MockShippingQuote } from "@/lib/mock-checkout";
import { formatPrice } from "@/lib/catalog";
import { savedProductDetails } from "@/lib/saved-product";
import { usePublishedCopy } from "@/components/cms/PublishedProvider";
import { localizedPath, type Locale } from "@/lib/i18n";
import { useStore } from "./StoreProvider";
import styles from "./OrderSummary.module.css";
export default function OrderSummary({
  locale,
  checkoutLink = false,
  shippingQuote,
}: {
  locale: Locale;
  checkoutLink?: boolean;
  shippingQuote?: MockShippingQuote;
}) {
  const t = usePublishedCopy(commerce[locale], `commerce.${locale}`);
  const m = mockCheckoutCopy[locale];
  const { products, itemCount, items } = useStore();
  const lines = items.flatMap((item) => {
    const product = products.find((product) => product.id === item.id);
    return product ? [{ ...item, product, details: savedProductDetails(product, locale) }] : [];
  });
  const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const summaryRef = useRef<HTMLElement>(null);
  const [stickyFits, setStickyFits] = useState(false);

  useEffect(() => {
    const summary = summaryRef.current;
    if (!summary) return;
    const checkHeight = () => {
      const style = window.getComputedStyle(summary);
      const offset = Number.parseFloat(style.top);
      const bottomSpace = Number.parseFloat(style.paddingBottom);
      setStickyFits(Number.isFinite(offset) && summary.getBoundingClientRect().height + offset + bottomSpace <= window.innerHeight);
    };
    checkHeight();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(checkHeight);
    observer?.observe(summary);
    window.addEventListener("resize", checkHeight);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", checkHeight);
    };
  }, []);

  return (
    <aside ref={summaryRef} className={styles.summary} aria-label={t.summary} data-sticky-fit={stickyFits}>
      <h2>{t.summary}</h2>
      {!checkoutLink && lines.map(({ id, quantity, product, details }) => (
        <div className={styles.product} key={id}>
          <Link href={details.href} className={styles.productImage}>
            <Image src={product.image} alt={details.alt} lang={details.locale} width={90} height={100} sizes="5rem" />
          </Link>
          <div>
            <Link href={details.href} lang={details.locale}>{details.name}</Link>
            {details.fallback && <small>{t.translatedDetailsNotice}</small>}
            <small>
              {product.weight} {t.gram} × {quantity}
            </small>
          </div>
        </div>
      ))}
      <dl className={styles.totals}>
        <div className={styles.line}>
          <dt>{t.itemCount.replace("{count}", itemCount.toLocaleString(locale)).replace("{unit}", itemCount === 1 ? t.item : t.items)}</dt>
          <dd>{formatPrice(subtotal, locale)}</dd>
        </div>
        <div className={styles.line}>
          <dt>{shippingQuote ? m.shipping : t.delivery}</dt>
          <dd>{shippingQuote?.state === "quoted" ? formatPrice(shippingQuote.fee, locale) : t.toConfirm}</dd>
        </div>
        <div className={styles.total}>
          <dt>{shippingQuote?.state === "quoted" ? m.total : t.estimated}</dt>
          <dd><strong>{formatPrice(shippingQuote?.state === "quoted" ? shippingQuote.total : subtotal, locale)}</strong></dd>
        </div>
      </dl>
      <p aria-live="polite">{shippingQuote?.state === "quoted" ? m.quoteNote : shippingQuote ? m.pending[shippingQuote.reason] : t.exclShipping}</p>
      {checkoutLink && (
        <Link
          href={localizedPath(locale, "/checkout")}
          className={`button buttonLight ${styles.checkout}`}
        >
          {t.checkout}
          <Icon name="chevron" size={19} />
        </Link>
      )}
      <span className={styles.small}>
        <Icon name="box" size={19} />
        {t.deliveryNote}
      </span>
    </aside>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "@/components/loading/NavigationLink";
import Icon from "@/components/Icon";
import { commerce } from "@/content/commerce";
import { mockCheckoutCopy } from "@/content/mock-checkout";
import { publicPaymentCopy } from "@/content/payment-checkout";
import type { MockShippingQuote } from "@/lib/mock-checkout";
import { formatPrice } from "@/lib/catalog";
import { tryQuoteCart } from "@/lib/cart-pricing";
import { savedProductDetails } from "@/lib/saved-product";
import { usePublishedCopy } from "@/components/cms/PublishedProvider";
import { localizedPath, type Locale } from "@/lib/i18n";
import { useStore } from "./StoreProvider";
import styles from "./OrderSummary.module.css";
export default function OrderSummary({
  locale,
  checkoutLink = false,
  shippingQuote,
  paymentsEnabled = false,
}: {
  locale: Locale;
  checkoutLink?: boolean;
  shippingQuote?: MockShippingQuote;
  paymentsEnabled?: boolean;
}) {
  const t = usePublishedCopy(commerce[locale], `commerce.${locale}`);
  const m = mockCheckoutCopy[locale];
  const { products, itemCount, items } = useStore();
  const lines = items.flatMap((item) => {
    const product = products.find((product) => product.id === item.id);
    return product ? [{ ...item, product, details: savedProductDetails(product, locale) }] : [];
  });
  const quote = tryQuoteCart(items, products, locale);
  const currency = quote?.currency;
  const domesticQuote = currency === "THB" ? shippingQuote : undefined;
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
          <dd>{quote && currency ? formatPrice(quote.subtotal, locale, currency) : t.toConfirm}</dd>
        </div>
        <div className={styles.line}>
          <dt>{t.delivery}</dt>
          <dd>{domesticQuote?.state === "quoted" ? formatPrice(domesticQuote.fee, locale, "THB") : locale === "th" ? "ฟรีในประเทศไทย" : t.toConfirm}</dd>
        </div>
        <div className={styles.total}>
          <dt>{t.estimated}</dt>
          <dd><strong>{quote && currency ? formatPrice(domesticQuote?.state === "quoted" ? domesticQuote.total : quote.subtotal, locale, currency) : t.toConfirm}</strong></dd>
        </div>
      </dl>
      <p aria-live="polite">{paymentsEnabled ? publicPaymentCopy[locale].summaryNote : domesticQuote?.state === "quoted" ? t.exclShipping : domesticQuote ? m.pending[domesticQuote.reason] : t.exclShipping}</p>
      {checkoutLink && quote && (
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
        {paymentsEnabled ? publicPaymentCopy[locale].deliveryNote : t.deliveryNote}
      </span>
    </aside>
  );
}

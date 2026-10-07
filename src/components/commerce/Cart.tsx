"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "@/components/loading/NavigationLink";
import Icon from "@/components/Icon";
import { formatPrice } from "@/lib/catalog";
import { tryQuoteCart } from "@/lib/cart-pricing";
import { savedProductDetails } from "@/lib/saved-product";
import { cartQuantityLimit } from "@/lib/cart-actions";
import { miniCartCopy } from "@/content/mini-cart";
import { Undo2 } from "lucide-react";
import { usePublishedCopy } from "@/components/cms/PublishedProvider";
import LoadingScreen from "@/components/loading/LoadingScreen";
import { localizedPath, type Locale } from "@/lib/i18n";
import { commerce } from "@/content/commerce";
import { publicPricingCopy } from "@/content/public-pricing";
import { publicPaymentCopy } from "@/content/payment-checkout";
import { useStore } from "./StoreProvider";
import Quantity from "./Quantity";
import OrderSummary from "./OrderSummary";
import styles from "./Cart.module.css";

export default function Cart({ locale, paymentsEnabled = false }: { locale: Locale; paymentsEnabled?: boolean }) {
  const t = usePublishedCopy(commerce[locale], `commerce.${locale}`);
  const { products, items, itemCount, setQuantity, removeItem, hydrated, removedItem, undoRemoval } = useStore();
  const c = miniCartCopy[locale];
  const [feedback, setFeedback] = useState("");
  const browseRef = useRef<HTMLAnchorElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusEmptyAfterRemoval = useRef(false);

  useEffect(() => {
    if (!hydrated || itemCount || !focusEmptyAfterRemoval.current) return;
    focusEmptyAfterRemoval.current = false;
    (undoRef.current ?? browseRef.current)?.focus();
  }, [hydrated, itemCount]);
  return (
    <section className={`container ${styles.page}`}>
      <div className={styles.heading}>
        <p className="eyebrow">VETRA STORE</p>
        <h1 ref={headingRef} tabIndex={-1}>{t.cartTitle}</h1>
        <p>{t.cartSubtitle}</p>
      </div>
      <p role="status" aria-live="polite" className="srOnly">{feedback}</p>
      {removedItem && <div className={styles.undo}>
        <span>{c.removed}</span>
        <button ref={undoRef} type="button" onClick={() => {
          setFeedback(undoRemoval() ? c.restored : c.unavailable);
          headingRef.current?.focus({ preventScroll: true });
        }}><Undo2 aria-hidden="true" />{c.undo}</button>
      </div>}
      {!hydrated ? (
        <LoadingScreen locale={locale} variant="panel" layout="content" label={t.loading} />
      ) : !itemCount ? (
        <div className={styles.empty}>
          <Icon name="bag" size={43} />
          <h2>{t.emptyTitle}</h2>
          <p>{t.emptyBody}</p>
          <Link ref={browseRef} href={localizedPath(locale, "/products")} className="button">
            {t.browse}
            <Icon name="arrow" size={17} />
          </Link>
        </div>
      ) : (
        <div className={styles.layout}>
          <div className={styles.products}>
            <div className={styles.tableHeading}>
              <span>
                {t.itemCount.replace("{count}", itemCount.toLocaleString(locale)).replace("{unit}", itemCount === 1 ? t.item : t.items)}
              </span>
              <span>{t.subtotal}</span>
            </div>
            {items.map((item) => {
              const product = products.find((product) => product.id === item.id);
              if (!product) return null;
              const details = savedProductDetails(product, locale);
              const lineQuote = tryQuoteCart([item], products, locale);
              const average = lineQuote?.items[0].unitPrice;
              const approximate = average !== undefined && Math.abs(average * 100 - Math.round(average * 100)) > 0.000001;
              return (
              <article className={styles.item} key={item.id}>
                <Link
                  className={styles.image}
                  href={details.href}
                >
                  <Image
                    src={product.image}
                    alt={details.alt}
                    lang={details.locale}
                    width={190}
                    height={210}
                    sizes="(max-width: 30rem) 5.5rem, 10rem"
                  />
                </Link>
                <div className={styles.itemDetails}>
                  <p className={styles.brand}>{product.brand}</p>
                  <h2>
                    <Link
                      href={details.href}
                      lang={details.locale}
                    >
                      {details.name}
                    </Link>
                  </h2>
                  {details.fallback && <p>{t.translatedDetailsNotice}</p>}
                  <p className={styles.weight}>
                    {product.weight} {t.gram}
                  </p>
                  <span className={styles.unitPrice}>
                    {lineQuote && average !== undefined ? <>{approximate ? "≈ " : ""}{formatPrice(average, locale, lineQuote.currency)} {publicPricingCopy[locale].perJar}</> : t.toConfirm}
                  </span>
                  <div className={styles.controls}>
                    <Quantity
                      locale={locale}
                      value={item.quantity}
                      max={cartQuantityLimit(product)}
                      onChange={(value) => {
                        setQuantity(item.id, value);
                        const updated = tryQuoteCart([{ id: item.id, quantity: value }], products, locale);
                        setFeedback(`${t.cartUpdated} ${updated ? formatPrice(updated.subtotal, locale, updated.currency) : t.toConfirm}`);
                      }}
                    />
                    <button
                      className={styles.remove}
                      type="button"
                      aria-label={`${t.remove}: ${details.name}`}
                      onClick={() => {
                        focusEmptyAfterRemoval.current = items.length === 1;
                        removeItem(item.id);
                        setFeedback(t.cartRemoved);
                        requestAnimationFrame(() => undoRef.current?.focus({ preventScroll: true }));
                      }}
                    >
                      <Icon name="trash" size={19} />
                    </button>
                  </div>
                </div>
                <span className={styles.itemTotal}>
                  {lineQuote ? formatPrice(lineQuote.subtotal, locale, lineQuote.currency) : t.toConfirm}
                </span>
              </article>
            ); })}
            <Link
              href={localizedPath(locale, "/products")}
              className={styles.continue}
            >
              <Icon name="arrowLeft" size={17} />
              {t.continue}
            </Link>
            <div className={styles.note}>
              <Icon name="box" size={24} />
              <p>{paymentsEnabled ? publicPaymentCopy[locale].deliveryNote : t.deliveryNote}</p>
            </div>
            <p className={styles.local}>{t.cartLocal}</p>
          </div>
          <OrderSummary locale={locale} checkoutLink paymentsEnabled={paymentsEnabled} />
        </div>
      )}
    </section>
  );
}

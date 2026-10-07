"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, ChevronRight, CircleAlert, ShoppingBag, Trash2, Undo2, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { commerce } from "@/content/commerce";
import { miniCartCopy } from "@/content/mini-cart";
import { usePublishedCopy } from "@/components/cms/PublishedProvider";
import { formatPrice } from "@/lib/catalog";
import { savedProductDetails } from "@/lib/saved-product";
import { cartQuantityLimit } from "@/lib/cart-actions";
import { localizedPath, type Locale } from "@/lib/i18n";
import { useStore } from "./StoreProvider";
import Quantity from "./Quantity";
import styles from "./MiniCart.module.css";

export default function MiniCart({ locale }: { locale: Locale }) {
  const t = usePublishedCopy(commerce[locale], `commerce.${locale}`);
  const c = miniCartCopy[locale];
  const store = useStore();
  useEffect(() => store.closeCart, [store.closeCart]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const feedbackProduct = store.products.find((product) => product.id === store.cartFeedback?.id);
  const feedback = store.cartFeedback
    ? `${c[store.cartFeedback.kind]}${feedbackProduct && ["added", "updated", "restored"].includes(store.cartFeedback.kind) ? `: ${savedProductDetails(feedbackProduct, locale).name}` : ""}`
    : "";

  return (
    <Modal id="mini-cart" label={c.title} className={styles.drawer} open={store.isCartOpen} animate onClose={store.closeCart} onAfterClose={() => {
      store.closeCart();
      // A final Add can disable its own trigger. Keep keyboard focus useful.
      if (document.activeElement === document.body || document.activeElement?.closest("#mini-cart")) document.querySelector<HTMLElement>("[data-cart-trigger]")?.focus({ preventScroll: true });
    }}>
      <div className={styles.frame}>
        <div className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>VETRA STORE</p>
            <h2 ref={headingRef} tabIndex={-1}>{c.title}<span>{store.itemCount}</span></h2>
            <p className={styles.subtitle}>{c.subtitle}</p>
          </div>
          <button className={styles.iconButton} type="button" onClick={store.closeCart} aria-label={c.close}><X aria-hidden="true" /></button>
        </div>
        <div className={styles.content}>
          <p className={feedback && store.cartFeedback?.kind !== "removed" ? styles.feedback : "srOnly"} role="status" aria-live="polite" aria-atomic="true">
            {feedback && <>{store.cartFeedback?.kind === "unavailable" ? <CircleAlert aria-hidden="true" /> : <Check aria-hidden="true" />}<span>{feedback}</span></>}
          </p>
          {store.removedItem && <div className={styles.undo}>
            <span>{c.removed}</span>
            <button ref={undoRef} type="button" onClick={() => { store.undoRemoval(); headingRef.current?.focus({ preventScroll: true }); }}><Undo2 aria-hidden="true" />{c.undo}</button>
          </div>}
          {!store.hydrated ? <p role="status">{t.loading}</p> : store.itemCount ? (
            <ul className={styles.list}>
              {store.items.map((item) => {
                const product = store.products.find((entry) => entry.id === item.id);
                if (!product) return null;
                const details = savedProductDetails(product, locale), href = details.href;
                const limit = cartQuantityLimit(product);
                return <li className={styles.item} key={item.id}>
                  <Link className={styles.image} href={href} onClick={store.closeCart} tabIndex={-1} aria-hidden="true">
                    <Image src={product.image} alt="" width={120} height={144} sizes="(min-width: 1600px) 200px, 6rem" />
                  </Link>
                  <div className={styles.details}>
                    <p className={styles.brand}>{product.brand}</p>
                    <h3><Link href={href} lang={details.locale} onClick={store.closeCart}>{details.name}</Link></h3>
                    {details.fallback && <p>{t.translatedDetailsNotice}</p>}
                    <p className={styles.weight}>{product.weight} {t.gram}</p>
                    <strong className={styles.price}>{formatPrice(product.price * item.quantity, locale)}</strong>
                  </div>
                  <div className={styles.actions}>
                    <Quantity locale={locale} value={item.quantity} max={limit} onChange={(quantity) => store.setQuantity(item.id, quantity)} />
                    <button type="button" className={styles.iconButton} aria-label={`${t.remove}: ${details.name}`} onClick={() => {
                      store.removeItem(item.id);
                      // The removed row no longer exists after React's commit.
                      requestAnimationFrame(() => undoRef.current?.focus({ preventScroll: true }));
                    }}><Trash2 aria-hidden="true" /></button>
                  </div>
                  {item.quantity >= limit && <p className={styles.limit}>{c.limit}</p>}
                </li>;
              })}
            </ul>
          ) : <div className={styles.empty}>
            <ShoppingBag aria-hidden="true" />
            <h3>{t.emptyTitle}</h3>
            <p>{t.emptyBody}</p>
            <Link href={localizedPath(locale, "/products")} className="button buttonOutline" onClick={store.closeCart}>{t.browse}<ChevronRight aria-hidden="true" /></Link>
          </div>}
        </div>
        <div className={styles.footer}>
          {store.itemCount > 0 && <>
            <dl className={styles.total}><div><dt>{t.subtotal}</dt><dd>{formatPrice(store.subtotal, locale)}</dd></div></dl>
            <p className={styles.shipping}>{t.exclShipping}</p>
            <div className={styles.links}>
              <Link className="button" href={localizedPath(locale, "/checkout")} onClick={store.closeCart}>{t.checkout}<ChevronRight aria-hidden="true" /></Link>
              <Link className="button buttonOutline" href={localizedPath(locale, "/cart")} onClick={store.closeCart}>{t.viewBag}</Link>
            </div>
          </>}
          <button type="button" className={styles.continue} onClick={store.closeCart}>{t.continue}</button>
        </div>
      </div>
    </Modal>
  );
}

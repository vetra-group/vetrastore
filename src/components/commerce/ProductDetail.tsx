"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Icon from "@/components/Icon";
import PriceTiers from "./PriceTiers";
import { commerce } from "@/content/commerce";
import { publicPricingCopy } from "@/content/public-pricing";
import { publicPaymentCopy } from "@/content/payment-checkout";
import { galleryArabic } from "@/content/customer-ar";
import { currencyForLocale, formatPrice, MAX_QUANTITY } from "@/lib/catalog";
import { publicQuote } from "@/lib/public-pricing";
import type { CmsProduct } from "@/lib/cms/types";
import { localizedPath, type Locale } from "@/lib/i18n";
import { usePublishedCopy } from "@/components/cms/PublishedProvider";
import { useStore } from "./StoreProvider";
import Quantity from "./Quantity";
import HoneyGallery from "../honey/HoneyGallery";
import styles from "./ProductDetail.module.css";

export default function ProductDetail({ locale, product, preview = false, paymentsEnabled = false }: { locale: Locale; product: CmsProduct; preview?: boolean; paymentsEnabled?: boolean }) {
  const t = usePublishedCopy(commerce[locale], `commerce.${locale}`);
  const { addItem, items, wishlist, toggleWishlist } = useStore();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const p = publicPricingCopy[locale];
  const saved = wishlist.includes(product.id);
  const bagQuantity = items.find((item) => item.id === product.id)?.quantity ?? 0;
  const remaining = Math.max(0, Math.min(MAX_QUANTITY, product.stock ?? MAX_QUANTITY) - bagQuantity);
  const tiers = product.pricing?.[currencyForLocale(locale)];
  const availableTiers = tiers?.filter((tier) => tier.quantity <= remaining) ?? [];
  const selected = tiers?.length
    ? (availableTiers.some((tier) => tier.quantity === quantity) ? quantity : availableTiers.at(-1)?.quantity ?? 1)
    : Math.min(quantity, Math.max(1, remaining));
  const baseQuote = publicQuote(product, 1, locale);
  const selectedQuote = publicQuote(product, selected, locale);
  return (
    <div className={styles.page}>
      <nav className={`container ${styles.breadcrumb}`} aria-label={t.breadcrumb}>
        <Link href={localizedPath(locale)}>{t.home}</Link><span>/</span>
        <Link href={localizedPath(locale, "/products")}>{t.products}</Link><span aria-hidden="true">/</span><span aria-current="page">{product.name[locale]}</span>
      </nav>
      <section className={`container ${styles.product}`}>
        <div className={styles.gallery}>{product.gallery?.length ? <HoneyGallery productSrc={product.image} productAlt={product.card[locale].imageAlt} lifestyleAlt="" images={product.gallery.map((image) => ({ key: image.id, src: image.src, alt: image.alt[locale], label: image.caption?.[locale] || image.alt[locale], kind: "label" }))} labels={locale === "ar" ? galleryArabic : locale === "th" ? { gallery: "ภาพสินค้า", loading: "กำลังโหลดภาพ…", unavailable: "โหลดภาพนี้ไม่สำเร็จ", retry: "ลองอีกครั้ง", zoom: "ขยายภาพ", zoomIn: "ขยาย", zoomOut: "ย่อ", close: "ปิด", previous: "ภาพก่อนหน้า", next: "ภาพถัดไป", product: "สินค้า", front: "ด้านหน้า", back: "ด้านหลัง", lifestyle: "ไอเดียการใช้งาน" } : { gallery: "Product images", loading: "Loading image…", unavailable: "This image could not be loaded.", retry: "Try again", zoom: "View larger", zoomIn: "Zoom in", zoomOut: "Zoom out", close: "Close", previous: "Previous image", next: "Next image", product: "Product", front: "Front", back: "Back", lifestyle: "Inspiration" }} /> : <div className={styles.mainImage}>
          <Image src={product.image} alt={product.card[locale].imageAlt} fill sizes="(max-width: 50rem) 90vw, 50rem" loading="eager" fetchPriority="high" className={styles.packshot} />
        </div>}</div>
        <div className={styles.content}>
          <p className={`eyebrow ${styles.origin}`}>{product.brand}</p>
          <h1>{product.name[locale]}</h1>
          <p className={styles.tagline}>{product.card[locale].captionPrefix}</p>
          <p className={styles.price}>{baseQuote ? <bdi>{formatPrice(baseQuote.total, locale, baseQuote.currency)}</bdi> : p.unavailable}<span>{product.weight} {t.gram}</span></p>
          <p className={styles.description}>{product.description[locale]}</p>
          {!!tiers?.length && <PriceTiers product={product} locale={locale} value={selected} max={remaining} onChange={(value) => { setQuantity(value); setAdded(false); }} />}
          <div className={styles.selectedTotal} aria-live="polite" aria-atomic="true"><span>{p.selectedTotal}</span><strong>{selectedQuote ? <bdi>{formatPrice(selectedQuote.total, locale, selectedQuote.currency)}</bdi> : p.unavailable}</strong></div>
          <div className={`${styles.purchase} ${tiers?.length ? styles.purchaseWithTiers : ""}`}>
            {!tiers?.length && <Quantity locale={locale} value={selected} max={Math.max(1, remaining)} onChange={(value) => { setQuantity(value); setAdded(false); }} />}
            <button type="button" className={`button ${styles.add}`} disabled={preview || remaining === 0 || !selectedQuote} onClick={() => { if (selectedQuote) setAdded(addItem(product.id, selected)); }}>
              <Icon name={added ? "check" : "bag"} size={18} />{added && bagQuantity ? t.added : t.add}
            </button>
            <button disabled={preview} type="button" className={`${styles.save} ${saved ? styles.isSaved : ""}`} onClick={() => toggleWishlist(product.id)} aria-label={saved ? t.saved : t.save} aria-pressed={saved}><Icon name="heart" size={20} /></button>
          </div>
          <div className={styles.feedback} role="status">
            {remaining === 0 && <span>{product.stock === 0 ? ({ ar: "نفد المخزون مؤقتًا", th: "สินค้าหมดชั่วคราว", en: "Currently out of stock" }[locale]) : t.fullBag} </span>}
            {(added || bagQuantity > 0) && <Link href={localizedPath(locale, "/cart")}>{t.viewBag}<Icon name="arrow" size={16} /></Link>}
          </div>
          <p className={styles.deliveryNote}><Icon name="box" size={17} />{paymentsEnabled && !preview ? publicPaymentCopy[locale].deliveryNote : t.deliveryNote}</p>
          <Link href={localizedPath(locale, "/contact")} className="textLink">{t.contact}<Icon name="chevron" size={18} /></Link>
        </div>
      </section>
    </div>
  );
}


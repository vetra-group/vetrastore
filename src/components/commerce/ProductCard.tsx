"use client";
import Image from "next/image";
import Link from "@/components/loading/NavigationLink";
import Icon from "@/components/Icon";
import { siteCopy } from "@/content/site";
import { publicPricingCopy } from "@/content/public-pricing";
import {
  HONEY_ID,
  honey as defaultHoney,
  formatPrice,
  formatProductCaption,
  type CatalogProduct,
} from "@/lib/catalog";
import { publicQuote } from "@/lib/public-pricing";
import { localizedPath, type Locale } from "@/lib/i18n";
import { commerce } from "@/content/commerce";
import { useStore } from "./StoreProvider";
import styles from "./ProductCard.module.css";
import { usePublished, usePublishedCopy } from "@/components/cms/PublishedProvider";
export default function ProductCard({
  locale,
  product,
  presentation = "compact",
}: {
  locale: Locale;
  product: CatalogProduct;
  presentation?: "compact" | "collection";
}) {
  const t = usePublishedCopy(commerce[locale], `commerce.${locale}`);
  const { content } = usePublished();
  const c = usePublishedCopy(siteCopy[locale], `site.${locale}`);
  const { wishlist, toggleWishlist } = useStore();
  const saved = wishlist.includes(product.id);
  const baseQuote = publicQuote(product, 1, locale);
  const priceLabel = baseQuote ? formatPrice(baseQuote.total, locale, baseQuote.currency) : publicPricingCopy[locale].unavailable;
  const collectionCopy = product.id === HONEY_ID ? c.categories.honey : null;
  const href = localizedPath(
    locale,
    product.id === HONEY_ID
      ? "/coffee-blossom-honey"
      : `/products/${product.slug}`,
  );
  return (
    <article className={`${styles.card} ${presentation === "collection" ? styles.collectionCard : ""}`}>
      <div className={styles.visual}>
        <Link href={href} className={styles.imageLink}>
          <Image
            src={product.image}
            alt={product.card[locale].imageAlt}
            width={640}
            height={640}
            sizes={presentation === "collection"
              ? "(max-width: 45rem) 70vw, (max-width: 100rem) 38vw, 42rem"
              : "(max-width: 36rem) 90vw, 34rem"}
          />
        </Link>
        <span className={styles.tag}>{product.brand}</span>
        {(
          <button
            className={`${styles.heart} ${saved ? styles.saved : ""}`}
            type="button"
            onClick={() => toggleWishlist(product.id)}
            aria-label={saved ? t.saved : t.save}
            aria-pressed={saved}
          >
            <Icon name="heart" size={19} />
          </button>
        )}
      </div>
      <div className={styles.info}>
        {presentation === "collection" ? (
          <>
            <div className={styles.collectionText}>
              <h2><Link href={href}>{product.id === HONEY_ID && collectionCopy ? content.copy[`site.${locale}.categories.honey.title`] ?? (product.name[locale] === defaultHoney.name[locale] && product.brand === defaultHoney.brand ? collectionCopy.title : `${product.brand} ${product.name[locale]}`) : `${product.brand} ${product.name[locale]}`}</Link></h2>
              {collectionCopy && <p className={styles.collectionSub}>{collectionCopy.sub}</p>}
              <p className={styles.collectionDescription}>
                {product.id === HONEY_ID && collectionCopy ? content.copy[`site.${locale}.categories.honey.description`] ?? (product.description[locale] === defaultHoney.description[locale] ? collectionCopy.description : product.description[locale]) : product.description[locale]}
              </p>
            </div>
            {collectionCopy && (
              <ul className={styles.collectionDetails}>
                {collectionCopy.details.map((detail, index) => <li key={index}>{detail}</li>)}
              </ul>
            )}
            <p className={styles.collectionPrice}>
              <span>{product.weight} {t.gram}</span>
              <strong><bdi>{priceLabel}</bdi></strong>
            </p>
            <span className={styles.collectionDivider} aria-hidden="true" />
            <Link href={href} className={styles.collectionAction}>
              {collectionCopy?.tag ?? product.card[locale].cta}
              <Icon name="chevron" size={18} />
            </Link>
          </>
        ) : (
          <>
            <p className={styles.caption}>
              {formatProductCaption(product, locale, t.gram)}
            </p>
            <div className={styles.row}>
              <h3>
                <Link href={href}>{product.name[locale]}</Link>
              </h3>
              <span><bdi>{priceLabel}</bdi></span>
            </div>
            <Link href={href} className={styles.link}>
              {product.card[locale].cta}
              <Icon name="arrow" size={17} />
            </Link>
          </>
        )}
      </div>
    </article>
  );
}

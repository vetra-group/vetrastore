"use client";
import Link from "@/components/loading/NavigationLink";
import Icon from "@/components/Icon";
import { commerce } from "@/content/commerce";
import { localeSettings, localizedPath, type Locale } from "@/lib/i18n";
import { savedProductDetails } from "@/lib/saved-product";
import { usePublishedCopy } from "@/components/cms/PublishedProvider";
import LoadingScreen from "@/components/loading/LoadingScreen";
import { useStore } from "./StoreProvider";
import ProductCard from "./ProductCard";
import RequestProgress from "./RequestProgress";
import styles from "./Account.module.css";
export default function Account({ locale }: { locale: Locale }) {
  const t = usePublishedCopy(commerce[locale], `commerce.${locale}`);
  const { products, wishlist, itemCount, hydrated, toggleWishlist } = useStore();
  return (
    <section className={`container ${styles.page}`}>
      <header>
        <p className="eyebrow">{t.savedEyebrow}</p>
        <h1>{t.savedTitle}</h1>
        <p>{t.savedIntro}</p>
      </header>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <span>
            <Icon name="heart" size={19} />
            {t.favourites}
            <b>{wishlist.length}</b>
          </span>
          <Link href={localizedPath(locale, "/cart")}>
            <Icon name="bag" size={19} />
            {t.cartTitle}
            <b>{itemCount}</b>
          </Link>
          <p>{t.savedLocal}</p>
        </aside>
        <div className={styles.main}>
          <h2>{t.favourites}</h2>
          {!hydrated ? (
            <LoadingScreen locale={locale} variant="panel" layout="cards" label={t.loading} />
          ) : wishlist.length ? (
            <div className={styles.products}>
              {products.filter((product) => wishlist.includes(product.id)).map((product) => {
                const details = savedProductDetails(product, locale);
                if (!details.ready) return <article key={product.id}><h3 lang={details.locale}>{details.name}</h3><p>{t.translatedDetailsNotice}</p><Link href={details.href}>{t.browse}</Link><button type="button" onClick={() => toggleWishlist(product.id)}>{t.saved}</button></article>;
                return details.fallback ? <div key={product.id}><p>{t.translatedDetailsNotice}</p><div lang={details.locale} dir={localeSettings(details.locale).direction}><ProductCard locale={details.locale} product={product} /></div></div> : <ProductCard key={product.id} locale={locale} product={product} />;
              })}
            </div>
          ) : (
            <div className={styles.empty}>
              <Icon name="heart" size={37} />
              <h3>{t.emptyFavourites}</h3>
              <p>{t.emptyFavouritesBody}</p>
              <Link
                href={localizedPath(locale, "/products")}
                className="button"
              >
                {t.browse}
                <Icon name="arrow" size={16} />
              </Link>
            </div>
          )}
        </div>
      </div>
      <RequestProgress locale={locale} />
    </section>
  );
}

import Image from "next/image";
import Link from "@/components/loading/NavigationLink";
import { notFound } from "next/navigation";
import { isLocale, locales, localizedPath, localizedDestination } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";
import { pageSchema, serializeSchema } from "@/lib/structured-data";
import { siteCopy } from "@/content/site";
import {
  homeCollections,
  trustItems,
} from "@/content/site-structure";
import { HONEY_ID, honey as defaultHoney } from "@/lib/catalog";
import { getLocalizedPublishedContent } from "@/lib/localized-content";
import { applyCopy } from "@/lib/cms/defaults";
import ProductCard from "@/components/commerce/ProductCard";
import Icon from "@/components/Icon";
import HeroSlider from "@/components/HeroSlider";
import styles from "./page.module.css";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const content = await getLocalizedPublishedContent(locale);
  const c = applyCopy(siteCopy[locale], `site.${locale}`, content.copy);
  // The homepage describes the retailer; featured product brands belong to their pages.
  return pageMetadata(
    locale,
    "",
    c.homeTitle,
    c.homeDescription.replace(/\n/g, " "), content.settings.storeName, locales,
  );
}
export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const content = await getLocalizedPublishedContent(locale);
  const c = applyCopy(siteCopy[locale], `site.${locale}`, content.copy);
  const catalogProducts = content.products.filter((product) => product.status === "published");
  const honey = catalogProducts.find((product) => product.id === HONEY_ID && product.featured);
  const href = (p: string) => localizedPath(locale, p);
  const hasCoffeeProducts = catalogProducts.some(
    (product) => product.category === "coffee",
  );
  return (
    <>
      <section className={styles.hero} aria-labelledby="hero-heading">
        <HeroSlider
          locale={locale}
          slides={content.slides.filter((slide) => slide.enabled).map(({ key, src, path, alt, linkLabel }) => ({
            id: key,
            src,
            alt: alt[locale],
            href: localizedDestination(locale, path),
            linkLabel: linkLabel[locale],
          }))}
          labels={c.heroSlider}
        />
        <div className={`container ${styles.heroInner}`}>
          <p className={styles.heroEyebrow}>{c.heroEyebrow}</p>
          <h1 id="hero-heading">
            {c.heroTitle.map((line, i) => (
              <span key={i} className={i === 1 ? styles.heroAccent : ""}>
                {line}
              </span>
            ))}
          </h1>
          <p className={styles.heroBody}>{c.heroBody}</p>
          <div className={styles.heroLinks}>
            <Link href={href("/products")} className="button buttonLight">
              {c.shopNow}
              <Icon name="chevron" size={20} />
            </Link>
            <Link className={styles.heroStory} href={href("/about")}>
              {c.heroSecondary}
              <Icon name="arrowUpRight" size={18} />
            </Link>
          </div>
        </div>
      </section>
      <section className={styles.trust}>
        <div className={`container ${styles.trustGrid}`}>
          {trustItems.map(({ key, icon }) => (
            <div key={key} className={styles.trustItem}>
              <Icon name={icon} size={25} />
              <div>
                <h2>{c.trust[key].title}</h2>
                <p>{c.trust[key].body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className={`container ${styles.collections}`}>
        <div className={`${styles.sectionHeader} ${styles.collectionHeader}`}>
          <div>
            <p className="eyebrow">{c.collectionEyebrow}</p>
            <h2>{c.collectionTitle}</h2>
          </div>
        </div>
        <div className={styles.collectionGrid}>
          {homeCollections.filter((item) => item.key !== "honey" || honey).filter((item) => item.key !== "coffee" || !hasCoffeeProducts).map((item) => (
            <Link
              href={href(item.path)}
              key={item.key}
              className={styles.collectionCard}
            >
              <div
                className={`${styles.collectionImage} ${item.imageStyle === "honey" ? styles.honeyCollection : ""}`}
              >
                <div className={styles.collectionPicture}>
                  <Image
                    src={item.key === "honey" && honey ? honey.image : item.image}
                    alt=""
                    fill
                    sizes={item.imageStyle === "honey"
                      ? "(max-width: 720px) 70vw, (max-width: 1100px) 36vw, (max-width: 1600px) 27vw, 600px"
                      : "(max-width: 720px) 80vw, (max-width: 1600px) 38vw, 900px"}
                  />
                </div>
                {"comingSoon" in item &&
                  (item.comingSoon === "always" || !hasCoffeeProducts) && (
                  <span className={styles.coming}>{c.categories[item.key].comingSoonLabel}</span>
                )}
              </div>
              <div className={styles.collectionCaption}>
                <div className={styles.collectionText}>
                  <h3>{item.key === "honey" && honey && (honey.name[locale] !== defaultHoney.name[locale] || honey.brand !== defaultHoney.brand) ? content.copy[`site.${locale}.categories.honey.title`] ?? `${honey.brand} ${honey.name[locale]}` : c.categories[item.key].title}</h3>
                  <p className={styles.collectionSub}>{c.categories[item.key].sub}</p>
                  <p className={styles.collectionDescription}>
                    {item.key === "honey" && honey && honey.description[locale] !== defaultHoney.description[locale] ? content.copy[`site.${locale}.categories.honey.description`] ?? honey.description[locale] : c.categories[item.key].description}
                  </p>
                </div>
                <ul className={styles.collectionDetails}>
                  {c.categories[item.key].details.map((detail, index) => (
                    <li key={index}>{detail}</li>
                  ))}
                </ul>
                <span className={styles.collectionDivider} aria-hidden="true" />
                <span className={styles.collectionAction}>
                  {c.categories[item.key].tag}
                  <Icon name="chevron" size={18} />
                </span>
              </div>
            </Link>
          ))}
          {catalogProducts.filter((product) => product.id !== HONEY_ID && product.featured).map((product) => <ProductCard key={product.id} locale={locale} product={product} presentation="collection" />)}
        </div>
      </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeSchema(pageSchema(locale, "", c.homeTitle)),
        }}
      />
    </>
  );
}

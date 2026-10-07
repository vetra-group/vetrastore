"use client";
import { useState } from "react";
import Image from "next/image";
import Icon from "@/components/Icon";
import { commerce } from "@/content/commerce";
import { siteCopy } from "@/content/site";
import { homeCollections } from "@/content/site-structure";
import { usePublished, usePublishedCopy } from "@/components/cms/PublishedProvider";
import { locales, type Locale } from "@/lib/i18n";
import { normalizeSearch } from "@/lib/search-normalize";
import ProductCard from "./ProductCard";
import styles from "./Catalog.module.css";

export default function Catalog({
  locale,
  initialSearch = "",
  initialCategory = "all",
}: {
  locale: Locale;
  initialSearch?: string;
  initialCategory?: string;
}) {
  const { products: catalogProducts, content } = usePublished();
  const t = usePublishedCopy(commerce[locale], `commerce.${locale}`);
  const c = usePublishedCopy(siteCopy[locale], `site.${locale}`);
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState(
    ["all", "honey", "coffee"].includes(initialCategory)
      ? initialCategory
      : "all",
  );
  const hasCoffeeProducts = catalogProducts.some(
    (product) => product.category === "coffee",
  );
  const query = normalizeSearch(search);
  const visibleProducts = catalogProducts.filter((product) => {
    const matchesCategory = category === "all" || product.category === category;
    const searchable = normalizeSearch([
      ...Object.values(product.name),
      product.brand,
      ...product.searchTerms,
    ]
      .join(" "));
    return matchesCategory && searchable.includes(query);
  });
  const visiblePreviews = homeCollections.filter((item) => {
    if (!("comingSoon" in item) || category === "honey") return false;
    if (item.comingSoon !== "always" && hasCoffeeProducts) return false;
    if (!query) return true;
    const current = c.categories[item.key];
    const alternateTerms = locales.flatMap((language) => {
      const entry = siteCopy[language].categories[item.key];
      return ["title", "sub"].map((field) => content.copy[`site.${language}.categories.${item.key}.${field}`] ?? entry[field as "title" | "sub"]);
    });
    return normalizeSearch([current.title, current.sub, current.description, ...current.details, ...alternateTerms]
      .join(" "))
      .includes(query);
  });
  const reset = () => {
    setSearch("");
    setCategory("all");
  };
  return (
    <>
      <section className={`container ${styles.collection}`}>
        <header className={styles.sectionHeader}>
          <p className="eyebrow">{c.collectionEyebrow}</p>
          <h1>{c.collectionTitle}</h1>
        </header>
        <div className={styles.controls}>
          <div
            className={styles.categories}
            role="group"
            aria-label={t.products}
          >
            {(["all", "honey", "coffee"] as const).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={category === key}
                className={category === key ? styles.active : ""}
                onClick={() => setCategory(key)}
              >
                {t[key]}
                {key === "coffee" && !hasCoffeeProducts && (
                  <span>{t.comingSoon}</span>
                )}
              </button>
            ))}
          </div>
          <div className={styles.search}>
            <Icon name="search" size={17} />
            <input
              aria-label={t.search}
              placeholder={t.searchPlaceholder}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              type="search"
            />
          </div>
        </div>
        <div className={styles.resultRow}>
          <span aria-live="polite">
            {t.availableCount.replace("{count}", visibleProducts.length.toLocaleString(locale)).replace("{unit}", visibleProducts.length === 1 ? t.result : t.results).replace("{available}", t.available)}
          </span>
          {(search || category !== "all") && (
            <button onClick={reset}>
              {t.clear}
              <Icon name="close" size={12} />
            </button>
          )}
        </div>
        {visibleProducts.length > 0 || visiblePreviews.length > 0 ? (
          <div className={styles.grid}>
            {visibleProducts.map((product) => (
              <ProductCard key={product.id} locale={locale} product={product} presentation="collection" />
            ))}
            {visiblePreviews.map((item) => {
              const copy = c.categories[item.key];
              return (
                <article className={styles.future} key={item.key}>
                  <div className={styles.futureImage}>
                    <div className={styles.futurePicture}>
                      <Image
                        src={item.image}
                        alt=""
                        fill
                        sizes="(max-width: 45rem) 85vw, (max-width: 100rem) 43vw, 50rem"
                      />
                    </div>
                    <span className={styles.coming}>{copy.comingSoonLabel ?? t.comingSoon}</span>
                  </div>
                  <div className={styles.futureContent}>
                    <div className={styles.futureText}>
                      <h2>{copy.title}</h2>
                      <p className={styles.futureSub}>{copy.sub}</p>
                      <p className={styles.futureDescription}>{copy.description}</p>
                    </div>
                    <ul className={styles.futureDetails}>
                      {copy.details.map((detail, index) => <li key={index}>{detail}</li>)}
                    </ul>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.empty}>
            <Icon name={category === "coffee" ? "sun" : "search"} size={34} />
            <h2>
              {category === "coffee" && !search ? t.noResults : t.noSearch}
            </h2>
            <p>
              {category === "coffee" && !search
                ? t.noResultsBody
                : t.noSearchBody}
            </p>
            <button className="button buttonOutline" onClick={reset}>
              {t.browse}
              <Icon name="arrow" size={16} />
            </button>
          </div>
        )}
      </section>
    </>
  );
}

import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import Icon from "@/components/Icon";
import BlogLibrary from "./BlogLibrary";
import { journalCopy } from "@/content/pages";
import { articleCard, blogListing, blogListingPath } from "@/lib/blog";
import { pageNeedsRedirect, type ListingSearchParams } from "@/lib/listing";
import { getLocalizedPublishedContent } from "@/lib/localized-content";
import { applyCopy } from "@/lib/cms/defaults";
import { localizedPath, type Locale } from "@/lib/i18n";
import { siteUrl } from "@/lib/metadata";
import { organizationSchema } from "@/lib/structured-data";
import styles from "./BlogContent.module.css";

export default async function BlogContent({ locale, searchParams = {} }: { locale: Locale; searchParams?: ListingSearchParams }) {
  const content = await getLocalizedPublishedContent(locale);
  const c = applyCopy(journalCopy[locale], `pages.journal.${locale}`, content.copy);
  const articles = content.articles.filter((article) => article.status === "published");
  const listing = blogListing(articles, locale, searchParams);
  if (pageNeedsRedirect(searchParams.page, listing.page)) redirect(`${localizedPath(locale, blogListingPath(listing.q, listing.category, listing.page))}#articles`);
  const cards = listing.items.map((article) => articleCard(article, locale, c.minutes));
  const featuredArticle = articles.find((article) => article.featured) ?? articles.find((article) => article.slug === "how-vetra-selects-products") ?? articles[0];
  const featured = !listing.q && !listing.category && listing.page === 1 && featuredArticle ? articleCard(featuredArticle, locale, c.minutes) : undefined;
  const visibleCards = [...new Map([...(featured ? [featured] : []), ...cards].map((article) => [article.slug, article])).values()];
  const schema = {
    "@context": "https://schema.org", "@type": "Blog",
    name: c.title, description: c.description, inLanguage: locale,
    url: new URL(localizedPath(locale, blogListingPath(listing.q, listing.category, listing.page)), siteUrl).href,
    publisher: organizationSchema(content.settings, locale),
    blogPost: visibleCards.map((article) => ({ "@type": "BlogPosting", headline: article.title, url: new URL(localizedPath(locale, `/blog/${article.slug}`), siteUrl).href })),
  };
  return (
    <div className={styles.page}>
      <header className={`container ${styles.header}`}>
        <p className="eyebrow">{c.eyebrow}</p>
        <h1>{c.heading}</h1>
        <p className={styles.subtitle}>{c.subtitle}</p>
        <a href="#articles" className={styles.explore}>{c.latest}<Icon name="chevron" size={18} /></a>
      </header>
      {featured && (
        <section className={`container ${styles.featureSection}`} aria-labelledby="featured-title">
          <div className={styles.feature}>
            <Link href={localizedPath(locale, `/blog/${featured.slug}`)} className={styles.featureImage} aria-label={featured.title}>
              <Image src={featured.image} alt="" fill loading="eager" fetchPriority="high" sizes="(max-width: 55rem) 94vw, 58vw" style={{ objectPosition: featured.imagePosition, objectFit: featured.imageFit }} />
              <span className={styles.imageLabel}>{c.featured}</span>
            </Link>
            <div className={styles.featureCopy}>
              <p className={styles.featureCategory}>{featured.category}<span aria-hidden="true">/</span>{featured.readingTime}</p>
              <h2 id="featured-title"><Link href={localizedPath(locale, `/blog/${featured.slug}`)}>{featured.title}</Link></h2>
              <p>{featured.excerpt}</p>
              <Link href={localizedPath(locale, `/blog/${featured.slug}`)} className={styles.featureLink}>{c.read}<Icon name="chevron" size={21} /></Link>
            </div>
          </div>
        </section>
      )}
      <section id="articles" tabIndex={-1} className={`container ${styles.articles}`} aria-labelledby="articles-heading">
        <div className={styles.sectionHeader}>
          <div><p className="eyebrow">{c.count}</p><h2 id="articles-heading">{c.latest}</h2></div>
          <p>{c.libraryIntro}</p>
        </div>
        <BlogLibrary locale={locale} articles={cards} listing={listing} copy={{ all: c.all, categories: c.categories, search: c.search, searchPlaceholder: c.searchPlaceholder, clear: c.clear, results: c.results, noResults: c.noResults, noResultsBody: c.noResultsBody, reset: c.reset, read: c.read }} />
      </section>
      <section className={`container ${styles.approach}`} aria-labelledby="approach-heading">
        <div className={styles.approachIntro}>
          <p className="eyebrow">{c.approachEyebrow}</p>
          <h2 id="approach-heading">{c.approachTitle}</h2>
          <p>{c.approachBody}</p>
          <Link href={localizedPath(locale, "/about")} className="textLink">{c.approachLink}<Icon name="chevron" size={18} /></Link>
        </div>
        <div className={styles.principles}>{c.principles.map((principle, index) => (
          <div className={styles.principle} key={index}>
            <Icon name={(["productSearch", "leaf", "shield"] as const)[index]} size={27} />
            <div><h3>{principle.title}</h3><p>{principle.text}</p></div>
          </div>
        ))}</div>
      </section>
      <section className={`container ${styles.faqSection}`} aria-labelledby="blog-faq-heading">
        <div className={styles.faqIntro}>
          <p className="eyebrow">{c.faqEyebrow}</p>
          <h2 id="blog-faq-heading">{c.faqTitle}</h2>
          <Link href={localizedPath(locale, "/contact")} className="textLink">{c.contact}<Icon name="chevron" size={18} /></Link>
        </div>
        <div>{c.questions.map(({ question, answer }, index) => (
          <details key={index} className={styles.faq}>
            <summary>{question}<Icon name="plus" size={20} /></summary>
            <p>{answer}</p>
          </details>
        ))}</div>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
    </div>
  );
}

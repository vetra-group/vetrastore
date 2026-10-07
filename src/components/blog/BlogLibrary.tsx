import Form from "next/form";
import Link from "@/components/loading/NavigationLink";
import ArticleCard from "./ArticleCard";
import Icon from "@/components/Icon";
import Pagination from "@/components/listing/Pagination";
import { blogListingPath, type BlogCardData, type blogListing } from "@/lib/blog";
import { localizedPath, type Locale } from "@/lib/i18n";
import styles from "./BlogLibrary.module.css";

type LibraryCopy = { all: string; categories: string; search: string; searchPlaceholder: string; clear: string; results: string; noResults: string; noResultsBody: string; reset: string; read: string };

export default function BlogLibrary({ articles, listing, locale, copy }: { articles: BlogCardData[]; listing: ReturnType<typeof blogListing>; locale: Locale; copy: LibraryCopy }) {
  const href = (q: string, category: string, page = 1) => `${localizedPath(locale, blogListingPath(q, category, page))}#articles`;
  const count = locale === "en" && listing.total === 1 ? "1 article" : copy.results.replace("{count}", new Intl.NumberFormat(locale).format(listing.total));
  return <div className={styles.library}>
    <div className={styles.tools}>
      <nav className={styles.categories} aria-label={copy.categories}>
        <Link href={href(listing.q, "")} aria-current={!listing.category ? "true" : undefined}>{copy.all}</Link>
        {listing.categories.map((category) => <Link key={category.key} href={href(listing.q, category.key)} aria-current={listing.category === category.key ? "true" : undefined}>{category.label}<span className="srOnly"> ({category.count})</span></Link>)}
      </nav>
      <Form className={styles.search} key={`${listing.q}:${listing.category}`} action={`${localizedPath(locale, "/blog")}#articles`} role="search">
        <label htmlFor="blog-search">{copy.search}</label>
        {listing.category && <input type="hidden" name="category" value={listing.category} />}
        <div className={styles.searchField}>
          <input id="blog-search" name="q" type="search" defaultValue={listing.q} maxLength={200} placeholder={copy.searchPlaceholder} />
          <button type="submit" aria-label={copy.search}><Icon name="search" /></button>
        </div>
        {listing.q && <Link className={styles.clear} href={href("", listing.category)}>{copy.clear}<Icon name="close" /></Link>}
      </Form>
    </div>
    <p className={styles.results}>{count}{listing.category && !listing.categories.some((category) => category.key === listing.category) && <span> · {locale === "th" ? "ไม่พบหมวดหมู่นี้" : locale === "ar" ? "هذا التصنيف غير متاح" : "This category is unavailable"}</span>}</p>
    {articles.length ? <><div className={styles.grid}>{articles.map((article) => <ArticleCard key={article.slug} article={article} locale={locale} read={copy.read} />)}</div><Pagination locale={locale} pagination={listing} href={(page) => href(listing.q, listing.category, page)} /></> : <div className={styles.empty}>
      <Icon name="search" size={28} />
      <h3>{copy.noResults}</h3><p>{copy.noResultsBody}</p>
      <Link className="button buttonOutline" href={href("", "")}>{copy.reset}</Link>
    </div>}
  </div>;
}

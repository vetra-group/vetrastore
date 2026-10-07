import Image from "next/image";
import Link from "next/link";
import Form from "next/form";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Search, ChevronRight, Package, BookOpen } from "lucide-react";
import { getLocalizedPublishedContent } from "@/lib/localized-content";
import { isLocale, localizedPath, type Locale } from "@/lib/i18n";
import { searchGuidance, searchListing, searchListingPath, type SearchResult } from "@/lib/search";
import { pageNeedsRedirect, type ListingSearchParams } from "@/lib/listing";
import { pageMetadata } from "@/lib/metadata";
import { discovery } from "@/content/discovery";
import Pagination from "@/components/listing/Pagination";
import styles from "./page.module.css";

type SearchPageProps = { params: Promise<{ locale: string }>; searchParams: Promise<ListingSearchParams> };

export async function generateMetadata({ params, searchParams }: SearchPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const content = await getLocalizedPublishedContent(locale), listing = searchListing(content, locale, await searchParams);
  const c = discovery[locale];
  const title = `${c.title}${listing.page > 1 ? ` · ${c.page} ${listing.page}` : ""}`;
  const description = c.description;
  const metadata = pageMetadata(locale, searchListingPath(listing.q, listing.kind, listing.page), title, description, content.settings.storeName);
  return { ...metadata, robots: metadata.robots ?? { index: false, follow: true } };
}

function ResultCards({ results, locale, nested = false }: { results: SearchResult[]; locale: Locale; nested?: boolean }) {
  const c = discovery[locale];
  const Heading = nested ? "h3" : "h2";
  return <div className={styles.results}>{results.map((result) => <Link href={result.href} key={result.key} className={styles.result}><div className={styles.image}><Image src={result.image} alt="" fill sizes="(max-width: 40rem) 90vw, 14rem" /></div><div><span className={styles.kind}>{result.kind === "product" ? <Package aria-hidden="true" /> : <BookOpen aria-hidden="true" />}{result.kind === "product" ? (c.product) : (c.article)}</span><Heading>{result.title}</Heading><p>{result.description}</p><span className={styles.action}>{c.explore}<ChevronRight aria-hidden="true" /></span></div></Link>)}</div>;
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const input = await searchParams, c = discovery[locale];
  const content = await getLocalizedPublishedContent(locale);
  const listing = searchListing(content, locale, input), { q, kind: type, items: results, total } = listing;
  if (pageNeedsRedirect(input.page, listing.page)) redirect(`${localizedPath(locale, searchListingPath(q, type, listing.page))}#search-results`);
  const guidance = total ? null : searchGuidance(content, locale, q, type);
  const searchHref = (query: string, kind = type, page = 1) => `${localizedPath(locale, searchListingPath(query, kind, page))}#search-results`;
  return <div className={`container ${styles.page}`}>
    <header className={styles.heading}><p className="eyebrow">VETRA STORE</p><h1>{c.heading}</h1><p>{c.intro}</p></header>
    <Form className={styles.search} key={`${q}:${type}`} action={`${localizedPath(locale, "/search")}#search-results`} role="search">
      <label className={styles.query}>{c.terms}<input name="q" type="search" defaultValue={q} maxLength={200} placeholder={c.placeholder} /></label>
      <label>{c.show}<select name="type" defaultValue={type}><option value="all">{c.everything}</option><option value="product">{c.products}</option><option value="article">{c.articles}</option></select></label>
      <button className="button" type="submit"><Search aria-hidden="true" />{c.search}</button>
    </Form>
    <p id="search-results" tabIndex={-1} className={styles.count}>{q ? (locale === "th" ? `ผลการค้นหา “${q}” · ${total} รายการ` : locale === "ar" ? `نتائج البحث عن «${q}»: ${new Intl.NumberFormat(locale).format(total)}` : `${total} ${total === 1 ? "result" : "results"} for “${q}”`) : (c.start)}</p>
    {!!results.length && <><ResultCards results={results} locale={locale} /><Pagination locale={locale} pagination={listing} href={(page) => searchHref(q, type, page)} /></>}
    {guidance && <section className={styles.guidance} aria-labelledby="search-help-heading">
      <div className={styles.empty}><h2 id="search-help-heading">{q ? (c.noMatches) : (c.startingPoints)}</h2>
        <p>{q ? (c.retry) : (c.available)}</p>
        {guidance.otherTypeCount > 0 && <p className={styles.broaden}>{c.otherTypes}<Link href={searchHref(q, "all")}>{`${c.allTypes} (${new Intl.NumberFormat(locale).format(guidance.otherTypeCount)})`}<ChevronRight aria-hidden="true" /></Link></p>}
        {!!guidance.suggestions.length && <nav className={styles.suggestions} aria-label={c.suggestions}>{guidance.suggestions.map((suggestion) => <Link key={suggestion} href={searchHref(suggestion)}><Search aria-hidden="true" /><span>{suggestion}</span></Link>)}</nav>}
      </div>
      {!!guidance.nearby.length && <section className={styles.nearby} aria-labelledby="nearby-search-heading"><div className={styles.nearbyHeading}><h2 id="nearby-search-heading">{c.nearby}</h2><p>{c.nearbyNote}</p></div><ResultCards results={guidance.nearby} locale={locale} nested /></section>}
      <div className={styles.browse}><Link className="button" href={localizedPath(locale, "/products")}>{c.ourProducts}</Link><Link className="button buttonOutline" href={localizedPath(locale, "/blog")}>{c.readBlog}</Link><Link className="textLink" href={localizedPath(locale, "/contact")}>{c.help}<ChevronRight aria-hidden="true" /></Link></div>
    </section>}
  </div>;
}

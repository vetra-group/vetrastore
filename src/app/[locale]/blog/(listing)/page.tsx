import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BlogContent from "@/components/blog/BlogContent";
import { journalCopy } from "@/content/pages";
import { applyCopy } from "@/lib/cms/defaults";
import { getPublishedContent } from "@/lib/cms/server";
import { articleLocaleReady } from "@/lib/cms/localization";
import { isLocale, locales } from "@/lib/i18n";
import { pageMetadata, withSocialImage } from "@/lib/metadata";
import { blogListing, blogListingPath } from "@/lib/blog";
import type { ListingSearchParams } from "@/lib/listing";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<ListingSearchParams>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const content = await getPublishedContent();
  const copy = applyCopy(journalCopy[locale], `pages.journal.${locale}`, content.copy);
  const publishedArticles = content.articles.filter((article) => article.status === "published");
  const localizedArticles = publishedArticles.filter((article) => articleLocaleReady(article, locale));
  const featured = localizedArticles.find((article) => article.featured) ?? localizedArticles.find((article) => article.slug === "how-vetra-selects-products") ?? localizedArticles[0];
  const listing = blogListing(publishedArticles, locale, await searchParams);
  const title = listing.page > 1 ? `${copy.title} · ${locale === "th" ? "หน้า" : locale === "ar" ? "الصفحة" : "Page"} ${listing.page}` : copy.title;
  const availableLocales = locales.filter((language) => blogListing(publishedArticles, language, { q: listing.q, category: listing.category }).pageCount >= listing.page);
  const metadata = pageMetadata(locale, blogListingPath(listing.q, listing.category, listing.page), title, copy.description, content.settings.storeName, availableLocales);
  const socialMetadata = featured ? withSocialImage(metadata, featured.image, featured.content[locale].imageAlt || featured.content[locale].title) : metadata;
  return {
    ...socialMetadata,
    ...((listing.q || listing.category) && !metadata.robots ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function BlogPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<ListingSearchParams> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <BlogContent locale={locale} searchParams={await searchParams} />;
}

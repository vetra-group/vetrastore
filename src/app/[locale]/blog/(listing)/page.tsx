import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BlogContent from "@/components/blog/BlogContent";
import { journalCopy } from "@/content/pages";
import { applyCopy } from "@/lib/cms/defaults";
import { getLocalizedPublishedContent } from "@/lib/localized-content";
import { isLocale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";
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
  const content = await getLocalizedPublishedContent(locale);
  const copy = applyCopy(journalCopy[locale], `pages.journal.${locale}`, content.copy);
  const publishedArticles = content.articles.filter((article) => article.status === "published");
  const featured = publishedArticles.find((article) => article.featured) ?? publishedArticles.find((article) => article.slug === "how-vetra-selects-products") ?? publishedArticles[0];
  const listing = blogListing(publishedArticles, locale, await searchParams);
  const title = listing.page > 1 ? `${copy.title} · ${locale === "th" ? "หน้า" : locale === "ar" ? "الصفحة" : "Page"} ${listing.page}` : copy.title;
  const metadata = pageMetadata(locale, blogListingPath(listing.q, listing.category, listing.page), title, copy.description, content.settings.storeName);
  return {
    ...metadata,
    ...((listing.q || listing.category) && !metadata.robots ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      ...metadata.openGraph,
      ...(featured ? { images: [{ url: featured.image, alt: featured.content[locale].title }] } : {}),
    },
  };
}

export default async function BlogPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<ListingSearchParams> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <BlogContent locale={locale} searchParams={await searchParams} />;
}

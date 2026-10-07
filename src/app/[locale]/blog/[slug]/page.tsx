import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import BlogArticle from "@/components/blog/BlogArticle";
import { getLocalizedPublishedContent } from "@/lib/localized-content";
import { isLocale, locales, localizedPath } from "@/lib/i18n";
import { articleLocaleReady } from "@/lib/cms/localization";
import { articleForRoute } from "@/lib/cms/publishing";
import { pageMetadata, withSocialImage } from "@/lib/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const content = await getLocalizedPublishedContent(locale);
  const article = articleForRoute(content, slug)?.article;
  if (!article) return {};
  const copy = article.content[locale];
  const metadata = pageMetadata(locale, `/blog/${article.slug}`, copy.seoTitle || copy.title, copy.seoDescription || copy.excerpt, content.settings.storeName, locales.filter((language) => articleLocaleReady(article, language)), [article.image, copy.title, copy.category].join("|"));
  const socialMetadata = copy.socialImage ? withSocialImage(metadata, copy.socialImage, copy.imageAlt || copy.title) : metadata;
  return {
    ...socialMetadata,
    openGraph: {
      ...socialMetadata.openGraph,
      type: "article",
      ...(article.publishedAt ? { publishedTime: article.publishedAt } : {}),
      ...(article.updatedAt ? { modifiedTime: article.updatedAt } : {}),
    },
  };
}

export default async function BlogArticlePage({
  params, searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const content = await getLocalizedPublishedContent(locale);
  const match = articleForRoute(content, slug);
  if (!match) notFound();
  const { article } = match;
  if (match.redirect) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(await searchParams)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
    permanentRedirect(localizedPath(locale, `/blog/${article.slug}`) + (query.size ? `?${query}` : ""));
  }
  return <BlogArticle locale={locale} article={article} />;
}

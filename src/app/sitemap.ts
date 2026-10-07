import type { MetadataRoute } from "next";
import { articleLocaleReady, productLocaleReady } from "@/lib/cms/localization";
import { locales, localizedPath } from "@/lib/i18n";
import { siteUrl } from "@/lib/metadata";
import { getPublishedContent } from "@/lib/cms/server";
import { HONEY_ID } from "@/lib/catalog";
export const dynamic = "force-dynamic";
const routes = [
  "",
  "/products",
  "/about",
  "/blog",
  "/contact",
  "/help",
];
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const content = await getPublishedContent();
  const publishedRoutes = [...routes, ...content.products.filter((product) => product.status === "published").map((product) => product.id === HONEY_ID ? "/coffee-blossom-honey" : `/products/${product.slug}`), ...content.articles.filter((article) => article.status === "published").map((article) => `/blog/${article.slug}`)];
  return publishedRoutes.flatMap((path) => {
    const article = content.articles.find((item) => `/blog/${item.slug}` === path);
    const product = content.products.find((item) => (item.id === HONEY_ID ? "/coffee-blossom-honey" : `/products/${item.slug}`) === path);
    const available = locales.filter((locale) => (!article || articleLocaleReady(article, locale)) && (!product || productLocaleReady(product, locale)));
    return available.map((locale) => ({
      url: `${siteUrl}${localizedPath(locale, path)}`,
      ...(path.startsWith("/blog/") && (content.articles.find((article) => `/blog/${article.slug}` === path)?.updatedAt || content.articles.find((article) => `/blog/${article.slug}` === path)?.publishedAt) ? { lastModified: content.articles.find((article) => `/blog/${article.slug}` === path)!.updatedAt || content.articles.find((article) => `/blog/${article.slug}` === path)!.publishedAt } : {}),
      alternates: {
        languages: Object.fromEntries(
          available.map((l) => [l, `${siteUrl}${localizedPath(l, path)}`]),
        ),
      },
    }));
  },
  );
}

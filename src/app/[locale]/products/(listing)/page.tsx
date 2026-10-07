import { notFound } from "next/navigation";
import Catalog from "@/components/commerce/Catalog";
import { isLocale, locales } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";
import { commerce } from "@/content/commerce";
import { siteCopy } from "@/content/site";
import { getPublishedContent } from "@/lib/cms/server";
import { applyCopy } from "@/lib/cms/defaults";
type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ search?: string; q?: string; category?: string }>;
};
export async function generateMetadata({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const content = await getPublishedContent();
  const c = applyCopy(siteCopy[locale], `site.${locale}`, content.copy);
  const t = applyCopy(commerce[locale], `commerce.${locale}`, content.copy);
  const metadata = pageMetadata(
    locale,
    "/products",
    c.collectionTitle,
    t.collectionIntro, content.settings.storeName, locales,
  );
  const query = await searchParams;
  const filtered = [query.search, query.q].some((value) => typeof value === "string" && value.trim()) || (typeof query.category === "string" && !!query.category.trim() && query.category !== "all");
  return { ...metadata, ...(filtered && !metadata.robots ? { robots: { index: false, follow: true } } : {}) };
}
export default async function ProductsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  return (
    <Catalog
      locale={locale}
      initialSearch={
        typeof query.search === "string"
          ? query.search
          : typeof query.q === "string"
            ? query.q
            : ""
      }
      initialCategory={
        typeof query.category === "string" ? query.category : "all"
      }
    />
  );
}

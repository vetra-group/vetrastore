import { notFound, permanentRedirect } from "next/navigation";
import { HONEY_ID } from "@/lib/catalog";
import { isLocale, locales, localizedPath } from "@/lib/i18n";
import { productLocaleReady } from "@/lib/cms/localization";
import { getPublishedContent } from "@/lib/cms/server";
import { pageMetadata, siteUrl } from "@/lib/metadata";
import ProductDetail from "@/components/commerce/ProductDetail";

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
async function findProduct(slug: string) {
  return (await getPublishedContent()).products.find((product) => product.status === "published" && (product.slug === slug || product.previousSlugs?.includes(slug)));
}
export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const content = await getPublishedContent();
  const product = await findProduct(slug);
  if (!isLocale(locale) || !product || !productLocaleReady(product, locale)) return {};
  const metadata = pageMetadata(locale, `/products/${product.slug}`, `${product.brand} ${product.name[locale]}`, product.description[locale], content.settings.storeName, locales.filter((language) => productLocaleReady(product, language)));
  return { ...metadata, openGraph: { ...metadata.openGraph, images: [{ url: product.image, alt: product.card[locale].imageAlt }] } };
}
export default async function ProductPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const product = await findProduct(slug);
  if (!isLocale(locale) || !product || !productLocaleReady(product, locale)) notFound();
  if (product.slug !== slug) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(await searchParams)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
    permanentRedirect(localizedPath(locale, product.id === HONEY_ID ? "/coffee-blossom-honey" : `/products/${product.slug}`) + (query.size ? `?${query}` : ""));
  }
  if (product.id === HONEY_ID) permanentRedirect(localizedPath(locale, "/coffee-blossom-honey"));
  const schema = { "@context": "https://schema.org", "@type": "Product", name: product.name[locale], description: product.description[locale], image: new URL(product.image, siteUrl).href, brand: { "@type": "Brand", name: product.brand }, offers: { "@type": "Offer", price: product.price, priceCurrency: "THB", url: `${siteUrl}${localizedPath(locale, `/products/${slug}`)}`, ...(product.stock !== null ? { availability: `https://schema.org/${product.stock === 0 ? "OutOfStock" : "InStock"}` } : {}) } };
  return <><ProductDetail locale={locale} product={product} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} /></>;
}

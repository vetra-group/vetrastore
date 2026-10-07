import { notFound, permanentRedirect } from "next/navigation";
import { HONEY_ID } from "@/lib/catalog";
import { isLocale, locales, localizedPath } from "@/lib/i18n";
import { productLocaleReady } from "@/lib/cms/localization";
import { getPublishedContent } from "@/lib/cms/server";
import { pageMetadata } from "@/lib/metadata";
import ProductDetail from "@/components/commerce/ProductDetail";
import { checkoutPaymentOptions } from "@/lib/public-payment-availability";
import { commerce } from "@/content/commerce";
import { applyCopy } from "@/lib/cms/defaults";
import { breadcrumbSchema, pageSchema, productSchema, serializeSchema } from "@/lib/structured-data";

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
async function findProduct(slug: string) {
  return (await getPublishedContent()).products.find((product) => product.status === "published" && (product.slug === slug || product.previousSlugs?.includes(slug)));
}
export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const content = await getPublishedContent();
  const product = await findProduct(slug);
  if (!isLocale(locale) || !product || !productLocaleReady(product, locale)) return {};
  return pageMetadata(locale, `/products/${product.slug}`, `${product.brand} ${product.name[locale]}`, product.description[locale], content.settings.storeName, locales.filter((language) => productLocaleReady(product, language)), product.image);
}
export default async function ProductPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const product = await findProduct(slug);
  if (!isLocale(locale) || !product || !productLocaleReady(product, locale)) notFound();
  if (product.slug !== slug || product.id === HONEY_ID) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(await searchParams)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
    permanentRedirect(localizedPath(locale, product.id === HONEY_ID ? "/coffee-blossom-honey" : `/products/${product.slug}`) + (query.size ? `?${query}` : ""));
  }
  const content = await getPublishedContent();
  const paymentsEnabled = checkoutPaymentOptions().providers.length > 0;
  const schema = productSchema(product, locale, content.settings, paymentsEnabled);
  const t = applyCopy(commerce[locale], `commerce.${locale}`, content.copy);
  const path = `/products/${product.slug}`;
  const breadcrumbs = breadcrumbSchema(locale, [
    { name: t.home, path: "" }, { name: t.products, path: "/products" },
    { name: product.name[locale], path },
  ]);
  const webpage = { ...pageSchema(locale, path, product.name[locale]),
    mainEntity: { "@id": schema["@id"] }, breadcrumb: { "@id": breadcrumbs["@id"] },
  };
  return <><ProductDetail locale={locale} product={product} paymentsEnabled={paymentsEnabled} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeSchema(schema) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeSchema(webpage) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeSchema(breadcrumbs) }} />
  </>;
}

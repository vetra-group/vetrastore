import { notFound } from "next/navigation";
import HoneyExperience from "@/components/honey/HoneyExperience";
import { commerce } from "@/content/commerce";
import { HONEY_ID } from "@/lib/catalog";
import { publicQuote } from "@/lib/public-pricing";
import { getLocalizedPublishedContent } from "@/lib/localized-content";
import { applyCopy } from "@/lib/cms/defaults";
import { isLocale, locales, localizedPath } from "@/lib/i18n";
import { productLocaleReady } from "@/lib/cms/localization";
import { pageMetadata, siteUrl } from "@/lib/metadata";
import { checkoutPaymentOptions } from "@/lib/public-payment-availability";

type Props = { params: Promise<{ locale: string }> };
const path = "/coffee-blossom-honey";

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const content = await getLocalizedPublishedContent(locale);
  const honey = content.products.find((product) => product.id === HONEY_ID && product.status === "published");
  if (!honey) return {};
  const t = applyCopy(commerce[locale], `commerce.${locale}`, content.copy);
  const metadata = pageMetadata(
    locale,
    path,
    `${honey.brand} ${honey.name[locale]} · ${honey.weight} ${t.gram}`,
    honey.description[locale], content.settings.storeName, locales.filter((language) => productLocaleReady(honey, language)),
  );

  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      images: [{ url: honey.image, alt: honey.card[locale].imageAlt }],
    },
  };
}

export default async function CoffeeBlossomHoneyPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const content = await getLocalizedPublishedContent(locale);
  const honey = content.products.find((product) => product.id === HONEY_ID && product.status === "published");
  if (!honey) notFound();
  const baseQuote = publicQuote(honey, 1, locale);
  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: honey.name[locale],
    description: honey.description[locale],
    image: [new URL(honey.image, siteUrl).href, `${siteUrl}/images/honey-front.jpg`],
    brand: { "@type": "Brand", name: honey.brand },
    weight: {
      "@type": "QuantitativeValue",
      value: honey.weight,
      unitCode: "GRM",
    },
    ...(baseQuote ? { offers: {
      "@type": "Offer",
      price: baseQuote.total,
      priceCurrency: baseQuote.currency,
      url: `${siteUrl}${localizedPath(locale, path)}`,
      ...(honey.stock !== null ? { availability: `https://schema.org/${honey.stock === 0 ? "OutOfStock" : "InStock"}` } : {}),
    } } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(product).replace(/</g, "\\u003c"),
        }}
      />
      <HoneyExperience locale={locale} paymentsEnabled={checkoutPaymentOptions().providers.length > 0} />
    </>
  );
}

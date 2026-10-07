import { notFound } from "next/navigation";
import HoneyExperience from "@/components/honey/HoneyExperience";
import { commerce } from "@/content/commerce";
import { HONEY_ID } from "@/lib/catalog";
import { getLocalizedPublishedContent } from "@/lib/localized-content";
import { applyCopy } from "@/lib/cms/defaults";
import { isLocale, locales } from "@/lib/i18n";
import { productLocaleReady } from "@/lib/cms/localization";
import { pageMetadata, withSocialImage } from "@/lib/metadata";
import { checkoutPaymentOptions } from "@/lib/public-payment-availability";
import { breadcrumbSchema, pageSchema, productSchema, serializeSchema } from "@/lib/structured-data";

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

  return withSocialImage(metadata, honey.image, honey.card[locale].imageAlt);
}

export default async function CoffeeBlossomHoneyPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const content = await getLocalizedPublishedContent(locale);
  const honey = content.products.find((product) => product.id === HONEY_ID && product.status === "published");
  if (!honey) notFound();
  const paymentsEnabled = checkoutPaymentOptions().providers.length > 0;
  const product = productSchema(honey, locale, content.settings, paymentsEnabled);
  const t = applyCopy(commerce[locale], `commerce.${locale}`, content.copy);
  const breadcrumbs = breadcrumbSchema(locale, [
    { name: t.home, path: "" }, { name: t.products, path: "/products" },
    { name: honey.name[locale], path },
  ]);
  const webpage = { ...pageSchema(locale, path, honey.name[locale]),
    mainEntity: { "@id": product["@id"] }, breadcrumb: { "@id": breadcrumbs["@id"] },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeSchema(product),
        }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeSchema(webpage) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeSchema(breadcrumbs) }} />
      <HoneyExperience locale={locale} paymentsEnabled={paymentsEnabled} />
    </>
  );
}

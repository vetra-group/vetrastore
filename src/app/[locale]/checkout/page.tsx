import { notFound } from "next/navigation";
import Checkout from "@/components/commerce/Checkout";
import { isLocale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";
import { commerce } from "@/content/commerce";
import { getPublishedContent } from "@/lib/cms/server";
import { applyCopy } from "@/lib/cms/defaults";
import { demoEnabled } from "@/lib/demo";
type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const content = await getPublishedContent();
  const t = applyCopy(commerce[locale], `commerce.${locale}`, content.copy);
  return {
    ...pageMetadata(
      locale,
      "/checkout",
      t.checkoutEyebrow,
      t.enquiryBody, content.settings.storeName,
    ),
    robots: { index: false, follow: true },
  };
}
export default async function CheckoutPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <Checkout
      locale={locale}
      enquiriesEnabled={
        demoEnabled || (process.env.ORDER_ENQUIRIES_ENABLED === "true" &&
        Boolean(process.env.MONGODB_URI))
      }
    />
  );
}

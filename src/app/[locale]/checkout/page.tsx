import { notFound } from "next/navigation";
import Checkout from "@/components/commerce/Checkout";
import { isLocale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";
import { commerce } from "@/content/commerce";
import { getPublishedContent } from "@/lib/cms/server";
import { applyCopy } from "@/lib/cms/defaults";
import { demoEnabled } from "@/lib/demo";
import { checkoutPaymentOptions } from "@/lib/public-payment-availability";
import { paymentIdPattern } from "@/lib/payments/orders";
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ order?: string | string[] }> };
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
export default async function CheckoutPage({ params, searchParams }: Props) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const paymentOptions = checkoutPaymentOptions();
  const resumeOrderId = typeof query.order === "string" && paymentIdPattern.test(query.order) ? query.order : undefined;
  return (
    <Checkout
      locale={locale}
      enquiriesEnabled={
        demoEnabled || (process.env.ORDER_ENQUIRIES_ENABLED === "true" &&
        Boolean(process.env.MONGODB_URI))
      }
      paymentsEnabled={paymentOptions.providers.length > 0}
      paymentProviders={paymentOptions.providers}
      defaultPaymentProvider={paymentOptions.defaultProvider}
      resumeOrderId={resumeOrderId}
    />
  );
}

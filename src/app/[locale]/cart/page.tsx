import { notFound } from "next/navigation";
import Cart from "@/components/commerce/Cart";
import { isLocale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";
import { commerce } from "@/content/commerce";
import { getPublishedContent } from "@/lib/cms/server";
import { applyCopy } from "@/lib/cms/defaults";
import { checkoutPaymentOptions } from "@/lib/public-payment-availability";
type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const content = await getPublishedContent();
  const t = applyCopy(commerce[locale], `commerce.${locale}`, content.copy);
  return {
    ...pageMetadata(
      locale,
      "/cart",
      t.cartTitle,
      t.cartSubtitle, content.settings.storeName,
    ),
    robots: { index: false, follow: true },
  };
}
export default async function CartPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <Cart locale={locale} paymentsEnabled={checkoutPaymentOptions().providers.length > 0} />;
}

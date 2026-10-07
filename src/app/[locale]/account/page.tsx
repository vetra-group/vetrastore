import { notFound } from "next/navigation";
import Account from "@/components/commerce/Account";
import { isLocale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";
import { commerce } from "@/content/commerce";
import { getPublishedContent } from "@/lib/cms/server";
import { applyCopy } from "@/lib/cms/defaults";
type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const content = await getPublishedContent();
  const t = applyCopy(commerce[locale], `commerce.${locale}`, content.copy);
  return {
    ...pageMetadata(
      locale,
      "/account",
      t.favourites,
      t.savedIntro, content.settings.storeName,
    ),
    robots: { index: false, follow: true },
  };
}
export default async function AccountPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <Account locale={locale} />;
}

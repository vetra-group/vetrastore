import { notFound } from "next/navigation";
import { HelpContent, helpCopy } from "@/components/editorial/Editorial";
import { isLocale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";
import { getPublishedContent } from "@/lib/cms/server";
import { applyCopy } from "@/lib/cms/defaults";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const content = await getPublishedContent();
  const copy = applyCopy(helpCopy[locale], `pages.help.${locale}`, content.copy);
  return pageMetadata(
    locale,
    "/help",
    copy.title,
    copy.description, content.settings.storeName,
  );
}
export default async function HelpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <HelpContent locale={locale} />;
}

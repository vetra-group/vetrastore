import { notFound } from "next/navigation";
import { ContactContent, contactCopy } from "@/components/editorial/Editorial";
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
  const copy = applyCopy(contactCopy[locale], `pages.contact.${locale}`, content.copy);
  return pageMetadata(
    locale,
    "/contact",
    copy.title,
    copy.description, content.settings.storeName,
  );
}
export default async function ContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const { subject } = query;
  const initialWholesale = Object.fromEntries(["product", "quantity", "business", "destination", "neededBy"].flatMap((key) => typeof query[key] === "string" ? [[key, query[key].slice(0, key === "destination" ? 500 : 160)]] : []));
  return (
    <ContactContent
      locale={locale}
      initialSubject={typeof subject === "string" ? subject : undefined}
      initialWholesale={initialWholesale}
    />
  );
}

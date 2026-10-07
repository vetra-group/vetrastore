import { notFound } from "next/navigation";
import AboutContent from "@/components/about/AboutContent";
import { storyCopy } from "@/content/pages";
import { isLocale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";
import { getPublishedContent } from "@/lib/cms/server";
import { applyCopy } from "@/lib/cms/defaults";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const content = await getPublishedContent();
  const copy = applyCopy(storyCopy[locale], `pages.story.${locale}`, content.copy);
  return pageMetadata(locale, "/about", copy.title, copy.description, content.settings.storeName, undefined, copy.hero);
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <AboutContent locale={locale} />;
}

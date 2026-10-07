import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import CmsApp from "@/components/cms/CmsApp";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "CMS", robots: { index: false, follow: false } };
export default async function CmsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <CmsApp key={locale} locale={locale} />;
}

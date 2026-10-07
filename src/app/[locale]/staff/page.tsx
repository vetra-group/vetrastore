import { getPublishedContent } from "@/lib/cms/server";
import { notFound } from "next/navigation";
import StaffDashboard from "@/components/demo/StaffDashboard";
import { staffCopy } from "@/content/staff";
import { isLocale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const content = await getPublishedContent();
  if (!isLocale(locale)) return {};
  const c = staffCopy[locale];
  return {
    ...pageMetadata(locale, "/staff", c.title, c.description, content.settings.storeName),
    robots: { index: false, follow: false },
  };
}

export default async function StaffPage({ params }: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale) || process.env.NEXT_PUBLIC_DEMO_MODE !== "true") notFound();
  return <StaffDashboard locale={locale} />;
}

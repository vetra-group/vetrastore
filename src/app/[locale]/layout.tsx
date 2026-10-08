import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, locales, localeSettings } from "@/lib/i18n";
import { siteUrl, preventIndexing } from "@/lib/metadata";
import { demoEnabled } from "@/lib/demo";
import { DemoProvider } from "@/components/demo/DemoProvider";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StoreShell from "@/components/StoreShell";
import LocalAudit from "@/components/diagnostics/LocalAudit";
import { StoreProvider } from "@/components/commerce/StoreProvider";
import { PublishedProvider } from "@/components/cms/PublishedProvider";
import { getLocalizedPublishedContent } from "@/lib/localized-content";
import { getPublishedContent } from "@/lib/cms/server";
import { publicContent } from "@/lib/cms/public-content";
import { articleLocaleReady, productLocaleReady } from "@/lib/cms/localization";
import { HONEY_ID } from "@/lib/catalog";
import { organizationSchema, serializeSchema, websiteSchema } from "@/lib/structured-data";
import { bodyLatin, bodyThai, headingThai, bodyArabic, headingArabic } from "../fonts";
import "../globals.css";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getPublishedContent();
  return {
  metadataBase: new URL(siteUrl),
  title: { default: settings.storeName, template: `%s | ${settings.storeName}` },
  robots: { index: !preventIndexing, follow: !preventIndexing },
  };
}
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const content = await getLocalizedPublishedContent(locale);
  const storefront = publicContent(content);
  const fullStorefront = await getPublishedContent();
  const availability = Object.fromEntries([
    ...fullStorefront.products.map((product) => [product.id === HONEY_ID ? "/coffee-blossom-honey" : `/products/${product.slug}`, locales.filter((language) => productLocaleReady(product, language))]),
    ...fullStorefront.articles.map((article) => [`/blog/${article.slug}`, locales.filter((language) => articleLocaleReady(article, language))]),
  ]);
  return (
    <html lang={locale} dir={localeSettings(locale).direction} className={`${bodyLatin.variable} ${bodyThai.variable} ${headingThai.variable} ${bodyArabic.variable} ${headingArabic.variable}`} data-scroll-behavior="smooth" data-demo-mode={demoEnabled ? "true" : undefined}>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeSchema({ "@context": "https://schema.org", ...organizationSchema(storefront.settings, locale) }) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeSchema(websiteSchema(storefront.settings)) }} />
        <PublishedProvider content={storefront}><StoreProvider locale={locale} products={fullStorefront.products}>
          <DemoProvider enabled={demoEnabled}>
            <StoreShell
              header={<Header locale={locale} availability={availability} />}
              footer={<Footer locale={locale} />}
            >
              {children}
            </StoreShell>
          </DemoProvider>
        </StoreProvider></PublishedProvider>
        {demoEnabled && process.env.LOCAL_AUDIT === "true" && <LocalAudit />}
      </body>
    </html>
  );
}

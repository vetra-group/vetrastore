import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "@/components/loading/NavigationLink";
import { Eye, ArrowLeft } from "lucide-react";
import { authorizeCms } from "@/lib/cms/auth";
import { getCmsState } from "@/lib/cms/server";
import { isLocale, localizedPath } from "@/lib/i18n";
import { HONEY_ID } from "@/lib/catalog";
import { publicContent } from "@/lib/cms/public-content";
import { PublishedProvider } from "@/components/cms/PublishedProvider";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BlogArticle from "@/components/blog/BlogArticle";
import ProductDetail from "@/components/commerce/ProductDetail";
import HoneyExperience from "@/components/honey/HoneyExperience";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "CMS draft preview", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function DraftPreview({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ type?: string; key?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") || "localhost";
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host);
  const request = new Request(`${local ? "http" : "https"}://${host}/api/cms`, { headers: requestHeaders });
  try { await authorizeCms(request); } catch { redirect(localizedPath(locale, "/cms")); }
  const { type, key } = await searchParams;
  if ((type !== "article" && type !== "product") || typeof key !== "string" || key.length > 80) notFound();
  const state = await getCmsState(), draft = structuredClone(state.draft);
  const article = type === "article" ? draft.articles.find((item) => item.slug === key || item.id === key) : undefined;
  const product = type === "product" ? draft.products.find((item) => item.id === key || item.slug === key) : undefined;
  if (!article && !product) notFound();
  if (product) product.status = "published";
  return <PublishedProvider content={publicContent(draft)}>
    <aside className={styles.banner}><span><Eye aria-hidden="true" />{locale === "ar" ? "معاينة المسودة · لم تُنشر بعد" : locale === "th" ? "ตัวอย่างฉบับร่าง · ยังไม่เผยแพร่" : "Draft preview · not published"}</span><span>{locale === "ar" ? `الإصدار ${state.revision} · الشراء غير متاح في المعاينة` : locale === "th" ? `ฉบับที่ ${state.revision} · ปิดการสั่งซื้อในตัวอย่าง` : `Revision ${state.revision} · purchases disabled in preview`}</span><Link href={localizedPath(locale, `/cms?view=${type === "article" ? "journal" : "products"}`)}><ArrowLeft aria-hidden="true" />{locale === "ar" ? "العودة إلى الإدارة" : locale === "th" ? "กลับไปจัดการ" : "Back to CMS"}</Link></aside>
    <Header locale={locale} />
    {article ? <main id="main-content"><BlogArticle locale={locale} article={article} overrideContent={draft} /></main> : product?.id === HONEY_ID ? <HoneyExperience locale={locale} overrideContent={draft} preview /> : product ? <main id="main-content"><ProductDetail locale={locale} product={product} preview /></main> : null}
    <Footer locale={locale} />
  </PublishedProvider>;
}

import type { Metadata } from "next";
import { languageConfig, locales, localizedPath, type Locale } from "./i18n";
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const preventIndexing = process.env.NEXT_PUBLIC_DEMO_MODE === "true" || process.env.SITE_NOINDEX === "true" || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/.test(siteUrl);
export function pageMetadata(
  locale: Locale,
  path: string,
  title: string,
  description: string,
  storeName = "VETRA STORE",
  availableLocales: readonly Locale[] = locales,
): Metadata {
  return {
    ...(preventIndexing ? { robots: { index: false, follow: false } } : {}),
    title: { absolute: `${title} | ${storeName}` },
    description,
    alternates: {
      canonical: localizedPath(locale, path),
      languages: Object.fromEntries([
        ...availableLocales.map((l) => [l, localizedPath(l, path)]),
        ["x-default", localizedPath(availableLocales.includes(languageConfig.defaultLocale) ? languageConfig.defaultLocale : availableLocales[0] ?? locale, path)],
      ]),
    },
    openGraph: {
      title: `${title} | ${storeName}`,
      description,
      url: localizedPath(locale, path),
      locale: languageConfig.locales.find((l) => l.code === locale)?.region,
      type: "website",
      images: [{ url: "/images/hero-eshan-1.webp", width: 2172, height: 724 }],
    },
  };
}

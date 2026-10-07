import type { Metadata } from "next";
import { languageConfig, locales, localizedPath, type Locale } from "./i18n";
import { honey } from "./catalog";
import { preventIndexing } from "./site-origin";
export { siteUrl, preventIndexing } from "./site-origin";
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
      siteName: storeName,
      url: localizedPath(locale, path),
      locale: languageConfig.locales.find((l) => l.code === locale)?.region,
      alternateLocale: availableLocales.filter((language) => language !== locale).map((language) => languageConfig.locales.find((entry) => entry.code === language)!.region),
      type: "website",
      images: [{ url: honey.image, width: 1100, height: 1000, alt: honey.card[locale].imageAlt }],
    },
    twitter: {
      card: "summary_large_image", title: `${title} | ${storeName}`, description,
      images: [{ url: honey.image, alt: honey.card[locale].imageAlt }],
    },
  };
}

/** Keep social networks on the same page-specific image when a route overrides
 * the shared fallback. The public metadata helper's existing API is unchanged. */
export function withSocialImage(metadata: Metadata, url: string, alt: string): Metadata {
  return {
    ...metadata,
    openGraph: { ...metadata.openGraph, images: [{ url, alt }] },
    twitter: { ...metadata.twitter, card: "summary_large_image", images: [{ url, alt }] },
  };
}

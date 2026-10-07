import type { Metadata } from "next";
import { languageConfig, locales, localizedPath, type Locale } from "./i18n";
import { preventIndexing } from "./site-origin";
import { socialImagePath, socialImageSize } from "./social-image";
export { siteUrl, preventIndexing } from "./site-origin";
export function pageMetadata(
  locale: Locale,
  path: string,
  title: string,
  description: string,
  storeName = "VETRA STORE",
  availableLocales: readonly Locale[] = locales,
  imageVersion = "",
): Metadata {
  const image = socialImagePath(locale, path, title, description, imageVersion);
  const fullTitle = !path || path === "/" ? `${storeName} | ${title}` : `${title} | ${storeName}`;
  const imageAlt = fullTitle;
  return {
    ...(preventIndexing ? { robots: { index: false, follow: false } } : {}),
    title: { absolute: fullTitle },
    description,
    alternates: {
      canonical: localizedPath(locale, path),
      languages: Object.fromEntries([
        ...availableLocales.map((l) => [l, localizedPath(l, path)]),
        ["x-default", localizedPath(availableLocales.includes(languageConfig.defaultLocale) ? languageConfig.defaultLocale : availableLocales[0] ?? locale, path)],
      ]),
    },
    openGraph: {
      title: fullTitle,
      description,
      siteName: storeName,
      url: localizedPath(locale, path),
      locale: languageConfig.locales.find((l) => l.code === locale)?.region,
      alternateLocale: availableLocales.filter((language) => language !== locale).map((language) => languageConfig.locales.find((entry) => entry.code === language)!.region),
      type: "website",
      images: [{ url: image, ...socialImageSize, type: "image/png", alt: imageAlt }],
    },
    twitter: {
      card: "summary_large_image", title: fullTitle, description,
      images: [{ url: image, ...socialImageSize, alt: imageAlt }],
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

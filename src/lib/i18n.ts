export const languageConfig = {
  defaultLocale: "en",
  locales: [
    { code: "en", label: "English", region: "en_US", direction: "ltr", intl: "en" },
    { code: "ar", label: "العربية", region: "ar_SA", direction: "rtl", intl: "ar" },
    { code: "th", label: "ไทย", region: "th_TH", direction: "ltr", intl: "th-TH" },
  ],
} as const;
export type Locale = (typeof languageConfig.locales)[number]["code"];
export type Localized<T> = Record<Locale, T>;
export const locales = languageConfig.locales.map(({ code }) => code);
export function localeSettings(locale: Locale) {
  return languageConfig.locales.find((language) => language.code === locale)!;
}
export function isLocale(value: string): value is Locale {
  return locales.some((locale) => locale === value);
}
export function localizedPath(locale: Locale, path = "") {
  const suffix =
    path && path !== "/" ? (path.startsWith("/") ? path : `/${path}`) : "";
  const prefix = locale === languageConfig.defaultLocale ? "" : `/${locale}`;
  return `${prefix}${suffix}` || "/";
}
// CMS destinations can be neutral store paths, explicit language URLs, or
// external URLs. Preserve an editor's explicit language selection.
export function localizedDestination(locale: Locale, path: string) {
  const pathname = path.split(/[?#]/, 1)[0];
  if (!path.startsWith("/") || locales.some((language) => pathname === `/${language}` || pathname.startsWith(`/${language}/`))) return path;
  return localizedPath(locale, path);
}
/** Page links follow the selected language; media, downloads and explicit
 * language links keep their original public URL. */
export function localizedContentHref(locale: Locale, href: string) {
  if (!href.startsWith("/") || href.startsWith("//") || /^\/(?:images|uploads|fonts|api|_next)(?:\/|$)/.test(href) || /\.[a-z0-9]{2,8}(?:[?#]|$)/i.test(href)) return href;
  return localizedDestination(locale, href);
}
export function translate<T>(content: Localized<T>, locale: Locale): T {
  return content[locale];
}

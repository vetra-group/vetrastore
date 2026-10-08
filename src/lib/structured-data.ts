import { HONEY_ID, type CatalogProduct } from "./catalog";
import type { CmsSettings } from "./cms/types";
import { locales, localizedPath, type Locale } from "./i18n";
import { siteUrl } from "./metadata";
import { publicQuote } from "./public-pricing";

export const absoluteUrl = (path: string) => new URL(path, `${siteUrl}/`).href;
export const organizationId = absoluteUrl("/#organization");
export const websiteId = absoluteUrl("/#website");

/** Shared identity uses only public, supplied business facts. Marketing targets
 * are not physical locations, delivery coverage, or local offices. */
export function organizationSchema(settings: CmsSettings, locale: Locale) {
  return {
    "@type": "Organization",
    "@id": organizationId,
    name: settings.storeName,
    url: absoluteUrl("/"),
    ...(settings.storeName === "VETRA STORE" ? { logo: {
      "@type": "ImageObject", "@id": absoluteUrl("/#logo"),
      url: absoluteUrl("/vetra-store-logo.svg"), width: 1352, height: 541,
      caption: settings.storeName,
    } } : {}),
    ...(settings.email ? { email: settings.email } : {}),
    ...(settings.phone ? { telephone: settings.phone } : {}),
    ...(settings.address[locale] ? { address: settings.address[locale] } : {}),
  };
}

export function websiteSchema(settings: CmsSettings) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite", "@id": websiteId,
    name: settings.storeName, url: absoluteUrl("/"), inLanguage: locales,
    publisher: { "@id": organizationId },
  };
}

export function pageSchema(locale: Locale, path: string, name: string, type = "WebPage") {
  const url = absoluteUrl(localizedPath(locale, path));
  return {
    "@context": "https://schema.org", "@type": type,
    "@id": `${url}#webpage`, name, url, inLanguage: locale,
    isPartOf: { "@id": websiteId }, publisher: { "@id": organizationId },
  };
}

export function breadcrumbSchema(locale: Locale, entries: readonly { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    "@id": `${absoluteUrl(localizedPath(locale, entries.at(-1)?.path ?? ""))}#breadcrumb`,
    itemListElement: entries.map(({ name, path }, index) => ({
      "@type": "ListItem", position: index + 1, name,
      item: absoluteUrl(localizedPath(locale, path)),
    })),
  };
}

export function productSchema(product: CatalogProduct & { stock: number | null }, locale: Locale, settings: CmsSettings, paymentsEnabled: boolean) {
  const path = product.id === HONEY_ID ? "/coffee-blossom-honey" : `/products/${product.slug}`;
  const url = absoluteUrl(localizedPath(locale, path));
  const images = [product.image, ...(product.gallery ?? []).map((image) => image.src)];
  const quote = publicQuote(product, 1, "TH");
  // Public product offers use the Thailand THB price. Checkout charges THB
  // for Thai delivery. A demo, an enquiry,
  // or unknown stock must not advertise a purchasable machine-readable Offer.
  const offer = locale === "th" && paymentsEnabled && product.stock !== null && quote?.currency === "THB" ? {
    "@type": "Offer", price: quote.total, priceCurrency: "THB", url,
    availability: `https://schema.org/${product.stock === 0 ? "OutOfStock" : "InStock"}`,
    seller: organizationSchema(settings, locale),
  } : undefined;
  return {
    "@context": "https://schema.org", "@type": "Product",
    "@id": `${absoluteUrl(path)}#product`, url,
    name: product.name[locale], description: product.description[locale],
    image: [...new Set(images)].map(absoluteUrl),
    brand: { "@type": "Brand", name: product.brand },
    weight: { "@type": "QuantitativeValue", value: product.weight, unitCode: "GRM" },
    mainEntityOfPage: { "@id": `${url}#webpage` },
    ...(offer ? { offers: offer } : {}),
  };
}

export const serializeSchema = (schema: unknown) => JSON.stringify(schema).replace(/</g, "\\u003c");

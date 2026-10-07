import { storeDetails } from "@/content/store-details";
import type { CmsSettings } from "@/lib/cms/types";
import { locales, type Locale } from "@/lib/i18n";

export const businessKeys = ["stock", "shipping", "returns", "wholesale", "batch"] as const;
export type BusinessKey = typeof businessKeys[number];

/** Only owner-confirmed terms replace the site's explicit pending information. */
export function resolveSellingDetails(settings: CmsSettings, locale: Locale) {
  const result = structuredClone(storeDetails[locale]);
  for (const key of businessKeys) {
    const setting = settings.business?.[key];
    if (setting?.confirmed && setting.content[locale] && Object.values(setting.content[locale]).every((text) => text.trim())) result[key] = { ...setting.content[locale] };
  }
  return result;
}

/** Derive public copy without overwriting the editor's stored translations. */
export function sellingCopy(settings: CmsSettings, copy: Record<string, string>) {
  const result = { ...copy };
  for (const locale of locales) for (const key of businessKeys) {
    const detail = settings.business?.[key];
    if (!detail?.confirmed) continue;
    const value = detail.content[locale];
    if (!value || !Object.values(value).every((text) => text.trim())) continue;
    for (const field of ["title", "summary", "description"] as const) result[`store.${locale}.${key}.${field}`] = value[field];
    if (key === "shipping") {
      result[`pages.help.${locale}.shippingText`] = value.description;
      result[`commerce.${locale}.deliveryNote`] = value.summary;
      result[`honey.${locale}.shippingNote`] = value.summary;
    }
    if (key === "stock") result[`pages.help.${locale}.shippingNote`] = value.description;
    if (key === "returns") result[`pages.help.${locale}.returnsText`] = value.description;
    if (key === "batch") result[`honey.${locale}.labelNote`] = value.description;
  }
  return result;
}

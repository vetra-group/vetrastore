import type { Market } from "./catalog";

/** The delivery address, rather than the browsing language, decides the final price. */
export function marketForShippingCountry(country: string): Market | null {
  const normalized = country.trim().normalize("NFKC").toLocaleLowerCase("en");
  if (!normalized) return null;
  return /^(?:th|tha|thailand|kingdom of thailand|ไทย|ประเทศไทย|ราชอาณาจักรไทย|تايلاند|تايلند|مملكة تايلاند)$/.test(normalized) ? "TH" : "INTL";
}

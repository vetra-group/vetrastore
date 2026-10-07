import type { MetadataRoute } from "next";
import { locales, localizedPath } from "@/lib/i18n";
import { siteUrl, preventIndexing } from "@/lib/metadata";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: preventIndexing ? { userAgent: "*", disallow: "/" } : {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        ...["/cart", "/checkout", "/account", "/staff", "/cms"].flatMap((path) =>
          locales.map((locale) => localizedPath(locale, path)),
        ),
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

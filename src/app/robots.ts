import type { MetadataRoute } from "next";
import { siteUrl, preventIndexing } from "@/lib/metadata";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: preventIndexing ? { userAgent: "*", disallow: "/" } : {
      userAgent: "*",
      // Public images must be crawlable; private APIs remain excluded. Page
      // noindex directives require crawl access. Authentication protects CMS.
      allow: ["/", "/api/cms-media/"],
      disallow: ["/api/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

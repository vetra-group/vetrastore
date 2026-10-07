import type { NextConfig } from "next";
import { locales } from "./src/lib/i18n";
const config: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  outputFileTracingExcludes: { "*": ["./.local/**/*", "./output/**/*"] },
  async headers() {
    return [...["/cms/:path*", ...locales.map((locale) => `/${locale}/cms/:path*`)].map((source) => ({ source, headers: [
      { key: "Cache-Control", value: "private, no-store" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
      { key: "Referrer-Policy", value: "no-referrer" },
    ] })), {
      source: "/_next/image",
      has: [{ type: "query" as const, key: "url", value: "/api/cms-media/.+" }],
      // The optimizer drops upstream robots headers and caches bytes for at
      // least four hours. Keep all CMS variants out of image indexes; published
      // originals have their own current publication-based indexing response.
      // This is not authorization: saved draft originals were already public.
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    }];
  },
  async rewrites() {
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    if (
      process.env.CLOUDINARY_MEDIA_ENABLED !== "true" ||
      !cloud ||
      !/^[a-zA-Z0-9_-]+$/.test(cloud)
    )
      return [];
    const media = [
      "hero-eshan-1.webp",
      "hero-eshan-2.webp",
      "hero-eshan-3.webp",
      "hero-eshan-4.webp",
      "hero-coffee-landscape.webp",
      "hero-honey-ritual.webp",
      "honey-product.png",
      "nature-story.webp",
      "coffee-beans.webp",
      "coffee-ritual.webp",
      "honey-front.jpg",
      "honey-back.jpg",
    ];
    return {
      beforeFiles: media.map((file) => ({
        source: `/images/${file}`,
        destination: `https://res.cloudinary.com/${cloud}/image/upload/vetra/${file}`,
      })),
    };
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
};
export default config;

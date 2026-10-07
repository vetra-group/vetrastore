import { createHash } from "node:crypto";
import type { Locale } from "./i18n";

export const socialImageSize = { width: 1200, height: 630 } as const;

/** Share cards mirror canonical public routes; private and filtered paths use the home card. */
export function socialImagePath(locale: Locale, path: string, title: string, description: string, sourceVersion = ""): string {
  const pathname = path.split(/[?#]/, 1)[0].replace(/\/$/, "") || "/";
  const publicPath = pathname === "/" || ["/products", "/about", "/blog", "/contact", "/help", "/coffee-blossom-honey"].includes(pathname) || /^\/(?:blog|products)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pathname);
  const cardPath = publicPath ? (pathname === "/" ? "home" : pathname.slice(1)) : "home";
  const version = createHash("sha256").update(["vetra-og-v2", locale, cardPath, title, description, sourceVersion].join("\0")).digest("hex").slice(0, 12);
  return `/og/${locale}/${cardPath}.png?v=${version}`;
}

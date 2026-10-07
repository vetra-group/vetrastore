import { NextRequest, NextResponse } from "next/server";
import { languageConfig, locales, localizedPath } from "@/lib/i18n";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const defaultPrefix = `/${languageConfig.defaultLocale}`;
  const rewriteHeader = "x-vetra-default-locale-rewrite";

  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const firstSegment = normalizedPath.split("/")[1];
  const pathLocale = locales.find((locale) => locale === firstSegment);
  const contentPath = pathLocale
    ? normalizedPath.slice(pathLocale.length + 1) || "/"
    : normalizedPath;
  if (contentPath === "/journal" || contentPath.startsWith("/journal/")) {
    const url = new URL(request.nextUrl.href);
    url.pathname = localizedPath(
      pathLocale ?? languageConfig.defaultLocale,
      `/blog${contentPath.slice("/journal".length)}`,
    );
    return NextResponse.redirect(url, 308);
  }

  const legacyAboutLocale = locales.find(
    (locale) => normalizedPath === `/${locale}/our-story`,
  );
  if (normalizedPath === "/our-story" || legacyAboutLocale) {
    // A plain URL prevents a legacy trailing slash from being inherited.
    const url = new URL(request.nextUrl.href);
    url.pathname = localizedPath(
      legacyAboutLocale ?? languageConfig.defaultLocale,
      "/about",
    );
    return NextResponse.redirect(url, 308);
  }

  if (contentPath === "/products/coffee-blossom-honey") {
    const url = new URL(request.nextUrl.href);
    url.pathname = localizedPath(pathLocale ?? languageConfig.defaultLocale, "/coffee-blossom-honey");
    return NextResponse.redirect(url, 308);
  }

  if (pathname === defaultPrefix || pathname.startsWith(`${defaultPrefix}/`)) {
    if (request.headers.get(rewriteHeader) === "1") {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(defaultPrefix.length) || "/";
    return NextResponse.redirect(url, 308);
  }

  if (locales.some((locale) => locale === firstSegment)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `${defaultPrefix}${pathname === "/" ? "" : pathname}`;
  const headers = new Headers(request.headers);
  headers.set(rewriteHeader, "1");
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  matcher: ["/((?!api|_next|images|.*\\..*).*)"],
};

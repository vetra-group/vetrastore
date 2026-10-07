import { getPublishedContent } from "@/lib/cms/server";
import { isLocale, languageConfig } from "@/lib/i18n";
import { quickSearch } from "@/lib/search-suggestions";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams, locale = params.get("locale") || languageConfig.defaultLocale;
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (!isLocale(locale)) return Response.json({ error: "Invalid language" }, { status: 400, headers });
  try { return Response.json(quickSearch(await getPublishedContent(), locale, params.get("q") || ""), { headers }); }
  catch { return Response.json({ error: "Search is temporarily unavailable" }, { status: 503, headers }); }
}

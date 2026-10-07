import "server-only";
import { getPublishedContent } from "@/lib/cms/server";
import { articleLocaleReady, productLocaleReady, slideLocaleReady } from "@/lib/cms/localization";
import type { Locale } from "@/lib/i18n";

/** A saved bilingual record stays intact. Publish its Arabic version only
 * when that record has Arabic content, never English under an Arabic URL. */
export async function getLocalizedPublishedContent(locale: Locale) {
  const content = await getPublishedContent();
  return {
    ...content,
    products: content.products.filter((product) => productLocaleReady(product, locale)),
    articles: content.articles.filter((article) => articleLocaleReady(article, locale)),
    slides: content.slides.filter((slide) => slideLocaleReady(slide, locale)),
  };
}

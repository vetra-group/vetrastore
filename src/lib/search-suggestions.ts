import { articleLocaleReady, productLocaleReady } from "@/lib/cms/localization";
import type { CmsContent } from "./cms/types";
import { searchStore, type SearchResult } from "./search";
import { HONEY_ID } from "./catalog";
import { publicQuote } from "./public-pricing";
import { localizedPath, type Locale } from "./i18n";

export type QuickResult = Omit<SearchResult, "score" | "description"> & { price?: number; currency?: NonNullable<ReturnType<typeof publicQuote>>["currency"] };
export type QuickSearch = { results: QuickResult[]; total: number; query: string };
export function quickSearch(content: CmsContent, locale: Locale, query: string): QuickSearch {
  const clean = query.trim().slice(0, 120);
  if (!clean) {
    const publishedProducts = content.products.filter(product => product.status === "published" && productLocaleReady(product, locale));
    const publishedArticles = content.articles.filter(article => article.status === "published" && articleLocaleReady(article, locale));
    const products: QuickResult[] = publishedProducts.slice(0, 3).map(p => {
      const quote = publicQuote(p, 1, locale);
      return { key: `product-${p.id}`, kind: "product", title: `${p.brand} ${p.name[locale]}`, image: p.image, href: localizedPath(locale, p.id === HONEY_ID ? "/coffee-blossom-honey" : `/products/${p.slug}`), ...(quote ? { price: quote.total, currency: quote.currency } : {}) };
    });
    const articles: QuickResult[] = publishedArticles.sort((a,b)=>Number(!!b.featured)-Number(!!a.featured)).slice(0, 3).map(a=>({key:`article-${a.slug}`,kind:"article",title:a.content[locale].title,image:a.image,href:localizedPath(locale,`/blog/${a.slug}`)}));
    return { query: clean, results: [...products,...articles], total: publishedProducts.length + publishedArticles.length };
  }
  const found = searchStore(content, locale, clean);
  return { query: clean, total: found.length, results: found.slice(0, 6).map(({key,kind,title,image,href}) => {
    const product = kind === "product" ? content.products.find(p=>`product-${p.id}` === key) : undefined;
    const quote = product ? publicQuote(product, 1, locale) : null;
    return {key,kind,title,image,href,...(quote ? {price:quote.total,currency:quote.currency}: {})};
  }) };
}

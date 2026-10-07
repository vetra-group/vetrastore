import { articleLocaleReady, productLocaleReady } from "@/lib/cms/localization";
import type { CmsContent } from "@/lib/cms/types";
import { HONEY_ID } from "@/lib/catalog";
import { localizedPath, type Locale } from "@/lib/i18n";
import { listingPath, listingQuery, paginate, requestedPage, type ListingSearchParams } from "./listing";

export type SearchResult = { key: string; kind: "product" | "article"; title: string; description: string; href: string; image: string; score: number };
export type SearchGuidance = { suggestions: string[]; nearby: SearchResult[]; otherTypeCount: number; hasRelatedSuggestions: boolean };

import { normalizeSearch as normalize } from "./search-normalize";

export function searchStore(content: CmsContent, locale: Locale, query: string, kind = "all"): SearchResult[] {
  const terms = normalize(query.slice(0, 200)).split(" ").filter(Boolean).slice(0, 12);
  if (!terms.length) return [];
  const score = (title: string, rest: string) => {
    const titleText = normalize(title), allText = normalize(`${title} ${rest}`);
    return terms.every((term) => allText.includes(term)) ? terms.reduce((sum, term) => sum + (titleText.includes(term) ? 4 : 1), 0) : 0;
  };
  const products: SearchResult[] = kind === "article" ? [] : content.products.filter((product) => product.status === "published" && productLocaleReady(product, locale)).map((product) => ({ key: `product-${product.id}`, kind: "product", title: `${product.brand} ${product.name[locale]}`, description: product.description[locale], image: product.image, href: localizedPath(locale, product.id === HONEY_ID ? "/coffee-blossom-honey" : `/products/${product.slug}`), score: score(`${product.brand} ${product.name[locale]}`, `${product.description[locale]} ${product.searchTerms.join(" ")}`) }));
  const articles: SearchResult[] = kind === "product" ? [] : content.articles.filter((article) => article.status === "published" && articleLocaleReady(article, locale)).map((article) => {
    const copy = article.content[locale];
    const sections = copy.sections.map((section) => [section.title, section.text, ...(section.bullets ?? []), ...(section.links?.map((link) => link.label) ?? []), section.image?.caption ?? "", ...(section.table?.headers ?? []), ...(section.table?.rows.flat() ?? [])].join(" ")).join(" ");
    return { key: `article-${article.slug}`, kind: "article", title: copy.title, description: copy.excerpt, image: article.image, href: localizedPath(locale, `/blog/${article.slug}`), score: score(copy.title, `${copy.category} ${copy.excerpt} ${copy.intro} ${sections} ${copy.references?.map((reference) => reference.label).join(" ") ?? ""}`) };
  });
  return [...products, ...articles].filter((result) => result.score > 0).sort((a, b) => b.score - a.score);
}

export const SEARCH_PAGE_SIZE = 12;
export function searchListing(content: CmsContent, locale: Locale, input: ListingSearchParams = {}) {
  const q = listingQuery(input.q);
  const kind = input.type === "product" || input.type === "products" ? "product" : input.type === "article" || input.type === "articles" ? "article" : "all";
  return { ...paginate(searchStore(content, locale, q, kind), requestedPage(input.page), SEARCH_PAGE_SIZE), q, kind };
}

export function searchListingPath(q: string, kind: string, page = 1) { return listingPath("/search", { q, type: kind === "all" ? "" : kind }, page); }

function editDistance(left: string, right: string) {
  const a = Array.from(left), b = Array.from(right);
  let previous = b.map((_, index) => index + 1); previous.unshift(0);
  for (let row = 0; row < a.length; row++) {
    const next = [row + 1];
    for (let column = 0; column < b.length; column++) next.push(Math.min(next[column] + 1, previous[column + 1] + 1, previous[column] + Number(a[row] !== b[column])));
    previous = next;
  }
  return previous[b.length];
}

/** Suggestions come only from currently published content. They do not turn
 * partial or spelling matches into exact results or claim search popularity. */
export function searchGuidance(content: CmsContent, locale: Locale, query: string, kind = "all"): SearchGuidance {
  const clean = normalize(query.slice(0, 200));
  const products = kind === "article" ? [] : content.products.filter((product) => product.status === "published" && productLocaleReady(product, locale));
  const articles = kind === "product" ? [] : content.articles.filter((article) => article.status === "published" && articleLocaleReady(article, locale));
  const startingPoints = [...products.map((product) => product.name[locale]), ...articles.map((article) => article.content[locale].category)];
  const unique = (values: string[]) => [...new Map(values.filter((value) => value.trim()).map((value) => [normalize(value), value])).values()];
  const related: string[] = [];
  const terms = clean.split(" ").filter((term) => term.length >= 2).slice(0, 12);
  if (terms.length > 1) for (const term of terms) if (term !== clean && searchStore(content, locale, term, kind).length) related.push(term);
  if (clean.length >= 4 && clean.length <= 40 && terms.length === 1) {
    const segmenter = new Intl.Segmenter(locale, { granularity: "word" });
    const candidates = unique([...products.flatMap((product) => [product.brand, product.name[locale]]), ...articles.flatMap((article) => [article.content[locale].category, article.content[locale].title])].flatMap((value) => Array.from(segmenter.segment(value)).filter((part) => part.isWordLike && part.segment.length >= 4 && part.segment.length <= 40).map((part) => part.segment))).slice(0, 256);
    const alternatives = candidates.map((candidate) => ({ candidate, distance: editDistance(clean, normalize(candidate)) })).filter(({ distance }) => distance > 0 && distance <= (clean.length >= 9 ? 2 : 1)).sort((a, b) => a.distance - b.distance);
    for (const { candidate } of alternatives.slice(0, 4)) if (searchStore(content, locale, candidate, kind).length) related.push(candidate);
  }
  const hasRelatedSuggestions = related.length > 0;
  const suggestions = unique(hasRelatedSuggestions ? related : startingPoints).filter((value) => normalize(value) !== clean).slice(0, 6);
  const nearby = hasRelatedSuggestions ? [...new Map(suggestions.flatMap((suggestion) => searchStore(content, locale, suggestion, kind)).map((result) => [result.key, result])).values()].slice(0, 3) : [];
  return { suggestions, nearby, otherTypeCount: clean && kind !== "all" ? searchStore(content, locale, clean).length : 0, hasRelatedSuggestions };
}

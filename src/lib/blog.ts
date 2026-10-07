import { articleLocaleReady } from "@/lib/cms/localization";
import type { JournalArticle } from "@/content/editorial";
import type { Locale } from "@/lib/i18n";
import type { CmsArticle } from "@/lib/cms/types";
import { listingPath, listingQuery, paginate, requestedPage, type ListingSearchParams } from "./listing";

export const BLOG_PAGE_SIZE = 6;
export type BlogCategory = { key: string; label: string; count: number };
import { normalizeSearch as normalize } from "./search-normalize";

/** Use the shared English category as the URL key so switching locale keeps
 * the same category. Display labels still come from the selected language. */
export function blogListing(articles: CmsArticle[], locale: Locale, input: ListingSearchParams = {}) {
  const published = articles.filter((article) => article.status === "published" && articleLocaleReady(article, locale));
  const categories = new Map<string, BlogCategory>();
  for (const article of published) {
    const key = normalize(article.content.en.category), previous = categories.get(key);
    categories.set(key, { key, label: article.content[locale].category, count: (previous?.count ?? 0) + 1 });
  }
  const q = listingQuery(input.q), requestedCategory = listingQuery(input.category, 160);
  const matchingCategory = published.find((article) => Object.values(article.content).map((copy) => copy.category).some((label) => normalize(label) === normalize(requestedCategory)));
  const category = matchingCategory ? normalize(matchingCategory.content.en.category) : normalize(requestedCategory);
  const terms = normalize(q).split(" ").filter(Boolean).slice(0, 12);
  const filtered = published.filter((article) => {
    const copy = article.content[locale], text = normalize(`${copy.title} ${copy.excerpt} ${copy.category} ${copy.intro}`);
    return (!category || normalize(article.content.en.category) === category) && terms.every((term) => text.includes(term));
  });
  return { ...paginate(filtered, requestedPage(input.page), BLOG_PAGE_SIZE), q, category, categories: [...categories.values()] };
}

export function blogListingPath(q: string, category: string, page = 1) { return listingPath("/blog", { q, category }, page); }

export type BlogCardData = {
  slug: string;
  image: string;
  imagePosition?: string;
  imageFit: "contain" | "cover";
  title: string;
  excerpt: string;
  category: string;
  readingTime: string;
};

export function articleCard(article: JournalArticle, locale: Locale, minutesLabel: string): BlogCardData {
  const copy = article.content[locale];
  const text = [copy.intro, ...copy.sections.map((section) => [section.title, section.text, ...(section.bullets ?? []), ...(section.table?.headers ?? []), ...(section.table?.rows.flat() ?? [])].join(" "))].join(" ");
  const words = Array.from(new Intl.Segmenter(locale, { granularity: "word" }).segment(text)).filter((part) => part.isWordLike).length;
  const minutes = Math.max(1, Math.ceil(words / (locale === "th" ? 180 : 220)));
  return {
    slug: article.slug,
    image: article.image,
    imagePosition: article.imagePosition,
    imageFit: /\/(?:honey-back\.jpg|honey-front\.jpg|honey-product\.png)$/.test(article.image.split("?")[0]) ? "contain" : "cover",
    title: copy.title,
    excerpt: copy.excerpt,
    category: copy.category,
    readingTime: minutesLabel.replace("{minutes}", new Intl.NumberFormat(locale).format(minutes)),
  };
}

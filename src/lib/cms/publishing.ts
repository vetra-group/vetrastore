import type { CmsArticle, CmsChange, CmsContent, CmsProduct, CmsPublishSelection, CmsState } from "./types";
import { locales } from "@/lib/i18n";
import { defaultCopy } from "./defaults";
import { articleLocaleReady, productLocaleReady, slideLocaleReady, untranslatedCopyKeys } from "./localization";
import { CmsError, referencedMedia, validateCmsContent } from "./validation";

export function articleIdentity(article: CmsArticle): string { return article.id || article.slug; }
export function publicArticle(article: CmsArticle): CmsArticle {
  const result = { ...article }; delete result.editorialNotes; delete result.reviewRequired; return result;
}
export function assertPublicationReady(content: CmsContent) {
  const incomplete = locales.some((locale) => content.products.some((item) => item.status === "published" && !productLocaleReady(item, locale)) || content.articles.some((item) => item.status === "published" && !articleLocaleReady(item, locale)) || content.slides.some((item) => item.enabled && !slideLocaleReady(item, locale)));
  if (incomplete || untranslatedCopyKeys(content, defaultCopy).length || Object.values(content.settings.business ?? {}).some((item) => item?.confirmed && locales.some((locale) => Object.values(item.content[locale]).some((value) => !value.trim())))) throw new CmsError("Complete the English, Arabic and Thai translations before publishing. Save your draft to continue later.", 409, "TRANSLATION_REQUIRED");
  if (content.articles.some((article) => article.status === "published" && article.reviewRequired)) throw new CmsError("Review the marked article facts before publishing. Save it as a draft until the review is complete.", 409, "EDITORIAL_REVIEW_REQUIRED");
  if (content.articles.filter((article) => article.status === "published" && article.featured).length > 1) throw new CmsError("Choose one featured published article.", 409, "FEATURED_ARTICLE_CONFLICT");
}

/** Legacy content receives a stable identity on read without rewriting storage. */
export function normalizeCmsIdentities(state: CmsState): CmsState {
  for (const content of [state.draft, state.published]) for (const article of content.articles) article.id ||= article.slug;
  for (const entry of state.trash) if (entry.kind === "article") entry.item.id ||= entry.item.slug;
  return state;
}

export function preserveCmsRoutes(content: CmsContent, state: CmsState, restoring = false): CmsContent {
  const next = structuredClone(content);
  const articles = [...state.draft.articles, ...state.published.articles, ...state.trash.filter((entry) => entry.kind === "article").map((entry) => entry.item as CmsArticle)];
  const products = [...state.draft.products, ...state.published.products, ...state.trash.filter((entry) => entry.kind === "product").map((entry) => entry.item as CmsProduct)];
  for (const item of next.articles) item.id ||= articles.find((known) => known.slug === item.slug)?.id || item.slug;
  function retain<T extends CmsArticle | CmsProduct>(items: T[], known: T[], identity: (item: T) => string) {
    for (const item of items) {
      const same = known.filter((entry) => identity(entry) === identity(item));
      const aliases = [...new Set([...same.flatMap((entry) => [...(entry.previousSlugs || []), ...(entry.slug === item.slug ? [] : [entry.slug])]), ...(restoring ? item.previousSlugs || [] : [])])].filter((slug) => slug !== item.slug);
      if (aliases.length > 50) throw new CmsError("This item has reached its 50 previous-route limit. Keep its current route.", 409, "ROUTE_HISTORY_LIMIT");
      if (aliases.length) item.previousSlugs = aliases; else delete item.previousSlugs;
      const routes = [item.slug, ...aliases];
      if (known.some((entry) => identity(entry) !== identity(item) && [entry.slug, ...(entry.previousSlugs || [])].some((slug) => routes.includes(slug)))) throw new CmsError("This route belongs to another saved or trashed item. Choose a different route.", 409, "ROUTE_RESERVED");
    }
  }
  retain(next.articles, articles, articleIdentity);
  retain(next.products, products, (item) => item.id);
  return validateCmsContent(next);
}

function changedDetails(before: unknown, after: unknown, prefix = ""): NonNullable<CmsChange["details"]> {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (!before || !after || typeof before !== "object" || typeof after !== "object" || Array.isArray(before) || Array.isArray(after)) return [{ field: prefix || "content", before: before ?? null, after: after ?? null }];
  const left = before as Record<string, unknown>, right = after as Record<string, unknown>;
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].flatMap((key) => changedDetails(left[key], right[key], prefix ? `${prefix}.${key}` : key));
}

export function cmsChanges(before: CmsContent, after: CmsContent): CmsChange[] {
  const changes: CmsChange[] = [];
  function compare<T>(kind: "article" | "product", old: T[], next: T[], id: (item: T) => string, title: (item: T) => string, key: (item: T) => string) {
    for (const item of next) {
      const previous = old.find((entry) => id(entry) === id(item));
      const details = changedDetails(previous, item), fields = details.map((detail) => detail.field);
      if (fields.length) changes.push({ kind, key: key(item), title: title(item), change: previous ? "updated" : "added", fields, details });
    }
    for (const item of old) if (!next.some((entry) => id(entry) === id(item))) changes.push({ kind, key: key(item), title: title(item), change: "removed", fields: ["content"], details: [{ field: "content", before: item, after: null }] });
  }
  compare("article", before.articles, after.articles, articleIdentity, (item) => item.content.en.title, (item) => item.id || item.slug);
  compare("product", before.products, after.products, (item) => item.id, (item) => item.name.en, (item) => item.id);
  for (const kind of ["slides", "copy", "settings", "media"] as const) {
    const details = changedDetails(before[kind], after[kind]), fields = details.map((detail) => detail.field);
    if (fields.length) changes.push({ kind, key: kind, title: ({ slides: "Homepage slides", copy: "Page copy", settings: "Store settings", media: "Media library" })[kind], change: "updated", fields, details });
  }
  return changes;
}

export function validatePublishSelection(value: unknown): CmsPublishSelection[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.length || value.length > 400) throw new CmsError("Select at least one product or article to publish.");
  const selected = value.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new CmsError("Check the publication selection.");
    const item = value as Record<string, unknown>;
    if (Object.keys(item).some((key) => !["kind", "key"].includes(key)) || !["article", "product"].includes(item.kind as string) || typeof item.key !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(item.key)) throw new CmsError("Check the publication selection.");
    return { kind: item.kind as CmsPublishSelection["kind"], key: item.key };
  });
  if (new Set(selected.map((item) => `${item.kind}:${item.key}`)).size !== selected.length) throw new CmsError("Select each publication item only once.");
  return selected;
}

export function selectedCmsPublication(state: CmsState, selection: CmsPublishSelection[] | undefined): CmsContent {
  if (!selection) return structuredClone(state.draft);
  const result = structuredClone(state.published);
  const selectedFeatured = state.draft.articles.filter((article) => article.featured && article.status === "published" && selection.some((item) => item.kind === "article" && (item.key === articleIdentity(article) || item.key === article.slug)));
  if (selectedFeatured.length > 1) throw new CmsError("Choose one featured published article.", 409, "FEATURED_ARTICLE_CONFLICT");
  if (selectedFeatured.length) for (const article of result.articles) if (article.featured) article.featured = false;
  for (const selected of selection) {
    if (selected.kind === "article") {
      const source = state.draft.articles.find((item) => articleIdentity(item) === selected.key || item.slug === selected.key);
      const old = result.articles.find((item) => articleIdentity(item) === selected.key || item.slug === selected.key);
      if (!source && !old) throw new CmsError("An article selected for publication no longer exists.", 409, "PUBLISH_SELECTION_STALE");
      const id = source ? articleIdentity(source) : articleIdentity(old!);
      const index = result.articles.findIndex((item) => articleIdentity(item) === id);
      if (!source) result.articles.splice(index, 1);
      else if (index >= 0) result.articles[index] = structuredClone(source);
      else result.articles.push(structuredClone(source));
    } else {
      const source = state.draft.products.find((item) => item.id === selected.key), index = result.products.findIndex((item) => item.id === selected.key);
      if (!source && index < 0) throw new CmsError("A product selected for publication no longer exists.", 409, "PUBLISH_SELECTION_STALE");
      if (!source) result.products.splice(index, 1);
      else if (index >= 0) result.products[index] = structuredClone(source);
      else result.products.push(structuredClone(source));
    }
  }
  // Publish only media actually needed by the resulting public records.
  for (const media of state.draft.media) if (referencedMedia(result, media.src) && !result.media.some((item) => item.id === media.id)) result.media.push(structuredClone(media));
  return validateCmsContent(result);
}

export function articleForRoute(content: CmsContent, slug: string): { article: CmsArticle; redirect: boolean } | null {
  const article = content.articles.find((item) => item.status === "published" && (item.slug === slug || item.previousSlugs?.includes(slug)));
  return article ? { article, redirect: article.slug !== slug } : null;
}

export function productForRoute(content: CmsContent, slug: string): { product: CmsProduct; redirect: boolean } | null {
  const product = content.products.find((item) => item.status === "published" && (item.slug === slug || item.previousSlugs?.includes(slug)));
  return product ? { product, redirect: product.slug !== slug } : null;
}

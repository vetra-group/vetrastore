import type { CmsArticle, CmsContent, CmsState } from "./types";
import { CmsError } from "./validation";

export type CmsWorkspaceState = CmsState & { workspace?: { loadedArticleIds: string[]; publishPending: boolean } };
export const articleKey = (article: CmsArticle) => article.id ?? article.slug;
export function workspaceIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 500 || value.some((key) => typeof key !== "string" || !key || key.length > 120) || new Set(value).size !== value.length) throw new CmsError("Check the records loaded in this workspace.");
  return value;
}
function summary(article: CmsArticle): CmsArticle {
  return { ...article, content: { ar: { ...article.content.ar, intro: "", sections: [] }, th: { ...article.content.th, intro: "", sections: [] }, en: { ...article.content.en, intro: "", sections: [] } }, editorialNotes: undefined };
}
export function workspaceState(state: CmsState, loadedArticleIds: string[] = []): CmsWorkspaceState {
  const loaded = new Set(loadedArticleIds);
  const content = (value: CmsContent) => ({ ...value, articles: value.articles.map((article) => loaded.has(articleKey(article)) ? article : summary(article)) });
  return { ...state, draft: content(state.draft), published: content(state.published), workspace: { loadedArticleIds, publishPending: JSON.stringify(state.draft) !== JSON.stringify(state.published) }, trash: state.trash.map((entry) => entry.kind === "article" ? { ...entry, item: summary(entry.item) } : entry) };
}

// The browser must never save the intentionally omitted article bodies. Restore
// those from the authoritative revision; only status/featured can change in a list.
export function hydrateWorkspaceContent(current: CmsContent, submitted: unknown, loadedIds: string[]): CmsContent {
  if (!submitted || typeof submitted !== "object" || Array.isArray(submitted) || !Array.isArray((submitted as CmsContent).articles)) throw new CmsError("Check the workspace content.");
  const content = submitted as CmsContent;
  const loaded = new Set(loadedIds);
  const known = new Map(current.articles.map((article) => [articleKey(article), article]));
  const articles = content.articles.map((article) => {
    if (!article || typeof article !== "object") throw new CmsError("Check the article.");
    const original = known.get(articleKey(article));
    if (!original || loaded.has(articleKey(article))) return article;
    return { ...original, status: article.status, ...(Object.hasOwn(article, "featured") ? { featured: article.featured } : {}) };
  });
  return { ...content, articles };
}

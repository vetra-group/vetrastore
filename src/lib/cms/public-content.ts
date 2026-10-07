import type { CmsContent } from "./types";
import { sellingCopy } from "@/lib/business-settings";
import { publicArticle } from "./publishing";
import { referencedMedia } from "./validation";

export type PublicContent = Pick<CmsContent, "products" | "copy" | "settings">;

// The published snapshot can still contain draft and archived records. Project
// it before passing data to a client component, where props become public.
export function publicContent(content: CmsContent): PublicContent {
  return {
    products: content.products.filter((product) => product.status === "published"),
    copy: sellingCopy(content.settings, content.copy),
    settings: { ...content.settings, ...(content.settings.business ? { business: Object.fromEntries(Object.entries(content.settings.business).filter(([, value]) => value?.confirmed)) } : {}) },
  };
}

/** Server read model: only visible records, confirmed business copy and media
 * referenced by those records. The complete editable snapshot stays private. */
export function publishedContentProjection(content: CmsContent): CmsContent {
  const visible: CmsContent = {
    ...publicContent(content),
    slides: content.slides.filter((slide) => slide.enabled),
    articles: content.articles.filter((article) => article.status === "published").map((article) => ({ ...publicArticle(article), id: article.id || article.slug })),
    media: [],
  };
  visible.media = content.media.filter((media) => referencedMedia(visible, media.src));
  return visible;
}

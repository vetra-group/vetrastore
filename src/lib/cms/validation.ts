import { HONEY_ID } from "@/lib/catalog";
import { defaultCopy, defaultContent } from "./defaults";
import { upgradeLocalized } from "./localization";
import type { CmsArticle, CmsBusinessKey, CmsContent, CmsMedia, CmsProduct, CmsSettings, CmsSlide, CmsState, CmsStatus, CmsTrashEntry } from "./types";

export const CMS_TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const CMS_TRASH_LIMIT = 2000;

export class CmsError extends Error {
  constructor(message: string, public status = 400, public code = "INVALID_CONTENT") { super(message); this.name = "CmsError"; }
}
let seeds: CmsContent | undefined;
const seedContent = () => seeds ??= defaultContent();
const statuses: CmsStatus[] = ["draft", "published", "archived"];
const keyPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const mediaPattern = /^\/api\/cms-media\/([a-f0-9]{64})\.(jpg|png|webp|gif)$/;
function object(value: unknown, label: string, keys: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CmsError(`${label} must be an object.`);
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !keys.includes(key))) throw new CmsError(`${label} has an unsupported field.`);
  return record;
}
function text(value: unknown, label: string, max: number, empty = false): string {
  if (typeof value !== "string" || value.length > max || (!empty && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new CmsError(`Check ${label}.`);
  return value;
}
function integer(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new CmsError(`Check ${label}.`);
  return value;
}
function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new CmsError(`Check ${label}.`);
  return value;
}
function localized(value: unknown, label: string, max: number, empty = false) {
  const record = object(upgradeLocalized(value), label, ["en", "ar", "th"]);
  return { ar: text(record.ar, `${label} (Arabic)`, max, true), th: text(record.th, `${label} (Thai)`, max, empty), en: text(record.en, `${label} (English)`, max, empty) };
}
function list(value: unknown, label: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new CmsError(`Check ${label}.`);
  return value;
}
function key(value: unknown, label: string, slug = false) {
  const result = text(value, label, 80);
  if (!(slug ? slugPattern : keyPattern).test(result)) throw new CmsError(`${label} must use letters, numbers and hyphens.`);
  return result;
}
function status(value: unknown): CmsStatus {
  if (!statuses.includes(value as CmsStatus)) throw new CmsError("Check publication status.");
  return value as CmsStatus;
}
function unique(values: string[], label: string) {
  if (new Set(values).size !== values.length) throw new CmsError(`${label} must be unique.`);
}
function previousSlugs(value: unknown) {
  if (value === undefined) return {};
  const slugs = list(value, "previous routes", 50).map((entry) => key(entry, "previous route", true)); unique(slugs, "Previous routes");
  return { previousSlugs: slugs };
}
function links(value: unknown, label: string) {
  return list(value, label, 30).map((value) => { const item = object(value, label, ["label", "href"]); return { label: text(item.label, "link label", 300), href: validLink(item.href) }; });
}
function date(value: unknown, label: string) {
  const result = text(value, label, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result)) || new Date(result).toISOString().slice(0, 10) !== result) throw new CmsError(`Check ${label}.`);
  return result;
}
export function validImageSource(value: unknown): string {
  const src = text(value, "image URL", 1200);
  if (/^\/images\/[a-zA-Z0-9_/-]+\.(?:jpg|jpeg|png|webp|gif)$/i.test(src) && !src.includes("..")) return src;
  if (mediaPattern.test(src)) return src;
  try {
    const url = new URL(src);
    if (url.protocol === "https:" && url.hostname === "res.cloudinary.com" && !url.username && !url.password && !url.port && !url.hash && /^\/[a-zA-Z0-9_-]+\/image\/upload\//.test(url.pathname)) return src;
  } catch { /* Invalid URL is reported below. */ }
  throw new CmsError("Choose a local image or a Cloudinary image URL.");
}
export function validLink(value: unknown): string {
  const link = text(value, "slide destination", 1200);
  if (/^\/(?!\/)/.test(link) && !/[\\\s\u0000-\u001f]/.test(link) && !/%(?:0[0-9a-f]|1[0-9a-f]|7f|5c)/i.test(link)) {
    const parsed = new URL(link, "https://vetra.invalid");
    if (parsed.origin === "https://vetra.invalid") return link;
  }
  try {
    const url = new URL(link);
    if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password && !/[\s\\]/.test(link)) return link;
  } catch { /* Invalid URL is reported below. */ }
  throw new CmsError("Use a site path or an http/https link.");
}
function product(value: unknown): CmsProduct {
  value = upgradeLocalized(value, seedContent().products.find((entry) => entry.id === (value as CmsProduct)?.id));
  const item = object(value, "product", ["id", "slug", "brand", "category", "price", "weight", "image", "searchTerms", "name", "description", "card", "status", "stock", "featured", "previousSlugs", "gallery"]);
  const id = key(item.id, "product ID", true), slug = key(item.slug, "product slug", true);
  if ((id === HONEY_ID || slug === HONEY_ID) && (id !== HONEY_ID || slug !== HONEY_ID)) throw new CmsError("The honey product ID and route must remain unchanged.");
  if (!["honey", "coffee"].includes(item.category as string)) throw new CmsError("Choose a product category.");
  if (typeof item.price !== "number" || !Number.isFinite(item.price) || item.price < 0 || item.price > 10_000_000 || Math.abs(item.price * 100 - Math.round(item.price * 100)) > 0.000001) throw new CmsError("Check product price.");
  const cards = object(item.card, "product card", ["en", "ar", "th"]);
  const card = (value: unknown, locale: string) => {
    const entry = object(value, `product card ${locale}`, ["captionPrefix", "imageAlt", "cta"]);
    return { captionPrefix: text(entry.captionPrefix, "card caption", 300, locale === "Arabic"), imageAlt: text(entry.imageAlt, "image description", 500, locale === "Arabic"), cta: text(entry.cta, "button label", 100, locale === "Arabic") };
  };
  const gallery = item.gallery === undefined ? undefined : list(item.gallery, "product gallery", 30).map((value) => { const image = object(value, "gallery image", ["id", "src", "alt", "caption"]); return { id: key(image.id, "gallery image ID"), src: validImageSource(image.src), alt: localized(image.alt, "gallery image description", 500), ...(image.caption === undefined ? {} : { caption: localized(image.caption, "gallery caption", 1000, true) }) }; });
  if (gallery) unique(gallery.map((item) => item.id), "Gallery image IDs");
  return { id, slug, brand: text(item.brand, "brand", 100), category: item.category as CmsProduct["category"], price: item.price, weight: integer(item.weight, "weight", 1, 1_000_000), image: validImageSource(item.image), searchTerms: list(item.searchTerms, "search terms", 30).map((entry) => text(entry, "search term", 100)), name: localized(item.name, "product name", 200), description: localized(item.description, "product description", 6000), card: { en: card(cards.en, "English"), ar: card(cards.ar, "Arabic"), th: card(cards.th, "Thai") }, status: status(item.status), stock: item.stock === null ? null : integer(item.stock, "stock", 0, 1_000_000), featured: boolean(item.featured, "featured product"), ...previousSlugs(item.previousSlugs), ...(gallery ? { gallery } : {}) };
}
function slide(value: unknown): CmsSlide {
  let seed = seedContent().slides.find((entry) => entry.key === (value as CmsSlide)?.key);
  // This exact bilingual label shipped with the original VETRA story slide.
  // Preserve its saved text while supplying the corresponding Arabic label.
  const label = (value as CmsSlide)?.linkLabel;
  if (seed?.key === "coffeeLandscape" && label?.en === "Read the VETRA story" && label?.th === "อ่านเรื่องราวของ VETRA") {
    seed = { ...seed, linkLabel: { en: "Read the VETRA story", ar: "تعرّف على قصة VETRA", th: "อ่านเรื่องราวของ VETRA" } };
  }
  value = upgradeLocalized(value, seed);
  const item = object(value, "slide", ["key", "src", "path", "alt", "linkLabel", "enabled"]);
  return { key: key(item.key, "slide key"), src: validImageSource(item.src), path: validLink(item.path), alt: localized(item.alt, "image description", 500), linkLabel: localized(item.linkLabel, "link label", 200), enabled: boolean(item.enabled, "slide enabled") };
}
function article(value: unknown): CmsArticle {
  value = upgradeLocalized(value, seedContent().articles.find((entry) => entry.slug === (value as CmsArticle)?.slug));
  const item = object(value, "article", ["slug", "image", "imagePosition", "content", "status", "id", "previousSlugs", "featured", "publishedAt", "updatedAt", "relatedProductIds", "reviewRequired", "editorialNotes"]);
  const copies = object(item.content, "article copy", ["en", "ar", "th"]);
  const copy = (value: unknown, locale: string) => {
    const entry = object(value, `article ${locale}`, ["category", "title", "excerpt", "intro", "sections", "seoTitle", "seoDescription", "imageAlt", "socialImage", "author", "references"]);
    return { category: text(entry.category, "article category", 100, locale === "Arabic"), title: text(entry.title, "article title", 300, locale === "Arabic"), excerpt: text(entry.excerpt, "article excerpt", 2000, locale === "Arabic"), intro: text(entry.intro, "article introduction", 10000, locale === "Arabic"),
      ...(entry.seoTitle === undefined ? {} : { seoTitle: text(entry.seoTitle, "SEO title", 300, true) }), ...(entry.seoDescription === undefined ? {} : { seoDescription: text(entry.seoDescription, "SEO description", 1000, true) }), ...(entry.imageAlt === undefined ? {} : { imageAlt: text(entry.imageAlt, "cover image description", 500, true) }), ...(entry.author === undefined ? {} : { author: text(entry.author, "author", 200, true) }), ...(entry.socialImage ? { socialImage: validImageSource(entry.socialImage) } : {}), ...(entry.references === undefined ? {} : { references: links(entry.references, "article references") }),
      sections: list(entry.sections, "article sections", 50).map((value) => {
        const section = object(value, "article section", ["title", "text", "bullets", "links", "image", "table"]);
        const image = section.image === undefined ? undefined : object(section.image, "section image", ["src", "alt", "caption"]);
        const table = section.table === undefined ? undefined : object(section.table, "section table", ["headers", "rows"]);
        const headers = table ? list(table.headers, "table headers", 8).map((value) => text(value, "table heading", 200)) : [];
        if (table && headers.length < 2) throw new CmsError("Use at least two table columns.");
        const rows = table ? list(table.rows, "table rows", 30).map((value) => { const row = list(value, "table row", 8).map((value) => text(value, "table cell", 2000, true)); if (row.length !== headers.length) throw new CmsError("Every table row must match its headings."); return row; }) : [];
        return { title: text(section.title, "section heading", 300), text: text(section.text, "section text", 12000, true), ...(section.bullets === undefined ? {} : { bullets: list(section.bullets, "section list", 30).map((value) => text(value, "list item", 2000)) }), ...(section.links === undefined ? {} : { links: links(section.links, "section links") }), ...(image ? { image: { src: validImageSource(image.src), alt: text(image.alt, "section image description", 500), ...(image.caption === undefined ? {} : { caption: text(image.caption, "section image caption", 1000, true) }) } } : {}), ...(table ? { table: { headers, rows } } : {}) };
      }) };
  };
  const imagePosition = item.imagePosition === undefined ? undefined : text(item.imagePosition, "image position", 40);
  if (imagePosition && !/^(?:center|top|bottom|left|right|\d{1,3}%)(?: (?:center|top|bottom|left|right|\d{1,3}%))?$/.test(imagePosition)) throw new CmsError("Check article image position.");
  return { slug: key(item.slug, "article slug", true), image: validImageSource(item.image), ...(imagePosition ? { imagePosition } : {}), content: { en: copy(copies.en, "English"), ar: copy(copies.ar, "Arabic"), th: copy(copies.th, "Thai") }, status: status(item.status), ...(item.id === undefined ? {} : { id: key(item.id, "article ID") }), ...previousSlugs(item.previousSlugs), ...(item.featured === undefined ? {} : { featured: boolean(item.featured, "featured article") }), ...(item.publishedAt ? { publishedAt: date(item.publishedAt, "publication date") } : {}), ...(item.updatedAt ? { updatedAt: date(item.updatedAt, "update date") } : {}), ...(item.relatedProductIds === undefined ? {} : { relatedProductIds: list(item.relatedProductIds, "related products", 10).map((value) => key(value, "related product ID", true)) }), ...(item.reviewRequired === undefined ? {} : { reviewRequired: boolean(item.reviewRequired, "facts require review") }), ...(item.editorialNotes === undefined ? {} : { editorialNotes: text(item.editorialNotes, "editorial notes", 5000, true) }) };
}
export function validateCmsMedia(value: unknown): CmsMedia {
  const item = object(value, "media", ["id", "src", "name", "alt", "width", "height", "bytes", "createdAt"]);
  const src = validImageSource(item.src);
  const match = mediaPattern.exec(src);
  if (!match || item.id !== match[1]) throw new CmsError("Check media identity.");
  const createdAt = text(item.createdAt, "media date", 30);
  if (!Number.isFinite(Date.parse(createdAt))) throw new CmsError("Check media date.");
  return { id: match[1], src, name: text(item.name, "media name", 200), alt: localized(item.alt, "image description", 500), width: integer(item.width, "image width", 1, 20000), height: integer(item.height, "image height", 1, 20000), bytes: integer(item.bytes, "image bytes", 1, 5 * 1024 * 1024), createdAt };
}
export function validateCmsContent(value: unknown, options: { requireHoney?: boolean } = {}): CmsContent {
  const record = object(value, "content", ["products", "slides", "articles", "copy", "media", "settings"]);
  const products = list(record.products, "products", 200).map(product);
  if (options.requireHoney !== false && !products.some((entry) => entry.id === HONEY_ID)) throw new CmsError("Keep the honey product; archive it to hide it.");
  unique(products.map((entry) => entry.id), "Product IDs"); unique(products.map((entry) => entry.slug), "Product routes");
  const slides = list(record.slides, "slides", 100).map(slide); unique(slides.map((entry) => entry.key), "Slide keys");
  const articles = list(record.articles, "articles", 200).map(article); unique(articles.map((entry) => entry.slug), "Article routes");
  unique(articles.filter((entry) => entry.id).map((entry) => entry.id!), "Article IDs");
  unique(articles.flatMap((entry) => [entry.slug, ...(entry.previousSlugs || []).filter((slug) => slug !== entry.slug)]), "Article routes and previous routes");
  unique(products.flatMap((entry) => [entry.slug, ...(entry.previousSlugs || []).filter((slug) => slug !== entry.slug)]), "Product routes and previous routes");
  const media = list(record.media, "media", 1000).map(validateCmsMedia); unique(media.map((entry) => entry.id), "Media IDs");
  const rawCopy = object(record.copy, "copy", Object.keys(defaultCopy));
  const copy: Record<string, string> = {};
  for (const [path, value] of Object.entries(rawCopy)) copy[path] = text(value, `copy ${path}`, 12000, true);
  const settings = object(record.settings, "settings", ["storeName", "email", "phone", "address", "currency", "business"]);
  const email = text(settings.email, "email", 254, true);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CmsError("Check store email.");
  if (settings.currency !== "THB") throw new CmsError("Store currency must remain THB.");
  const business: CmsSettings["business"] = settings.business === undefined ? undefined : {};
  if (business) for (const [key, value] of Object.entries(object(settings.business, "business settings", ["stock", "shipping", "returns", "wholesale", "batch"]))) {
    const detail = object(value, "business detail", ["confirmed", "content"]), content = object(upgradeLocalized(detail.content), "business detail content", ["en", "ar", "th"]);
    const copy = (value: unknown, empty = false) => { const item = object(value, "business detail copy", ["title", "summary", "description"]); return { title: text(item.title, "detail title", 200, empty), summary: text(item.summary, "detail summary", 500, empty), description: text(item.description, "detail description", 5000, empty) }; };
    business[key as CmsBusinessKey] = { confirmed: boolean(detail.confirmed, "business detail confirmed"), content: { en: copy(content.en), ar: copy(content.ar, true), th: copy(content.th) } };
  }
  return { products, slides, articles, copy, media, settings: { storeName: text(settings.storeName, "store name", 100), email, phone: text(settings.phone, "phone", 40, true), address: localized(settings.address, "address", 1000, true), currency: "THB", ...(business ? { business } : {}) } };
}
export function cmsImageSources(content: CmsContent): string[] {
  return [...content.products.flatMap((item) => [item.image, ...(item.gallery || []).map((image) => image.src)]), ...content.slides.map((item) => item.src), ...content.articles.flatMap((item) => [item.image, ...Object.values(item.content).flatMap((copy) => [copy.socialImage, ...copy.sections.map((section) => section.image?.src)].filter((src): src is string => Boolean(src)))])];
}
export function referencedMedia(content: CmsContent, src: string): boolean {
  return cmsImageSources(content).includes(src) || Object.values(content.copy).some((text) => text.includes(src));
}
export function validateCmsState(value: unknown): CmsState {
  const record = object(value, "CMS snapshot", ["version", "revision", "draft", "published", "publishedAt", "audit", "trash"]);
  if (record.version !== 1) throw new CmsError("Unsupported CMS snapshot version.");
  const publishedAt = record.publishedAt === null ? null : text(record.publishedAt, "publish date", 30);
  if (publishedAt && !Number.isFinite(Date.parse(publishedAt))) throw new CmsError("Check publish date.");
  const trash = record.trash === undefined ? [] : list(record.trash, "trash", CMS_TRASH_LIMIT).map(validateCmsTrashEntry);
  unique(trash.map((entry) => entry.id), "Trash IDs");
  return { version: 1, revision: integer(record.revision, "revision", 0, Number.MAX_SAFE_INTEGER), draft: validateCmsContent(record.draft), published: validateCmsContent(record.published), publishedAt, audit: list(record.audit, "activity", 500).map((value) => { const entry = object(value, "activity entry", ["id", "action", "at", "actor"]); const at = text(entry.at, "activity date", 30); if (!Number.isFinite(Date.parse(at))) throw new CmsError("Check activity date."); return { id: text(entry.id, "activity ID", 100), action: text(entry.action, "activity action", 100), at, actor: text(entry.actor, "activity actor", 100) }; }), trash };
}
export function validateCmsTrashEntry(value: unknown): CmsTrashEntry {
  const record = object(value, "trash entry", ["id", "deletedAt", "expiresAt", "position", "kind", "item"]);
  const id = text(record.id, "trash ID", 36);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)) throw new CmsError("Check trash identity.");
  const deletedAt = text(record.deletedAt, "deletion date", 30), expiresAt = text(record.expiresAt, "expiry date", 30);
  const deletedTime = Date.parse(deletedAt), expiryTime = Date.parse(expiresAt);
  if (!Number.isFinite(deletedTime) || !Number.isFinite(expiryTime) || expiryTime - deletedTime !== CMS_TRASH_TTL_MS) throw new CmsError("Trash is retained for exactly 30 days.");
  const metadata = { id, deletedAt, expiresAt, position: integer(record.position, "original position", 0, 1000) };
  if (record.kind === "product") { const item = product(record.item); if (item.id === HONEY_ID) throw new CmsError("The honey product cannot be moved to trash."); return { ...metadata, kind: "product", item }; }
  if (record.kind === "slide") return { ...metadata, kind: "slide", item: slide(record.item) };
  if (record.kind === "article") return { ...metadata, kind: "article", item: article(record.item) };
  if (record.kind === "media") return { ...metadata, kind: "media", item: validateCmsMedia(record.item) };
  throw new CmsError("Choose a supported trash type.");
}
export function validateRevision(value: unknown): number { return integer(value, "revision", 0, Number.MAX_SAFE_INTEGER); }

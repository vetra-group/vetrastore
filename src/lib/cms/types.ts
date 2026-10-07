import type { CatalogProduct } from "@/lib/catalog";
import type { Localized } from "@/lib/i18n";
import type { JournalArticle } from "@/content/editorial";

export type CmsStatus = "draft" | "published" | "archived";
export type CmsProduct = CatalogProduct & { status: CmsStatus; stock: number | null; featured: boolean };
export type CmsSlide = { key: string; src: string; path: string; alt: Localized<string>; linkLabel: Localized<string>; enabled: boolean };
export type CmsArticle = JournalArticle & { status: CmsStatus; reviewRequired?: boolean; editorialNotes?: string };
export type CmsMedia = { id: string; src: string; name: string; alt: Localized<string>; width: number; height: number; bytes: number; createdAt: string };
export type CmsBusinessKey = "stock" | "shipping" | "returns" | "wholesale" | "batch";
export type CmsBusinessDetail = { confirmed: boolean; content: Localized<{ title: string; summary: string; description: string }> };
export type CmsSettings = { storeName: string; email: string; phone: string; address: Localized<string>; currency: "THB"; business?: Partial<Record<CmsBusinessKey, CmsBusinessDetail>> };
export type CmsContent = { products: CmsProduct[]; slides: CmsSlide[]; articles: CmsArticle[]; copy: Record<string, string>; media: CmsMedia[]; settings: CmsSettings };
export type CmsAudit = { id: string; action: string; at: string; actor: string };
export type CmsTrashKind = "product" | "slide" | "article" | "media";
type CmsTrashMetadata = { id: string; deletedAt: string; expiresAt: string; position: number };
export type CmsTrashEntry = CmsTrashMetadata & (
  { kind: "product"; item: CmsProduct } | { kind: "slide"; item: CmsSlide } |
  { kind: "article"; item: CmsArticle } | { kind: "media"; item: CmsMedia }
);
export type CmsState = { version: 1; revision: number; draft: CmsContent; published: CmsContent; publishedAt: string | null; audit: CmsAudit[]; trash: CmsTrashEntry[] };
export type CmsView = "overview" | "products" | "slides" | "content" | "journal" | "media" | "orders" | "messages" | "customers" | "notifications" | "trash" | "settings" | "activity";
export const cmsViews: CmsView[] = ["overview", "products", "slides", "content", "journal", "media", "orders", "messages", "customers", "notifications", "trash", "settings", "activity"];
export type CmsPublishSelection = { kind: "article" | "product"; key: string };
export type CmsChange = { kind: "article" | "product" | "slides" | "copy" | "settings" | "media"; key: string; title: string; change: "added" | "updated" | "removed"; fields: string[]; details?: { field: string; before: unknown; after: unknown }[] };
export type CmsHistorySummary = { id: string; revision: number; at: string; action: string };
export type CmsHistoryEntry = CmsHistorySummary & { draft: CmsContent; published: CmsContent };

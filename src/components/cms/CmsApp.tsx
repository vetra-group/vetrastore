"use client";

import { cmsAuditLabel } from "@/lib/cms/labels";
import { cmsArabicUi } from "@/content/cms-ar-ui";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Activity, AlertTriangle, Archive, ArrowLeft, Bell, BookOpen, Check, ChevronRight,
  CloudUpload, ExternalLink, FileText, FolderOpen, GalleryHorizontalEnd, Globe,
  Inbox, LayoutDashboard, LoaderCircle, LogOut, Menu, MoveDown, MoveUp, Search,
  Package, Pencil, Plus, RefreshCw, Save,
  Settings2, ShoppingBag, Trash2, Undo2, Upload, Users, X,
} from "lucide-react";
import { cmsCopy } from "@/content/cms";
import { operationsCopy } from "@/content/cms-operations";
import { formatPrice, HONEY_ID, quoteProduct } from "@/lib/catalog";
import type { CmsArticle, CmsContent, CmsProduct, CmsSlide, CmsState, CmsStatus, CmsTrashKind, CmsView } from "@/lib/cms/types";
import { cmsViews } from "@/lib/cms/types";
import { validateCmsContent } from "@/lib/cms/validation";
import { locales, localeSettings, languageConfig, localizedPath, type Locale } from "@/lib/i18n";
import { Field } from "./CmsField";
import { CmsDialog } from "./CmsDialog";
import CmsSignIn from "./CmsSignIn";
import { createProductCaseStudy } from "@/content/case-study-template";
import { useCmsConfirm } from "./CmsConfirm";
import { useCmsRecovery } from "./useCmsRecovery";
import { equalDraft, mergeDraft, type DraftConflict } from "@/lib/cms/draft-merge";
import type { CmsWorkspaceState } from "@/lib/cms/workspace";
import { useDemo } from "@/components/demo/DemoProvider";
import LoadingScreen from "@/components/loading/LoadingScreen";
import NavigationProgress from "@/components/loading/NavigationProgress";
import styles from "./CmsApp.module.css";
import editorStyles from "./CmsEditor.module.css";

const loading = () => <LoadingScreen variant="panel" layout="form" />;
const ArticleEditor = dynamic(() => import("./CmsArticleEditor").then((module) => module.ArticleEditor), { loading });
const ProductEditor = dynamic(() => import("./CmsEditors").then((module) => module.ProductEditor), { loading });
const SlideEditor = dynamic(() => import("./CmsEditors").then((module) => module.SlideEditor), { loading });
const CopyEditor = dynamic(() => import("./CmsEditors").then((module) => module.CopyEditor), { loading });
const CmsPublishing = dynamic(() => import("./CmsPublishing").then((module) => module.CmsPublishing), { loading });
const CmsHistory = dynamic(() => import("./CmsHistory").then((module) => module.CmsHistory), { loading });
const CmsBackupTools = dynamic(() => import("./CmsBackupTools").then((module) => module.CmsBackupTools), { loading });
const CmsMedia = dynamic(() => import("./CmsMedia").then((module) => module.CmsMedia), { loading });
const CmsOperations = dynamic(() => import("./CmsOperations").then((module) => module.CmsOperations), { loading });
const CmsTrash = dynamic(() => import("./CmsTrash").then((module) => module.CmsTrash), { loading });
const CmsBusinessSettings = dynamic(() => import("./CmsBusinessSettings"), { loading });
const CmsReadiness = dynamic(() => import("./CmsReadiness"), { loading });
const CmsConflictReview = dynamic(() => import("./CmsConflictReview").then((module) => module.CmsConflictReview), { loading });

const icons = { overview: LayoutDashboard, products: Package, slides: GalleryHorizontalEnd, content: FileText, journal: BookOpen, media: FolderOpen, orders: ShoppingBag, messages: Inbox, customers: Users, notifications: Bell, trash: Trash2, settings: Settings2, activity: Activity };
const groups: { label: "contentGroup" | "businessGroup" | "systemGroup"; views: CmsView[] }[] = [
  { label: "contentGroup", views: ["overview", "products", "slides", "content", "journal", "media"] },
  { label: "businessGroup", views: ["orders", "messages", "customers", "notifications"] },
  { label: "systemGroup", views: ["trash", "settings", "activity"] },
];

function date(value: string | null, locale: Locale) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(localeSettings(locale).intl, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function cmsProductPrice(product: CmsProduct, locale: Locale) {
  const missing = { en: "Price not set", ar: "لم يُحدَّد السعر", th: "ยังไม่กำหนดราคา" };
  if ((product.pricing?.THB[0]?.total ?? product.price) <= 0) return missing[locale];
  const quote = quoteProduct(product, 1, "TH");
  return formatPrice(quote.total, locale, quote.currency);
}

export default function CmsApp({ locale }: { locale: Locale }) {
  const t = cmsCopy[locale];
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const demo = useDemo();
  const { confirm, confirmation } = useCmsConfirm(locale);
  const [mode, setMode] = useState<"loading" | "local" | "configured" | "unavailable">("loading");
  const [authenticated, setAuthenticated] = useState(false);
  const [identity, setIdentity] = useState<{id: string; name: string; role: "owner" | "editor"} | null>(null);
  const [reviewPublishing, setReviewPublishing] = useState(false);
  const [state, setState] = useState<CmsWorkspaceState | null>(null);
  const [content, setContent] = useState<CmsContent | null>(null);
  const [view, setView] = useState<CmsView>("overview");
  const [drawer, setDrawer] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [conflict, setConflict] = useState(false);
  const [mergeReview, setMergeReview] = useState<{ base: CmsContent; mine: CmsContent; latest: CmsState; conflicts: DraftConflict[] } | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [slideKey, setSlideKey] = useState<string | null>(null);
  const [articleIndex, setArticleIndex] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | CmsStatus>("all");
  const [libraryPage, setLibraryPage] = useState(0);
  const [pendingMedia, setPendingMedia] = useState(false);
  const [operationsDirty, setOperationsDirty] = useState(false);
  const [unsavedEntries, setUnsavedEntries] = useState<{ product: string[]; slide: string[]; article: string[] }>({ product: [], slide: [], article: [] });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusAfterDrawer = useRef(false);
  const dirty = useMemo(() => !!content && !!state && !equalDraft(content, state.draft), [content, state]);
  const publishPending = useMemo(() => !!content && !!state && (!!state.workspace?.publishPending || !equalDraft(content, state.published)), [content, state]);
  const recovery = useCmsRecovery(identity?.id, state?.draft, content, state?.revision, dirty);
  const trashCount = (state?.trash?.length ?? 0) + (demo.trash?.length ?? 0);
  const notify = (text: string, error = false) => setMessage({ text, error });
  const trashSafety = useRef<{ state: CmsState | null; dirty: boolean; pendingMedia: boolean; operationsDirty: boolean; busy: string | null }>({ state: null, dirty: false, pendingMedia: false, operationsDirty: false, busy: null });
  const adopt = (next: CmsWorkspaceState) => { setState(next); setContent(structuredClone(next.draft)); setConflict(false); setUnsavedEntries({ product: [], slide: [], article: [] }); };
  // Update refresh guards in the same commit as visible edits, before painting.
  useLayoutEffect(() => { trashSafety.current = { state, dirty, pendingMedia, operationsDirty, busy }; }, [state, dirty, pendingMedia, operationsDirty, busy]);

  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
    const load = async () => {
      try {
        const response = await fetch("/api/cms/session", { cache: "no-store", signal });
        const session = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok) throw new Error("Session unavailable");
        setIdentity(session.identity ?? null);
        setAuthenticated(!!session.authenticated);
        const requestedView = new URLSearchParams(window.location.search).get("view");
        if (cmsViews.includes(requestedView as CmsView)) setView(requestedView as CmsView);
        if (session.authenticated) {
          const cmsResponse = await fetch("/api/cms/workspace", { cache: "no-store", signal });
          const result = await cmsResponse.json();
          if (controller.signal.aborted) return;
          if (!cmsResponse.ok || !result.state) throw new Error("Content unavailable");
          setState(result.state); setContent(structuredClone(result.state.draft));
        }
        setMode(session.mode === "local" ? "local" : session.mode === "configured" ? "configured" : "unavailable");
      } catch { if (!controller.signal.aborted) { setMode("unavailable"); setMessage({ text: cmsCopy[locale].requestError, error: true }); } }
    };
    void load();
    return () => controller.abort();
  }, [locale]);
  useEffect(() => {
    if (!dirty && !pendingMedia && !operationsDirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, pendingMedia, operationsDirty]);
  useEffect(() => {
    if (view !== "trash" || !authenticated) return;
    const controller = new AbortController();
    const refresh = async () => {
      const current = trashSafety.current;
      if (document.visibilityState !== "visible" || document.querySelector("dialog[open]") || current.dirty || current.pendingMedia || current.operationsDirty || current.busy) return;
      try {
        const response = await fetch("/api/cms", { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        const latest = trashSafety.current;
        if (!response.ok || !result.state || controller.signal.aborted || document.querySelector("dialog[open]") || latest.dirty || latest.pendingMedia || latest.operationsDirty || latest.busy || result.state.revision < (latest.state?.revision ?? 0)) return;
        setState(result.state); setContent(structuredClone(result.state.draft));
      } catch { /* Retry quietly on the next focus or refresh. */ }
    };
    const focus = () => { void refresh(); };
    const timer = window.setInterval(focus, 30000);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    void refresh();
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); };
  }, [view, authenticated]);

  const login = async (credentials: { email?: string; password?: string } = {}) => {
    if (busy) return;
    setBusy("login"); setMessage(null);
    const signal = AbortSignal.timeout(15000);
    try {
      const response = await fetch("/api/cms/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", ...credentials }), signal });
      if (!response.ok) throw new Error("Login failed");
      const identityResponse = await fetch("/api/cms/session", { cache: "no-store", signal });
      const session = await identityResponse.json();
      if (!identityResponse.ok || !session.authenticated || !session.identity) throw new Error("Session unavailable");
      setIdentity(session.identity);
      const cmsResponse = await fetch("/api/cms/workspace", { cache: "no-store", signal });
      const result = await cmsResponse.json();
      if (!cmsResponse.ok || !result.state) throw new Error("Content unavailable");
      adopt(result.state); setAuthenticated(true);
    } catch { notify(t.loginError, true); }
    finally { setBusy(null); }
  };
  const logout = async () => {
    if ((dirty || pendingMedia || operationsDirty) && !await confirm({ title: t.logout, body: t.leaveConfirm, label: t.logout, destructive: true })) return;
    setBusy("logout");
    try {
      const response = await fetch("/api/cms/session", { method: "DELETE" });
      if (!response.ok) throw new Error("Logout failed");
      await recovery.clear().catch(() => undefined);
      setAuthenticated(false); setIdentity(null); setState(null); setContent(null); setDrawer(false); setMessage(null);
    } catch { notify(t.requestError, true); }
    finally { setBusy(null); }
  };
  const switchLanguage = async (nextLocale: Locale) => {
    if ((dirty || pendingMedia || operationsDirty) && !await confirm({ title: t.switchLanguage, body: t.leavePageConfirm, label: t.switchLanguage, destructive: true })) return;
    if (nextLocale !== locale) startNavigation(() => router.push(`${localizedPath(nextLocale, "/cms")}?view=${view}`));
  };
  const navigate = async (next: CmsView) => {
    if (busy) return;
    if (operationsDirty && next !== view && !await confirm({ title: operationsCopy[locale].unsavedTitle, body: operationsCopy[locale].discardBody, label: operationsCopy[locale].discard, destructive: true })) return;
    if (pendingMedia && next !== "media" && !await confirm({ title: t.unsaved, body: locale === "ar" ? cmsArabicUi["Your selected image has not been saved. Leave the media library?"] : locale === "th" ? "ภาพที่เลือกยังไม่ได้บันทึก ต้องการออกจากคลังรูปภาพ?" : "Your selected image has not been saved. Leave the media library?", destructive: true })) return;
    focusAfterDrawer.current = drawer;
    setView(next); setDrawer(false); setSearch(""); setStatus("all"); setLibraryPage(0);
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    window.history.replaceState(window.history.state, "", url);
    setProductId(null); setSlideKey(null); setArticleIndex(null);
    if (!drawer) setTimeout(() => headingRef.current?.focus({ preventScroll: true }), 0);
  };
  const save = async (action: "save" | "publish" | "restore") => {
    if (!state || !content || busy) return;
    const form = document.getElementById("cms-editor-form");
    if (action !== "restore" && form instanceof HTMLFormElement) {
      const invalid = form.querySelector(":invalid");
      if (invalid) {
        // Optional rich fields may live inside a collapsed disclosure. Reveal
        // the invalid input before the browser attempts to focus its message.
        for (let parent = invalid.parentElement; parent && parent !== form; parent = parent.parentElement) {
          if (parent instanceof HTMLDetailsElement) parent.open = true;
        }
        form.reportValidity(); notify(t.invalid, true); return;
      }
    }
    if (action !== "restore" && !state.workspace) {
      try { validateCmsContent(content); }
      catch (error) { notify(`${t.invalid} ${validationHint(error instanceof Error ? error.message : "", locale)}`, true); return; }
    }
    
    if (action === "restore" && !await confirm({ title: t.restore, body: t.restoreConfirm, label: t.restore, destructive: true })) return;
    setBusy(action); setMessage(null);
    try {
      const projectedSave = action === "save" && state.workspace;
      const response = await fetch(projectedSave ? "/api/cms/workspace" : "/api/cms", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(projectedSave ? { revision: state.revision, content, loadedArticleIds: state.workspace!.loadedArticleIds } : { revision: state.revision, content, action }) });
      const result = await response.json();
      if (!response.ok || !result.state) { setConflict(result.code === "REVISION_CONFLICT"); notify(result.code === "REVISION_CONFLICT" ? t.conflict : t.saveError, true); return; }
      adopt(result.state); notify(action === "publish" ? t.successPublished : action === "restore" ? t.restored : t.successSaved);
      if (action === "publish") router.refresh();
      return result.state as CmsState;
    } catch { notify(t.requestError, true); }
    finally { setBusy(null); }
  };
  const merge = async () => {
    if (!state || !content || busy) return;
    setBusy("merge");
    try {
      const response = await fetch("/api/cms", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.state) throw new Error("Content unavailable");
      const conflicts: DraftConflict[] = [];
      const merged = mergeDraft(state.draft, content, result.state.draft, conflicts) as CmsContent;
      if (conflicts.length) setMergeReview({ base: state.draft, mine: content, latest: result.state, conflicts });
      else { setState(result.state); setContent(merged); setConflict(false); notify(t.merged); }
    } catch { notify(t.requestError, true); }
    finally { setBusy(null); }
  };
  const reload = async () => {
    if (dirty && !await confirm({ title: t.reload, body: t.reloadConfirm, label: t.reload, destructive: true })) return;
    setBusy("reload");
    try {
      const response = await fetch("/api/cms", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.state) throw new Error("Content unavailable");
      adopt(result.state); setProductId(null); setSlideKey(null); setArticleIndex(null); setMessage(null);
    } catch { notify(t.requestError, true); }
    finally { setBusy(null); }
  };
  const recoverDraft = async () => {
    if (!recovery.candidate || !state) return;
    setBusy("recover");
    try {
      const response = await fetch("/api/cms", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.state) throw new Error("Recovery unavailable");
      const { base, content: mine } = recovery.candidate;
      const latest = result.state as CmsState;
      const conflicts: DraftConflict[] = [];
      const merged = mergeDraft(base, mine, latest.draft, conflicts) as CmsContent;
      if (conflicts.length) setMergeReview({ base, mine, latest, conflicts });
      else {
        setState(latest); setContent(merged);
        setUnsavedEntries({ product: merged.products.filter((entry) => !latest.draft.products.some((item) => item.id === entry.id)).map((entry) => entry.id), slide: merged.slides.filter((entry) => !latest.draft.slides.some((item) => item.key === entry.key)).map((entry) => entry.key), article: merged.articles.filter((entry) => !latest.draft.articles.some((item) => (item.id ?? item.slug) === (entry.id ?? entry.slug))).map((entry) => entry.slug) });
        await recovery.dismiss();
        notify(locale === "ar" ? cmsArabicUi["Work recovered. Review it before saving."] : locale === "th" ? "กู้คืนงานแล้ว ตรวจสอบก่อนบันทึก" : "Work recovered. Review it before saving.");
      }
    } catch { notify(t.requestError, true); }
    finally { setBusy(null); }
  };
  const openArticle = async (article: CmsArticle) => {
    if (!content || !state || busy) return;
    const key = article.id ?? article.slug;
    if (!state.workspace || state.workspace.loadedArticleIds.includes(key) || !state.draft.articles.some((item) => (item.id ?? item.slug) === key)) { setArticleIndex(content.articles.indexOf(article)); return; }
    setBusy("article");
    try {
      const response = await fetch(`/api/cms/workspace?article=${encodeURIComponent(key)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.article) throw new Error("Article unavailable");
      if (result.revision !== state.revision) { setConflict(true); notify(t.conflict, true); return; }
      const replace = (items: CmsArticle[], record: CmsArticle) => items.map((item) => (item.id ?? item.slug) === key ? record : item);
      // Keep metadata edited in the list while adding the deferred body.
      const editing = { ...result.article, status: article.status, ...(Object.hasOwn(article, "featured") ? { featured: article.featured } : {}) } as CmsArticle;
      setContent({ ...content, articles: replace(content.articles, editing) });
      setState({ ...state, workspace: { ...state.workspace, loadedArticleIds: [...state.workspace.loadedArticleIds, key] }, draft: { ...state.draft, articles: replace(state.draft.articles, result.article) }, published: { ...state.published, articles: result.published ? replace(state.published.articles, result.published) : state.published.articles } });
      setArticleIndex(content.articles.indexOf(article));
    } catch { notify(t.requestError, true); }
    finally { setBusy(null); }
  };
  const addProduct = () => {
    if (!content) return;
    const id = `product-${crypto.randomUUID().slice(0, 8)}`;
    const product: CmsProduct = { id, slug: id, brand: "", category: "honey", price: 0, pricing: { THB: [{ quantity: 1, total: 0 }], internationalTHB: [{ quantity: 1, total: 0 }] }, weight: 1, stock: null, featured: false, status: "draft", image: "", searchTerms: [], name: { en: "", ar: "", th: "" }, description: { en: "", ar: "", th: "" }, card: { ar: { captionPrefix: "", imageAlt: "", cta: "" }, th: { captionPrefix: "", imageAlt: "", cta: "" }, en: { captionPrefix: "", imageAlt: "", cta: "" } } };
    setContent({ ...content, products: [...content.products, product] }); setUnsavedEntries((entries) => ({ ...entries, product: [...entries.product, id] })); setView("products"); setProductId(id); setDrawer(false);
  };
  const addSlide = () => {
    if (!content) return;
    const slide: CmsSlide = { key: `slide-${crypto.randomUUID().slice(0, 8)}`, src: "", path: "/", alt: { en: "", ar: "", th: "" }, linkLabel: { en: "", ar: "", th: "" }, enabled: true };
    setContent({ ...content, slides: [...content.slides, slide] }); setUnsavedEntries((entries) => ({ ...entries, slide: [...entries.slide, slide.key] })); setView("slides"); setSlideKey(slide.key); setDrawer(false);
  };
  const addArticle = () => {
    if (!content) return;
    const slug = `article-${crypto.randomUUID().slice(0, 8)}`;
    const copy = { title: "", category: "", excerpt: "", intro: "", sections: [{ title: "", text: "" }] };
    const article: CmsArticle = { id: crypto.randomUUID(), slug, image: "", status: "draft", content: { en: structuredClone(copy), ar: structuredClone(copy), th: structuredClone(copy) } };
    if (state?.workspace) setState({ ...state, workspace: { ...state.workspace, loadedArticleIds: [...state.workspace.loadedArticleIds, article.id!] } });
    setContent({ ...content, articles: [...content.articles, article] }); setUnsavedEntries((entries) => ({ ...entries, article: [...entries.article, slug] })); setView("journal"); setArticleIndex(content.articles.length); setDrawer(false);
  };
  const incompleteUnsaved = (kind: Exclude<CmsTrashKind, "media">, key: string) => {
    if (!state || !content || !unsavedEntries[kind].includes(key)) return false;
    const candidate = structuredClone(state.draft);
    if (state.workspace) candidate.articles = candidate.articles.filter((item) => state.workspace!.loadedArticleIds.includes(item.id ?? item.slug));
    if (kind === "product") {
      if (state.draft.products.some((item) => item.id === key)) return false;
      const item = content.products.find((item) => item.id === key);
      if (!item) return false;
      candidate.products.push(item);
    } else if (kind === "slide") {
      if (state.draft.slides.some((item) => item.key === key)) return false;
      const item = content.slides.find((item) => item.key === key);
      if (!item) return false;
      candidate.slides.push(item);
    } else {
      if (state.draft.articles.some((item) => item.slug === key)) return false;
      const item = content.articles.find((item) => item.slug === key);
      if (!item) return false;
      candidate.articles.push(item);
    }
    try { validateCmsContent(candidate); return false; } catch { return true; }
  };
  const trashItem = async (kind: Exclude<CmsTrashKind, "media">, key: string) => {
    if (!state || !content || busy) return;
    if (incompleteUnsaved(kind, key)) {
      if (!await confirm({ title: t.discardUnsaved, body: t.discardUnsavedConfirm, label: t.discardUnsaved, destructive: true })) return;
      setContent({ ...content, products: kind === "product" ? content.products.filter((item) => item.id !== key) : content.products, slides: kind === "slide" ? content.slides.filter((item) => item.key !== key) : content.slides, articles: kind === "article" ? content.articles.filter((item) => item.slug !== key) : content.articles });
      setUnsavedEntries((entries) => ({ ...entries, [kind]: entries[kind].filter((value) => value !== key) }));
      return;
    }
    if (!state.workspace) { try { validateCmsContent(content); } catch (error) { notify(`${t.invalid} ${validationHint(error instanceof Error ? error.message : "", locale)}`, true); return; } }
    if (!await confirm({ title: t.moveToTrash, body: t.trashMoveConfirm, label: t.moveToTrash, destructive: true })) return;
    setBusy("trash"); setMessage(null);
    try {
      const response = await fetch("/api/cms/trash", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "move", revision: state.revision, kind, key, content, ...(state.workspace ? { loadedArticleIds: state.workspace.loadedArticleIds } : {}) }) });
      const result = await response.json();
      if (!response.ok || !result.state) {
        setConflict(result.code === "REVISION_CONFLICT"); notify(result.code === "REVISION_CONFLICT" ? t.conflict : t.saveError, true); return;
      }
      adopt(result.state); setProductId(null); setSlideKey(null); setArticleIndex(null); notify(t.trashMoved);
    } catch { notify(t.requestError, true); }
    finally { setBusy(null); }
  };
  const openPublishing = async () => {
    if (busy || !state || !content) return;
    if (dirty) { const saved = await save("save"); if (!saved) return; }
    setReviewPublishing(true);
  };
  const addCaseStudy = () => {
    if (!content) return;
    const product = content.products.find((item) => item.id === HONEY_ID);
    if (!product) return;
    const article = createProductCaseStudy(product, crypto.randomUUID());
    if (state?.workspace) setState({ ...state, workspace: { ...state.workspace, loadedArticleIds: [...state.workspace.loadedArticleIds, article.id!] } });
    setContent({ ...content, articles: [...content.articles, article] });
    setUnsavedEntries((entries) => ({ ...entries, article: [...entries.article, article.slug] }));
    setView("journal"); setArticleIndex(content.articles.length); setDrawer(false);
  };

  const navigation = <><nav className={styles.navigation} aria-label={t.workspace}>{groups.map((group) => <div className={styles.group} key={group.label}><p className={styles.groupTitle}>{t[group.label]}</p>{group.views.map((item) => { const Icon = icons[item]; return <button key={item} type="button" title={t.nav[item]} className={styles.navButton} disabled={!!busy} aria-current={view === item ? "page" : undefined} onClick={() => navigate(item)}><Icon aria-hidden="true" /><span>{t.nav[item]}</span>{item === "trash" && trashCount > 0 && <b className={styles.navCount}>{trashCount}</b>}</button>; })}</div>)}</nav><div className={styles.sidebarFooter}><div className={styles.drawerUtilities}>{languageConfig.locales.map((language) => <button key={language.code} type="button" className={styles.navButton} disabled={!!busy} aria-current={locale === language.code ? "true" : undefined} title={language.label} onClick={() => void switchLanguage(language.code)}><Globe aria-hidden="true" /><span lang={language.code} dir={language.direction}>{language.label}</span></button>)}<a className={styles.navButton} title={t.viewStore} href={localizedPath(locale)} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" /><span>{t.viewStore}</span></a></div><button type="button" title={t.logout} className={styles.navButton} disabled={!!busy} onClick={() => void logout()}><LogOut aria-hidden="true" /><span>{t.logout}</span></button></div></>;
  const brand = <><Image src="/vetra-store-logo.svg" alt="VETRA STORE" width={1352} height={541} className={styles.brandLogo} /><div className={styles.brandText}><span>{t.workspace}</span></div></>;
  if (mode === "loading") return <main id="main-content"><LoadingScreen variant="admin" locale={locale} /></main>;
  if (!authenticated || !state || !content) return <main className={styles.login}><div className={styles.loginBrand}>{brand}<p>{t.loginIntro}</p><a className={styles.button} href={localizedPath(locale)}><ArrowLeft aria-hidden="true" />{t.viewStore}</a></div><CmsSignIn locale={locale} mode={mode} busy={!!busy} onLogin={(credentials) => void login(credentials)} error={message?.text} onRetry={() => window.location.reload()} /></main>;

  const selectedProduct = content.products.find((product) => product.id === productId);
  const selectedSlide = content.slides.find((slide) => slide.key === slideKey);
  const selectedArticle = articleIndex === null ? undefined : content.articles[articleIndex];
  const intro: Partial<Record<CmsView, string>> = { overview: t.overviewIntro, products: t.productsIntro, slides: t.slidesIntro, content: t.contentIntro, journal: t.journalIntro, media: t.mediaIntro, settings: t.settingsIntro, activity: t.activityIntro, trash: t.trashIntro };
  const audit = (limit?: number) => <ul className={styles.audit}>{state.audit.slice(0, limit).map((entry) => <li key={entry.id}><span className={styles.auditIcon}>{entry.action === "publish" ? <CloudUpload aria-hidden="true" /> : <Activity aria-hidden="true" />}</span><div><p>{cmsAuditLabel(entry.action, locale)}</p><span className={styles.hint}>{entry.actor}</span></div><time dateTime={entry.at}>{date(entry.at, locale)}</time></li>)}</ul>;
  const toolbar = (add: () => void, label: string, statuses = true) => <div className={styles.filters}><label className={styles.search}><SearchIcon /><span className="srOnly">{t.search}</span><input type="search" placeholder={t.search} value={search} onChange={(event) => { setSearch(event.target.value); setLibraryPage(0); }} /></label>{statuses && <label><span className="srOnly">{t.status}</span><select value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setLibraryPage(0); }}><option value="all">{t.all}</option><option value="draft">{t.draft}</option><option value="published">{t.published}</option><option value="archived">{t.archived}</option></select></label>}<button className={styles.primary} type="button" onClick={add}><Plus aria-hidden="true" />{label}</button></div>;
  const badge = (value: CmsStatus) => <span className={styles.badge} data-status={value}>{t[value]}</span>;
  const empty = <div className={styles.empty}><FolderOpen aria-hidden="true" /><p>{search ? t.emptySearch : t.empty}</p></div>;
  const visibleRecords = <T,>(records: T[]) => { const current = Math.min(libraryPage, Math.max(0, Math.ceil(records.length / 12) - 1)); return records.slice(current * 12, (current + 1) * 12); };
  const libraryPagination = (total: number) => {
    const pages = Math.max(1, Math.ceil(total / 12)), current = Math.min(libraryPage, pages - 1);
    return pages > 1 && <nav className={styles.recordPagination} aria-label={locale === "ar" ? cmsArabicUi["Record pages"] : locale === "th" ? "หน้ารายการ" : "Record pages"}><button type="button" className={styles.button} disabled={!current} onClick={() => setLibraryPage(current - 1)}>{t.previous}</button><span>{t.page} {current + 1} {t.of} {pages} · {total} {t.total}</span><button type="button" className={styles.button} disabled={current + 1 === pages} onClick={() => setLibraryPage(current + 1)}>{t.next}</button></nav>;
  };
  const editHeader = (label: string, close: () => void, path?: string) => <div className={styles.editorHeader}><button className={styles.button} type="button" onClick={close}><ArrowLeft aria-hidden="true" />{t.back}</button><h2>{label}</h2>{path && <a className={styles.button} href={localizedPath(locale, path)} aria-disabled={dirty || undefined} onClick={(event) => { if (dirty) { event.preventDefault(); notify(locale === "ar" ? cmsArabicUi["Save the draft before previewing."] : locale === "th" ? "บันทึกฉบับร่างก่อนดูตัวอย่าง" : "Save the draft before previewing."); } }} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" />{t.preview}</a>}</div>;
  const recoveryBanner = recovery.candidate ? <section className={styles.notice} aria-label={locale === "ar" ? cmsArabicUi["Recover unfinished work"] : locale === "th" ? "กู้คืนงาน" : "Recover unfinished work"}><Undo2 aria-hidden="true" /><div><p>{locale === "ar" ? cmsArabicUi["Unfinished work from your previous session is available."] : locale === "th" ? "พบงานที่ยังไม่ได้บันทึกจากการใช้งานครั้งก่อน" : "Unfinished work from your previous session is available."}</p><div className={styles.actions}><button type="button" className={styles.primary} onClick={() => void recoverDraft()}>{locale === "ar" ? cmsArabicUi["Recover work"] : locale === "th" ? "กู้คืนงาน" : "Recover work"}</button><button type="button" className={styles.button} onClick={async () => { if (await confirm({ title: locale === "ar" ? cmsArabicUi["Discard recovered work?"] : locale === "th" ? "ลบงานที่กู้คืน?" : "Discard recovered work?", body: t.reloadConfirm, destructive: true })) await recovery.dismiss().catch(() => notify(t.requestError, true)); }}>{locale === "ar" ? cmsArabicUi["Discard recovery"] : locale === "th" ? "ทิ้งงานที่กู้คืน" : "Discard recovery"}</button></div></div></section> : recovery.status === "error" ? <p className={styles.notice} data-error="true" role="alert">{locale === "ar" ? cmsArabicUi["Browser recovery storage is unavailable. Save your changes before leaving."] : locale === "th" ? "ไม่สามารถเก็บสำเนาในเบราว์เซอร์ได้ กรุณาบันทึกก่อนออกจากหน้า" : "Browser recovery storage is unavailable. Save your changes before leaving."}</p> : null;
  const conflictDialog = mergeReview && <CmsConflictReview locale={locale} conflicts={mergeReview.conflicts} onClose={() => setMergeReview(null)} onApply={(choices) => {
    const merged = mergeDraft(mergeReview.base, mergeReview.mine, mergeReview.latest.draft, [], [], choices) as CmsContent;
    setState(mergeReview.latest);
    setContent(merged);
    setUnsavedEntries({ product: merged.products.filter((entry) => !mergeReview.latest.draft.products.some((item) => item.id === entry.id)).map((entry) => entry.id), slide: merged.slides.filter((entry) => !mergeReview.latest.draft.slides.some((item) => item.key === entry.key)).map((entry) => entry.key), article: merged.articles.filter((entry) => !mergeReview.latest.draft.articles.some((item) => (item.id ?? item.slug) === (entry.id ?? entry.slug))).map((entry) => entry.slug) });
    setConflict(false); setMergeReview(null); notify(t.merged);
    if (recovery.candidate) void recovery.dismiss().catch(() => notify(t.requestError, true));
  }} />;
  let page;
  if (view === "overview") {
    const stats = [{ label: t.productCount, value: content.products.filter((entry) => entry.status === "published").length, icon: Package, target: "products" }, { label: t.slideCount, value: content.slides.filter((entry) => entry.enabled).length, icon: GalleryHorizontalEnd, target: "slides" }, { label: t.articleCount, value: content.articles.filter((entry) => entry.status === "published").length, icon: BookOpen, target: "journal" }, { label: t.imageCount, value: content.media.length, icon: FolderOpen, target: "media" }] as const;
    page = <div className={styles.stack}><section className={styles.hero}><div><h2>{t.welcome}</h2><p>{t.overviewIntro}</p></div><a className={styles.button} href={localizedPath(locale)} target="_blank" rel="noopener noreferrer">{t.viewStore}<ExternalLink aria-hidden="true" /></a></section><div className={styles.stats}>{stats.map((stat) => <button type="button" className={styles.stat} key={stat.target} onClick={() => navigate(stat.target)}><span className={styles.statTop}>{stat.label}<stat.icon aria-hidden="true" /></span><strong>{stat.value}</strong></button>)}</div><div className={styles.overviewGrid}><section className={styles.panel}><h2>{t.quickActions}</h2><div className={styles.quick}><button type="button" onClick={addProduct}><Package aria-hidden="true" />{t.addProduct}</button><button type="button" onClick={addSlide}><GalleryHorizontalEnd aria-hidden="true" />{t.addSlide}</button><button type="button" onClick={addArticle}><BookOpen aria-hidden="true" />{t.addArticle}</button><button type="button" onClick={() => navigate("media")}><Upload aria-hidden="true" />{t.uploadImage}</button></div></section><section className={styles.panel}><h2>{t.contentStatus}</h2><p className={styles.hint}>{t.publishingIntro}</p><div className={styles.statusRow}><span>{dirty ? t.unsaved : t.saved}</span><span className={styles.badge}>{publishPending ? t.pending : t.published}</span></div><p className={styles.hint}>{state.publishedAt ? `${t.lastPublished}: ${date(state.publishedAt, locale)}` : t.neverPublished}</p><button type="button" className={styles.primary} disabled={!!busy || !publishPending || identity?.role !== "owner"} onClick={() => void openPublishing()}><CloudUpload aria-hidden="true" />{t.publishChanges}</button></section></div><section className={styles.panel}><div className={styles.statusRow}><h2>{t.recentActivity}</h2><button className={styles.button} type="button" onClick={() => navigate("activity")}>{t.all}<ChevronRight aria-hidden="true" /></button></div>{state.audit.length ? audit(5) : <p className={styles.hint}>{t.noActivity}</p>}</section></div>;
  } else if (view === "products") {
    const products = content.products.filter((product) => (status === "all" || status === product.status) && `${product.name.ar} ${product.name.th} ${product.name.en} ${product.brand} ${product.id}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
    page = selectedProduct ? <>{editHeader(selectedProduct.name[locale] || t.newProduct, () => setProductId(null), `/cms/preview?type=product&key=${encodeURIComponent(selectedProduct.id)}`)}<ProductEditor key={selectedProduct.id} locale={locale} content={content} product={selectedProduct} onChange={(updated) => setContent({ ...content, products: content.products.map((product) => product.id === updated.id ? updated : product) })} /></> : <>{toolbar(addProduct, t.addProduct)}<div className={styles.cards}>{visibleRecords(products).map((product) => <article className={styles.record} key={product.id}><div className={styles.recordImage}>{product.image && <Image src={product.image} alt={product.card[locale].imageAlt} fill unoptimized sizes="(min-width: 68rem) 25vw, 100vw" />}</div><div className={styles.recordBody}><div className={styles.recordMeta}>{badge(product.status)}<span>{product.brand}</span></div><h2>{product.name[locale] || t.newProduct}</h2><p><bdi>{cmsProductPrice(product, locale)}</bdi> · {product.weight} g</p><p className={styles.hint}>{t.stock}: {product.stock === null ? t.unlimited : product.stock}</p><div className={styles.actions}><button className={styles.button} type="button" onClick={() => setProductId(product.id)}><Pencil aria-hidden="true" />{t.edit}</button><button className={styles.iconButton} type="button" aria-label={`${t.archive} ${product.name[locale]}`} onClick={() => setContent({ ...content, products: content.products.map((entry) => entry.id === product.id ? { ...entry, status: "archived" } : entry) })}><Archive aria-hidden="true" /></button>{product.id !== HONEY_ID && <button className={`${styles.iconButton} ${styles.danger}`} type="button" aria-label={`${incompleteUnsaved("product", product.id) ? t.discardUnsaved : t.moveToTrash} ${product.name[locale]}`} title={incompleteUnsaved("product", product.id) ? t.discardUnsaved : t.moveToTrash} onClick={() => void trashItem("product", product.id)}><Trash2 aria-hidden="true" /></button>}</div></div></article>)}</div>{!products.length && empty}{libraryPagination(products.length)}</>;
  } else if (view === "slides") {
    const slides = content.slides.filter((slide) => `${slide.key} ${slide.alt.ar} ${slide.alt.th} ${slide.alt.en} ${slide.path}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
    const move = (key: string, offset: number) => { const list = [...content.slides]; const index = list.findIndex((slide) => slide.key === key); if (index + offset < 0 || index + offset >= list.length) return; [list[index], list[index + offset]] = [list[index + offset], list[index]]; setContent({ ...content, slides: list }); };
    page = selectedSlide ? <>{editHeader(selectedSlide.alt[locale] || t.newSlide, () => setSlideKey(null))}<SlideEditor locale={locale} content={content} slide={selectedSlide} onChange={(updated) => setContent({ ...content, slides: content.slides.map((slide) => slide.key === updated.key ? updated : slide) })} /></> : <>{toolbar(addSlide, t.addSlide, false)}<div className={styles.cards}>{visibleRecords(slides).map((slide) => { const position = content.slides.findIndex((entry) => entry.key === slide.key); return <article className={styles.record} key={slide.key}><div className={styles.recordImage} data-lifestyle="true">{slide.src && <Image src={slide.src} alt={slide.alt[locale]} fill unoptimized sizes="(min-width: 68rem) 25vw, 100vw" />}</div><div className={styles.recordBody}><div className={styles.recordMeta}><span className={styles.badge}>{t.order} {position + 1}</span><span>{slide.enabled ? t.enabled : t.disabled}</span></div><h2>{slide.alt[locale] || t.newSlide}</h2><p className={styles.hint}>{slide.path}</p><div className={styles.actions}><button className={styles.button} type="button" onClick={() => setSlideKey(slide.key)}><Pencil aria-hidden="true" />{t.edit}</button><button className={styles.iconButton} type="button" disabled={position === 0} aria-label={t.moveUp} onClick={() => move(slide.key, -1)}><MoveUp aria-hidden="true" /></button><button className={styles.iconButton} type="button" disabled={position === content.slides.length - 1} aria-label={t.moveDown} onClick={() => move(slide.key, 1)}><MoveDown aria-hidden="true" /></button><button className={`${styles.iconButton} ${styles.danger}`} type="button" aria-label={`${incompleteUnsaved("slide", slide.key) ? t.discardUnsaved : t.moveToTrash} ${slide.key}`} title={incompleteUnsaved("slide", slide.key) ? t.discardUnsaved : t.moveToTrash} onClick={() => void trashItem("slide", slide.key)}><Trash2 aria-hidden="true" /></button></div></div></article>; })}</div>{!slides.length && empty}{libraryPagination(slides.length)}</>;
  } else if (view === "content") {
    page = <CopyEditor locale={locale} content={content} onChange={setContent} />;
  } else if (view === "journal") {
    const articles = content.articles.filter((article) => (status === "all" || status === article.status) && `${article.content.ar.title} ${article.content.th.title} ${article.content.en.title} ${article.slug}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
    page = selectedArticle ? <>{editHeader(selectedArticle.content[locale].title || t.newArticle, () => setArticleIndex(null), `/cms/preview?type=article&key=${encodeURIComponent(selectedArticle.slug)}`)}<ArticleEditor locale={locale} content={content} article={selectedArticle} onChange={(updated) => { setContent({ ...content, articles: content.articles.map((article, index) => index === articleIndex ? updated : updated.featured ? { ...article, featured: false } : article) }); setUnsavedEntries((entries) => ({ ...entries, article: entries.article.map((slug) => slug === selectedArticle.slug ? updated.slug : slug) })); }} /></> : <>{toolbar(addArticle, t.addArticle)}<div className={styles.actions}><button type="button" className={styles.button} onClick={addCaseStudy}><FileText aria-hidden="true" />{locale === "ar" ? cmsArabicUi["Start product case study"] : locale === "th" ? "เริ่มฉบับร่างกรณีศึกษาสินค้า" : "Start product case study"}</button></div><div className={styles.cards}>{visibleRecords(articles).map((article) => <article className={styles.record} key={article.slug}><div className={styles.recordImage} data-lifestyle="true">{article.image && <Image src={article.image} alt={article.content[locale].title} fill unoptimized sizes="(min-width: 68rem) 25vw, 100vw" />}</div><div className={styles.recordBody}><div className={styles.recordMeta}>{badge(article.status)}<span>{article.content[locale].category}</span></div><h2>{article.content[locale].title || t.newArticle}</h2><p className={styles.hint}>{article.content[locale].excerpt}</p><div className={styles.actions}><button className={styles.button} type="button" onClick={() => void openArticle(article)}><Pencil aria-hidden="true" />{t.edit}</button><button className={`${styles.iconButton} ${styles.danger}`} type="button" aria-label={`${incompleteUnsaved("article", article.slug) ? t.discardUnsaved : t.moveToTrash} ${article.content[locale].title}`} title={incompleteUnsaved("article", article.slug) ? t.discardUnsaved : t.moveToTrash} onClick={() => void trashItem("article", article.slug)}><Trash2 aria-hidden="true" /></button></div></div></article>)}</div>{!articles.length && empty}{libraryPagination(articles.length)}</>;
  } else if (view === "media") {
    page = <CmsMedia key={`${identity?.id}:${recovery.scope ?? "unavailable"}`} recoveryScope={recovery.scope} recoveryOwner={identity?.id} locale={locale} state={state} content={content} dirty={dirty} onDraft={setContent} onState={adopt} onMessage={notify} onBusy={(value) => setBusy(value ? "media" : null)} onPendingChange={setPendingMedia} onConflict={() => { setConflict(true); notify(t.conflict, true); }} />;
  } else if (view === "trash") {
    page = <CmsTrash locale={locale} state={state} dirty={dirty} onState={adopt} onMessage={notify} onBusy={(value) => setBusy(value ? "trash" : null)} onConflict={() => { setConflict(true); notify(t.conflict, true); }} />;
  } else if (["orders", "messages", "customers", "notifications"].includes(view)) {
    page = <CmsOperations key={`${locale}-${view}`} locale={locale} view={view as "orders" | "messages" | "customers" | "notifications"} onDirtyChange={setOperationsDirty} />;
  } else if (view === "settings") {
    page = <div className={styles.stack}><form className={editorStyles.panel} id="cms-editor-form" onSubmit={(event) => event.preventDefault()}><h2>{t.storeInfo}</h2><div className={editorStyles.fields}>
      <Field label={t.fields.storeName}><input value={content.settings.storeName} required maxLength={100} onChange={(event) => setContent({ ...content, settings: { ...content.settings, storeName: event.target.value } })} /></Field>
      <Field label={t.fields.email}><input type="email" value={content.settings.email} maxLength={200} onChange={(event) => setContent({ ...content, settings: { ...content.settings, email: event.target.value } })} /></Field>
      <Field label={t.fields.phone}><input type="tel" value={content.settings.phone} maxLength={40} onChange={(event) => setContent({ ...content, settings: { ...content.settings, phone: event.target.value } })} /></Field>
      <Field label={t.fields.currency} hint={t.supportedCurrency}><select value="THB" disabled><option>THB</option></select></Field>
      {locales.map((language) => <Field key={language} label={`${t.fields.address} · ${localeSettings(language).label}`}><textarea lang={language} dir={localeSettings(language).direction} maxLength={1000} value={content.settings.address[language]} onChange={(event) => setContent({ ...content, settings: { ...content.settings, address: { ...content.settings.address, [language]: event.target.value } } })} /></Field>)}
    </div><CmsBusinessSettings locale={locale} settings={content.settings} onChange={(settings) => setContent({ ...content, settings })} /></form>{identity?.role === "owner" && <CmsBackupTools locale={locale} state={state} disabled={!!busy || dirty || pendingMedia || operationsDirty} onState={adopt} onMessage={notify} />}<section className={styles.panel}><h2>{t.restore}</h2><p className={styles.hint}>{t.restoreDescription}</p><button className={styles.button} type="button" disabled={!!busy} onClick={() => void save("restore")}><Undo2 aria-hidden="true" />{t.restore}</button></section>{identity?.role === "owner" && <CmsReadiness locale={locale} />}<section className={styles.panel}><h2>{t.systemInfo}</h2><span className={styles.badge}>{mode === "local" ? t.localMode : (locale === "ar" ? cmsArabicUi["Configured services"] : locale === "th" ? "ระบบที่ตั้งค่าแล้ว" : "Configured services")}</span><p className={styles.hint}>{identity?.name} · {identity?.role}</p><div className={styles.statusRow}><span>{t.revision} {state.revision}</span><span>{t.lastPublished}: {date(state.publishedAt, locale)}</span></div></section></div>;
  } else {
    page = <div className={styles.stack}><CmsHistory locale={locale} state={state} disabled={!!busy || dirty || pendingMedia || operationsDirty} canRestore={identity?.role === "owner"} onState={adopt} onMessage={notify} /><section className={styles.panel}>{state.audit.length ? audit() : <p className={styles.hint}>{t.noActivity}</p>}</section></div>;
  }
  return <main className={styles.shell}><NavigationProgress pending={navigating} locale={locale} /><div className={styles.workspace}><header className={styles.topbar}><div className={styles.topbarLeft}><button className={`${styles.iconButton} ${styles.drawerToggle}`} type="button" aria-label={t.menu} aria-expanded={drawer} aria-controls="cms-navigation" onClick={() => setDrawer(true)}><Menu aria-hidden="true" /></button><div><span className={styles.crumb}>VETRA / CMS</span><span className={styles.topbarTitle}>{t.nav[view]}</span></div></div><div className={styles.actions}><button className={styles.button} type="button" disabled={!!busy || !dirty} onClick={() => void save("save")}>{busy === "save" ? <LoaderCircle className={styles.spinning} aria-hidden="true" /> : <Save aria-hidden="true" />}{busy === "save" ? t.saving : t.save}</button><button className={styles.primary} type="button" disabled={!!busy || (!publishPending && !dirty) || identity?.role !== "owner"} onClick={() => void openPublishing()}>{busy === "publish" ? <LoaderCircle className={styles.spinning} aria-hidden="true" /> : <CloudUpload aria-hidden="true" />}{busy === "publish" ? t.publishing : t.publish}</button></div></header><div className={styles.content}>{recoveryBanner}{message && <div className={styles.notice} data-error={message.error} role={message.error ? "alert" : "status"}>{message.error ? <AlertTriangle aria-hidden="true" /> : <Check aria-hidden="true" />}<div><p>{message.text}</p>{conflict && <div className={styles.actions}><button className={styles.button} type="button" disabled={!!busy} onClick={() => void merge()}><RefreshCw aria-hidden="true" />{t.reviewLatest}</button><button className={styles.button} type="button" disabled={!!busy} onClick={() => void reload()}>{t.reload}</button></div>}</div><button className={styles.iconButton} type="button" aria-label={t.close} onClick={() => setMessage(null)}><X aria-hidden="true" /></button></div>}<div className={styles.heading}><div><h1 ref={headingRef} tabIndex={-1}>{t.nav[view]}</h1>{intro[view] && <p>{intro[view]}</p>}</div><span className={styles.status}>{dirty || pendingMedia || operationsDirty ? <Pencil aria-hidden="true" /> : <Check aria-hidden="true" />}{dirty || pendingMedia || operationsDirty ? t.unsaved : t.saved}</span></div><div inert={!!busy} aria-busy={!!busy}>{page}</div></div><footer className={styles.footerStatus}>{recovery.status === "saved" && dirty && <span role="status">{locale === "ar" ? cmsArabicUi["Recovery copy saved in this browser · expires in 7 days"] : locale === "th" ? "เก็บสำเนาในเบราว์เซอร์แล้ว · หมดอายุใน 7 วัน" : "Recovery copy saved in this browser · expires in 7 days"}</span>}<span>{t.revision} {state.revision}</span><span>{state.publishedAt ? `${t.lastPublished}: ${date(state.publishedAt, locale)}` : t.neverPublished}</span></footer></div>{<CmsDialog open={drawer} animate onAfterClose={() => { if (focusAfterDrawer.current) { focusAfterDrawer.current = false; headingRef.current?.focus({ preventScroll: true }); } }} id="cms-navigation" label={t.workspace} className={styles.drawerDialog} onClose={() => setDrawer(false)}><div className={styles.brand}>{brand}<button className={styles.iconButton} type="button" aria-label={t.closeMenu} onClick={() => setDrawer(false)}><X aria-hidden="true" /></button></div>{navigation}</CmsDialog>}{reviewPublishing && <CmsPublishing locale={locale} state={state} onClose={() => setReviewPublishing(false)} onState={(next) => { adopt(next); router.refresh(); }} onMessage={notify} />}{conflictDialog}{confirmation}</main>;
}

function SearchIcon() { return <Search aria-hidden="true" />; }

function validationHint(message: string, locale: Locale) {
  const t = cmsCopy[locale];
  if (message.includes("unique")) return locale === "ar" ? cmsArabicUi["IDs and URL slugs must be unique."] : locale === "th" ? "รหัสและเส้นทาง URL ต้องไม่ซ้ำกัน" : "IDs and URL slugs must be unique.";
  const aliases = [
    ["product ID", t.fields.id], ["product slug", t.fields.slug], ["product price", t.fields.price],
    ["product name", t.fields.name], ["product description", t.fields.description],
    ["card caption", t.fields.captionPrefix], ["button label", t.fields.cta],
    ["image description", t.fields.imageAlt], ["image URL", t.imagePath],
    ["slide destination", t.fields.path], ["link label", t.fields.linkLabel],
    ["search term", t.fields.searchTerms], ["article category", t.fields.category],
    ["article title", t.fields.title], ["article excerpt", t.fields.excerpt],
    ["article introduction", t.fields.intro], ["section heading", t.sectionTitle], ["section text", t.sectionText],
    ["store name", t.fields.storeName], ["email", t.fields.email], ["phone", t.fields.phone],
    ["address", t.fields.address], ["weight", t.fields.weight], ["stock", t.fields.stock], ["brand", t.fields.brand],
  ];
  const match = aliases.find(([key]) => message.toLowerCase().includes(key.toLowerCase()));
  const language = message.includes("Arabic") ? ` · ${t.arabic}` : message.includes("Thai") ? ` · ${t.thai}` : message.includes("English") ? ` · ${t.english}` : "";
  if (match) return `${match[1]}${language}`;
  if (message.includes("image")) return t.chooseImage;
  if (message.includes("link")) return t.linkHelp;
  return "";
}


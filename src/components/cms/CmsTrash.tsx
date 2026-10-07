"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { BookOpen, Clock3, ImageIcon, Info, LoaderCircle, MessageSquare, Package, ShoppingBag, Trash2, Undo2 } from "lucide-react";
import { useDemo } from "@/components/demo/DemoProvider";
import { cmsCopy } from "@/content/cms";
import type { CmsState, CmsTrashEntry, CmsTrashKind } from "@/lib/cms/types";
import type { DemoKind } from "@/lib/demo-types";
import { localeSettings, type Locale } from "@/lib/i18n";
import { useCmsConfirm } from "./CmsConfirm";
import styles from "./CmsTrash.module.css";

type Kind = CmsTrashKind | DemoKind;
type TrashRow = { id: string; source: "cms" | "business"; kind: Kind; title: string; detail: string; deletedAt: string; expiresAt: string; image?: string };
const kinds: Kind[] = ["product", "slide", "article", "media", "order", "contact", "wholesale", "newsletter"];
const kindIcons = { product: Package, slide: ImageIcon, article: BookOpen, media: ImageIcon, order: ShoppingBag, contact: MessageSquare, wholesale: Package, newsletter: MessageSquare };

function row(entry: CmsTrashEntry, locale: Locale): TrashRow {
  const base = { id: entry.id, source: "cms" as const, kind: entry.kind, deletedAt: entry.deletedAt, expiresAt: entry.expiresAt };
  if (entry.kind === "product") return { ...base, title: entry.item.name[locale], detail: `${entry.item.brand} · ${entry.item.slug}`, image: entry.item.image };
  if (entry.kind === "slide") return { ...base, title: entry.item.alt[locale], detail: entry.item.path, image: entry.item.src };
  if (entry.kind === "article") return { ...base, title: entry.item.content[locale].title, detail: entry.item.slug, image: entry.item.image };
  return { ...base, title: entry.item.name, detail: `${entry.item.width} × ${entry.item.height} · ${(entry.item.bytes / 1024).toFixed(0)} KB`, image: `/api/cms/trash-media/${entry.item.src.split("/").at(-1)}` };
}
function date(value: string, locale: Locale) { return new Intl.DateTimeFormat(localeSettings(locale).intl, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

export function CmsTrash({ locale, state, dirty, onState, onMessage, onBusy, onConflict }: {
  locale: Locale; state: CmsState; dirty: boolean; onState: (state: CmsState) => void; onMessage: (message: string, error?: boolean) => void; onBusy: (busy: boolean) => void; onConflict: () => void;
}) {
  const t = cmsCopy[locale];
  const demo = useDemo();
  const { confirm, confirmation } = useCmsConfirm(locale);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind | "all">("all");
  const [source, setSource] = useState<"all" | "cms" | "business">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  const rows: TrashRow[] = [
    ...(state.trash ?? []).map((entry) => row(entry, locale)),
    ...(demo.enabled && demo.hydrated ? (demo.trash ?? []).map((entry) => ({ id: entry.id, source: "business" as const, kind: entry.record.kind, title: entry.record.name, detail: `${entry.record.reference} · ${entry.record.email}`, deletedAt: entry.deletedAt, expiresAt: entry.expiresAt })) : []),
  ].filter((entry) => new Date(entry.expiresAt).getTime() > now).sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  const matches = rows.filter((entry) => (kind === "all" || entry.kind === kind) && (source === "all" || entry.source === source) && `${entry.title} ${entry.detail} ${t.trashKinds[entry.kind]}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const restore = async (entry: TrashRow) => {
    if (busy) return;
    if (entry.source === "cms" && dirty) { onMessage(t.trashSaveFirst, true); return; }
    if (!await confirm({ title: t.trashRestore, body: entry.source === "cms" ? t.trashRestoreConfirm : t.trashRestoreRecordConfirm, label: t.trashRestore })) return;
    setBusy(`${entry.source}:${entry.id}`); onBusy(true);
    try {
      if (entry.source === "business") { demo.restoreRecord(entry.id); onMessage(t.trashRestored); return; }
      const response = await fetch("/api/cms/trash", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restore", revision: state.revision, id: entry.id }) });
      const result = await response.json();
      if (!response.ok || !result.state) {
        if (result.code === "REVISION_CONFLICT") onConflict();
        else onMessage(result.code === "TRASH_RESTORE_CONFLICT" ? t.trashRestoreConflict : ["TRASH_NOT_FOUND", "TRASH_EXPIRED"].includes(result.code) ? t.trashUnavailable : t.trashRestoreError, true);
        return;
      }
      onState(result.state); onMessage(t.trashRestored);
    } catch (error) { onMessage(error instanceof Error && /conflict|exists|duplicate/i.test(error.message) ? t.trashRestoreConflict : t.trashRestoreError, true); }
    finally { setBusy(null); onBusy(false); }
  };
  return <div className={styles.workspace}>
    {dirty && <div className={styles.notice}><Info aria-hidden="true" /><p>{t.trashSaveFirst}</p></div>}
    <div className={styles.filters}>
      <label className={styles.field}><span>{t.search}</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <label className={styles.field}><span>{t.fields.category}</span><select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="all">{t.trashAllKinds}</option>{kinds.map((value) => <option value={value} key={value}>{t.trashKinds[value]}</option>)}</select></label>
      <label className={styles.field}><span>{t.source}</span><select value={source} onChange={(event) => setSource(event.target.value as typeof source)}><option value="all">{t.all}</option><option value="cms">{t.trashSourceContent}</option><option value="business">{t.trashSourceBusiness}</option></select></label>
    </div>
    <div className={styles.summary}><p>{matches.length} {t.total}</p><p>{t.trashRetention}</p></div>
    <div className={styles.grid}>{matches.map((entry) => {
      const Icon = kindIcons[entry.kind];
      const remaining = Math.max(0, Math.ceil((new Date(entry.expiresAt).getTime() - now) / 86400000));
      return <article className={styles.card} key={`${entry.source}:${entry.id}`}>
        <div className={styles.identity}><div className={styles.picture}>{entry.image ? <Image src={entry.image} alt="" fill unoptimized sizes="5rem" /> : <Icon aria-hidden="true" />}</div><div><h2>{entry.title}</h2><p>{entry.detail}</p></div></div>
        <div className={styles.meta}><span className={styles.badge}>{t.trashKinds[entry.kind]}</span><span className={styles.source}>{entry.source === "cms" ? t.trashSourceContent : t.trashSourceBusiness}</span></div>
        <dl className={styles.dates}><div><dt>{t.trashDeletedAt}</dt><dd><time dateTime={entry.deletedAt}>{date(entry.deletedAt, locale)}</time></dd></div><div><dt>{t.trashExpiresAt}</dt><dd><time dateTime={entry.expiresAt}>{date(entry.expiresAt, locale)}</time></dd></div></dl>
        <div className={styles.bottom}><span className={styles.remaining} data-soon={remaining <= 3}><Clock3 aria-hidden="true" />{remaining <= 1 ? t.trashFinalDay : `${remaining} ${t.trashDaysLeft}`}</span><button className={styles.restore} type="button" disabled={!!busy || (entry.source === "cms" && dirty)} onClick={() => void restore(entry)} aria-label={`${t.trashRestore}: ${entry.title}`}>{busy === `${entry.source}:${entry.id}` ? <LoaderCircle className={styles.spinning} aria-hidden="true" /> : <Undo2 aria-hidden="true" />}{t.trashRestore}</button></div>
      </article>;
    })}</div>
    {!matches.length && <div className={styles.empty}><Trash2 aria-hidden="true" /><h2>{rows.length ? t.emptySearch : t.trashEmpty}</h2><p>{rows.length ? "" : t.trashEmptyBody}</p></div>}
    {confirmation}
  </div>;
}

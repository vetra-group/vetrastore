"use client";

import { cmsArabicUi } from "@/content/cms-ar-ui";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, ImageIcon, LoaderCircle, Pencil, RefreshCw, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { cmsCopy } from "@/content/cms";
import { homeCollections } from "@/content/site-structure";
import type { CmsContent, CmsMedia as Media, CmsState } from "@/lib/cms/types";
import { validImageSource } from "@/lib/cms/validation";
import { MAX_MEDIA_RETRIES, MAX_MEDIA_SOURCE_BYTES, type CmsMediaCleanupResult, type CmsMediaSubmissionResult, type CmsStagedUpload } from "@/lib/cms/media-policy";
import { prepareCmsImage, type PreparedCmsImage } from "@/lib/cms/prepare-image";
import { readCheckpoint, writeCheckpoint, deleteCheckpoint } from "@/lib/cms/draft-checkpoint";
import { locales, localeSettings, type Locale, type Localized } from "@/lib/i18n";
import { CmsDialog } from "./CmsDialog";
import { useCmsConfirm } from "./CmsConfirm";
import styles from "./CmsEditor.module.css";

function imageOptions(content: CmsContent, locale: Locale) {
  const options = [
    ...content.media.map((media) => ({ src: media.src, name: media.alt[locale] || media.name, uploaded: true })),
    ...content.products.map((product) => ({ src: product.image, name: product.card[locale].imageAlt || product.name[locale], uploaded: false })),
    ...content.slides.map((slide) => ({ src: slide.src, name: slide.alt[locale], uploaded: false })),
    ...content.articles.map((article) => ({ src: article.image, name: article.content[locale].title, uploaded: false })),
    ...homeCollections.map((collection) => ({ src: collection.image, name: collection.image.split("/").at(-1) ?? collection.key, uploaded: false })),
  ];
  return options.filter((option, index) => { try { validImageSource(option.src); return options.findIndex((entry) => entry.src === option.src) === index; } catch { return false; } });
}

export function MediaPicker({ locale, content, selected, onSelect, onClose }: { locale: Locale; content: CmsContent; selected: string; onSelect: (src: string) => void; onClose: () => void }) {
  const t = cmsCopy[locale];
  const [search, setSearch] = useState("");
  const options = imageOptions(content, locale).filter((image) => `${image.src} ${image.name}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <CmsDialog label={t.library} className={styles.mediaDialog} onClose={onClose}><div className={`${styles.toolbar} ${styles.stickyDialogHeader}`}><h2>{t.chooseImage}</h2><button type="button" className={styles.iconButton} aria-label={t.close} onClick={onClose}><X aria-hidden="true" /></button></div><label className={styles.field}><span>{t.search}</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label><div className={styles.mediaGrid}>{options.map((image) => <button className={styles.mediaChoice} type="button" aria-pressed={selected === image.src} key={image.src} onClick={() => { onSelect(image.src); onClose(); }}><div className={styles.imageFrame}><Image src={image.src} alt="" fill unoptimized sizes="12rem" /></div><span>{image.name}</span>{selected === image.src && <Check aria-hidden="true" />}</button>)}</div>{options.length === 0 && <p className={styles.empty}>{t.emptySearch}</p>}</CmsDialog>;
}

type TransferPhase = "ready" | "uploading" | "uploadError" | "saving" | "saveError" | "checking" | "uncertain" | "abandoned";
type MediaCheckpoint = { file: File | null; width: number; height: number; alt: Localized<string>; submissionId: string | null; staged: CmsStagedUpload | null; attempts: { upload: number; save: number }; phase: TransferPhase };

class MediaRequestError extends Error {
  constructor(readonly code?: string) { super("Media request failed"); }
}

async function requestMedia<T>(url: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new MediaRequestError(result.code);
    return result as T;
  } finally { window.clearTimeout(timeout); }
}

export function CmsMedia({ locale, state, dirty, content, onDraft, onState, onMessage, onBusy, onPendingChange, onConflict, recoveryScope, recoveryOwner }: {
  locale: Locale; state: CmsState; dirty: boolean; content: CmsContent;
  onDraft: (content: CmsContent) => void; onState: (state: CmsState) => void; onMessage: (message: string, error?: boolean) => void; onBusy: (busy: boolean) => void; onPendingChange: (pending: boolean) => void; onConflict: () => void;
  recoveryScope?: string | null; recoveryOwner?: string;
}) {
  const t = cmsCopy[locale];
  const [prepared, setPrepared] = useState<PreparedCmsImage | null>(null);
  const { confirm, confirmation } = useCmsConfirm(locale);
  const [alt, setAlt] = useState({ en: "", ar: "", th: "" });
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [phase, setPhase] = useState<TransferPhase>("ready");
  const [attempts, setAttempts] = useState({ upload: 0, save: 0 });
  const [transferError, setTransferError] = useState("");
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selection = useRef(0);
  const busyRef = useRef(false);
  const submissionId = useRef<string | null>(null);
  const staged = useRef<CmsStagedUpload | null>(null);
  const counts = useRef({ upload: 0, save: 0 });
  const [recoveryCandidate, setRecoveryCandidate] = useState<MediaCheckpoint | null>(null);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [recoveryError, setRecoveryError] = useState(false);
  const checkpointQueue = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    if (!recoveryScope || !recoveryOwner) return;
    let cancelled = false;
    void readCheckpoint<MediaCheckpoint>(`${recoveryScope}:media`, recoveryOwner).then((record) => {
      if (!cancelled) { setRecoveryCandidate(record?.value ?? null); setRecoveryReady(true); }
    }).catch(() => { if (!cancelled) { setRecoveryError(true); setRecoveryReady(true); } });
    return () => { cancelled = true; };
  }, [recoveryScope, recoveryOwner]);
  useEffect(() => {
    if (!recoveryScope || !recoveryOwner || !recoveryReady || recoveryCandidate) return;
    const snapshot: MediaCheckpoint = { file: prepared?.file ?? null, width: prepared?.width ?? 0, height: prepared?.height ?? 0, alt, submissionId: submissionId.current, staged: staged.current, attempts, phase };
    checkpointQueue.current = checkpointQueue.current.catch(() => undefined).then(() => snapshot.file || snapshot.alt.ar || snapshot.alt.th || snapshot.alt.en ? writeCheckpoint(`${recoveryScope}:media`, recoveryOwner, snapshot) : deleteCheckpoint(`${recoveryScope}:media`)).catch(() => setRecoveryError(true));
  }, [prepared, alt, attempts, phase, recoveryScope, recoveryOwner, recoveryReady, recoveryCandidate]);
  const recoverImage = () => {
    if (!recoveryCandidate) return;
    const saved = recoveryCandidate;
    if (saved.file) setPrepared({ file: saved.file, width: saved.width, height: saved.height, url: URL.createObjectURL(saved.file) });
    setAlt({ en: saved.alt.en, ar: saved.alt.ar ?? "", th: saved.alt.th }); submissionId.current = saved.submissionId; staged.current = saved.staged;
    counts.current = saved.attempts; setAttempts(saved.attempts);
    // A recovered submission must ask the server for its outcome before any
    // additional upload/save. It may have completed while the tab was closing.
    setPhase(saved.submissionId ? "checking" : "ready");
    setRecoveryCandidate(null);
    if (saved.submissionId) {
      beginBusy();
      void requestMedia<CmsMediaSubmissionResult>(`/api/cms/media?submissionId=${encodeURIComponent(saved.submissionId)}`).then((result) => {
        if (result.status === "committed" && result.state) { complete(result.state); return; }
        if (result.status === "abandoned") { adoptAbandoned(); return; }
        staged.current = result.uploads[0] ?? null;
        const stage = staged.current ? "save" : "upload";
        if (saved.attempts[stage] > MAX_MEDIA_RETRIES) { setPhase("uncertain"); setTransferError(t.mediaRetriesExhausted); }
        else setPhase(staged.current ? "saveError" : "uploadError");
      }).catch(() => { setPhase("uncertain"); setTransferError(t.mediaUncertainHelp); }).finally(endBusy);
    }
  };
  useEffect(() => () => { if (prepared) URL.revokeObjectURL(prepared.url); }, [prepared]);
  useEffect(() => () => { selection.current += 1; }, []);
  useEffect(() => { onPendingChange(preparing || !!prepared || !!alt.ar || !!alt.th || !!alt.en); return () => onPendingChange(false); }, [prepared, preparing, alt, onPendingChange]);
  const resetTransfer = () => {
    submissionId.current = null;
    staged.current = null;
    counts.current = { upload: 0, save: 0 };
    setAttempts({ upload: 0, save: 0 });
    setPhase("ready");
    setTransferError("");
  };
  const beginBusy = () => { busyRef.current = true; setBusy(true); onBusy(true); };
  const endBusy = () => { busyRef.current = false; setBusy(false); onBusy(false); };
  const complete = (saved: CmsState) => {
    onState(saved);
    setPrepared(null);
    setAlt({ en: "", ar: "", th: "" });
    if (inputRef.current) inputRef.current.value = "";
    resetTransfer();
    onMessage(t.uploadSuccess);
  };
  const readSubmission = () => requestMedia<CmsMediaSubmissionResult>(`/api/cms/media?submissionId=${encodeURIComponent(submissionId.current ?? "")}`);
  const adoptAbandoned = () => {
    staged.current = null;
    submissionId.current = null;
    setPhase("abandoned");
    setTransferError(t.mediaRetriesExhausted);
    onMessage(t.mediaRetriesExhausted, true);
  };
  const chooseFile = async (file?: File) => {
    if (!file || busyRef.current) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size < 1 || file.size > MAX_MEDIA_SOURCE_BYTES) { onMessage(t.imageError, true); return; }
    const request = ++selection.current;
    setPreparing(true);
    try {
      const result = await prepareCmsImage(file);
      if (request !== selection.current) { URL.revokeObjectURL(result.url); return; }
      resetTransfer();
      setPrepared(result);
      onMessage(t.imagePrepared);
    } catch { if (request === selection.current) { if (inputRef.current) inputRef.current.value = ""; onMessage(t.imagePreparationError, true); } }
    finally { if (request === selection.current) setPreparing(false); }
  };
  const finishFailedSubmission = async (notifyFailure = true): Promise<"committed" | "abandoned" | "uncertain"> => {
    setPhase("checking");
    try {
      // The server resolves the commit outcome before touching any file. A
      // missing response is never treated as proof that saving failed.
      const result = await requestMedia<CmsMediaCleanupResult>("/api/cms/media", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionId: submissionId.current }) });
      if (result.status === "committed" && result.state) { complete(result.state); return "committed"; }
      if (result.status !== "abandoned") throw new MediaRequestError();
      staged.current = null;
      submissionId.current = null;
      setPhase("abandoned");
      const text = result.failedIds.length ? t.mediaCleanupPartial : t.mediaRetriesExhausted;
      setTransferError(notifyFailure ? text : "");
      if (notifyFailure || result.failedIds.length) onMessage(text, true);
      return "abandoned";
    } catch {
      setPhase("uncertain");
      setTransferError(t.mediaOutcomeUncertain);
      onMessage(t.mediaOutcomeUncertain, true);
      return "uncertain";
    }
  };
  const failStage = async (stage: "upload" | "save", error: unknown) => {
    const code = error instanceof MediaRequestError ? error.code : undefined;
    let text = code === "MEDIA_IN_TRASH" ? t.mediaInTrash : stage === "upload" ? t.uploadError : t.mediaSaveError;
    if (code === "REVISION_CONFLICT") { onConflict(); text = t.conflict; }
    if (counts.current[stage] > MAX_MEDIA_RETRIES) { await finishFailedSubmission(); return; }
    setPhase(stage === "upload" ? "uploadError" : "saveError");
    setTransferError(text);
    if (code !== "REVISION_CONFLICT") onMessage(text, true);
  };
  const saveStaged = async () => {
    if (!staged.current) return;
    counts.current.save += 1;
    setAttempts({ ...counts.current });
    setPhase("saving");
    setTransferError("");
    try {
      const result = await requestMedia<{ state: CmsState }>("/api/cms/media", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionId: submissionId.current, revision: state.revision, uploads: [{ id: staged.current.id, alt: { en: alt.en.trim(), ar: alt.ar.trim(), th: alt.th.trim() } }] }) });
      if (!result.state) throw new MediaRequestError();
      complete(result.state);
    } catch (error) {
      setPhase("checking");
      try {
        const result = await readSubmission();
        if (result.status === "committed" && result.state) { complete(result.state); return; }
        if (result.status === "abandoned") { adoptAbandoned(); return; }
      } catch { /* Keep the upload until the server can establish the outcome. */ }
      await failStage("save", error);
    }
  };
  const submit = async () => {
    if (!prepared || preparing || busyRef.current) return;
    if (dirty) { onMessage(t.mediaUnsaved, true); return; }
    if (!alt.ar.trim() || !alt.th.trim() || !alt.en.trim()) { onMessage(t.mediaAltRequired, true); return; }
    if (phase === "uncertain") return;
    beginBusy();
    try {
      if (phase === "abandoned") resetTransfer();
      submissionId.current ??= crypto.randomUUID();
      // Persist the identifier before the first network write. Retrying after a
      // reload will reconcile this exact submission instead of creating another.
      if (recoveryScope && recoveryOwner) {
        await checkpointQueue.current;
        await writeCheckpoint(`${recoveryScope}:media`, recoveryOwner, { file: prepared.file, width: prepared.width, height: prepared.height, alt, submissionId: submissionId.current, staged: staged.current, attempts: counts.current, phase: "checking" } satisfies MediaCheckpoint).catch(() => setRecoveryError(true));
      }
      if (!staged.current) {
        // A timed-out response can conceal a successful upload. Resolve it
        // before retrying, so a successful file is never uploaded twice.
        if (counts.current.upload > 0) {
          setPhase("checking");
          try {
            const previous = await readSubmission();
            if (previous.status === "committed" && previous.state) { complete(previous.state); return; }
            if (previous.status === "abandoned") { adoptAbandoned(); return; }
            staged.current = previous.uploads[0] ?? null;
          } catch { /* The same submission ID makes upload retries idempotent. */ }
        }
        if (!staged.current) {
          counts.current.upload += 1;
          setAttempts({ ...counts.current });
          setPhase("uploading");
          setTransferError("");
          const data = new FormData();
          data.append("submissionId", submissionId.current);
          data.append("file", prepared.file);
          try {
            const result = await requestMedia<{ upload: CmsStagedUpload }>("/api/cms/media", { method: "POST", body: data });
            if (!result.upload?.id) throw new MediaRequestError();
            staged.current = result.upload;
          } catch (error) {
            setPhase("checking");
            try {
              const result = await readSubmission();
              if (result.status === "committed" && result.state) { complete(result.state); return; }
              if (result.status === "abandoned") { adoptAbandoned(); return; }
              staged.current = result.uploads[0] ?? null;
            } catch { /* A later retry or safe cleanup resolves this submission. */ }
            if (!staged.current) { await failStage("upload", error); return; }
          }
        }
      }
      await saveStaged();
    } finally { endBusy(); }
  };
  const resolveOutcome = async () => {
    if (busyRef.current || !submissionId.current) return;
    beginBusy();
    try { await finishFailedSubmission(); }
    finally { endBusy(); }
  };
  const clearSelection = async () => {
    if (busyRef.current) return;
    if (submissionId.current) {
      beginBusy();
      try { if (await finishFailedSubmission(false) !== "abandoned") return; }
      finally { endBusy(); }
    }
    selection.current += 1;
    setPrepared(null);
    setPreparing(false);
    resetTransfer();
    if (inputRef.current) inputRef.current.value = "";
  };
  const cleanup = async () => {
    if (busyRef.current || prepared || preparing || alt.ar || alt.th || alt.en) return;
    if (!await confirm({ title: t.mediaCleanup, body: t.mediaCleanupConfirm, label: t.mediaCleanup })) return;
    beginBusy(); setCleanupBusy(true);
    try {
      const result = await requestMedia<Omit<CmsMediaCleanupResult, "status">>("/api/cms/media/cleanup", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      onMessage(`${result.failedIds.length ? t.mediaCleanupPartial : t.mediaCleanupSuccess} (${result.deletedIds.length})`, result.failedIds.length > 0);
    } catch { onMessage(t.mediaCleanupError, true); }
    finally { setCleanupBusy(false); endBusy(); }
  };
  const remove = async (media: Media) => {
    if (busyRef.current) return;
    if (dirty) { onMessage(t.mediaUnsaved, true); return; }
    if (!await confirm({ title: t.moveToTrash, body: t.trashMediaConfirm, label: t.moveToTrash, destructive: true })) return;
    beginBusy();
    try {
      const response = await fetch("/api/cms/media", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: state.revision, id: media.id }) });
      const result = await response.json();
      if (!response.ok || !result.state) { if (result.code === "REVISION_CONFLICT") onConflict(); else onMessage(result.code?.includes("REFERENCE") || response.status === 409 ? t.referencedImage : t.saveError, true); return; }
      onState(result.state); onMessage(t.trashMoved);
    } catch { onMessage(t.requestError, true); }
    finally { endBusy(); }
  };
  const update = (media: Media, language: Locale, text: string) => onDraft({ ...content, media: content.media.map((entry) => entry.id === media.id ? { ...entry, alt: { ...entry.alt, [language]: text } } : entry) });
  const uploaded = content.media.filter((media) => `${media.name} ${media.alt.ar} ${media.alt.th} ${media.alt.en}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const existing = imageOptions(content, locale).filter((image) => !image.uploaded && `${image.name} ${image.src}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const transferring = phase === "uploading" || phase === "saving" || phase === "checking";
  const metadataLocked = phase !== "ready" && phase !== "abandoned";
  const phaseText = phase === "uploading" ? t.mediaUploading : phase === "saving" ? t.mediaSaving : phase === "checking" ? t.mediaChecking : prepared ? t.mediaReady : t.mediaPrepareFirst;
  const submitText = phase === "uploadError" ? t.mediaRetryUpload : phase === "saveError" ? t.mediaRetrySave : phase === "abandoned" ? t.mediaStartAgain : t.upload;
  return <div className={styles.form}>{recoveryCandidate && <section className={styles.panel} aria-label={locale === "ar" ? cmsArabicUi["Recover prepared image"] : locale === "th" ? "กู้คืนภาพ" : "Recover prepared image"}><h2>{locale === "ar" ? cmsArabicUi["A prepared image is available"] : locale === "th" ? "พบภาพที่เตรียมไว้" : "A prepared image is available"}</h2><p>{locale === "ar" ? cmsArabicUi["Recover your image and descriptions to continue. Images upload only after you submit."] : locale === "th" ? "กู้คืนภาพและคำอธิบายเพื่อดำเนินการต่อ ภาพจะอัปโหลดเมื่อกดส่งเท่านั้น" : "Recover your image and descriptions to continue. Images upload only after you submit."}</p><button type="button" className={styles.button} onClick={recoverImage}>{locale === "ar" ? cmsArabicUi["Recover image"] : locale === "th" ? "กู้คืนภาพ" : "Recover image"}</button><button type="button" className={styles.button} onClick={async () => { if (!await confirm({ title: locale === "ar" ? cmsArabicUi["Discard image recovery?"] : locale === "th" ? "ทิ้งสำเนาภาพ?" : "Discard image recovery?", body: locale === "ar" ? cmsArabicUi["Remove this browser copy. Use Cleanup for uploaded files confirmed unreferenced."] : locale === "th" ? "ลบเฉพาะสำเนาในเบราว์เซอร์ ใช้ปุ่ม Cleanup เพื่อจัดการไฟล์ที่อัปโหลดแล้วและไม่มีการอ้างอิง" : "Remove this browser copy. Use Cleanup for uploaded files confirmed unreferenced.", destructive: true })) return; if (recoveryScope) await deleteCheckpoint(recoveryScope + ":media"); setRecoveryCandidate(null); }}>{locale === "ar" ? cmsArabicUi["Discard recovery"] : locale === "th" ? "ทิ้งสำเนา" : "Discard recovery"}</button></section>}{recoveryError && <p role="alert">{locale === "ar" ? cmsArabicUi["Browser image recovery is unavailable. Keep this page open until saving finishes."] : locale === "th" ? "ไม่สามารถเก็บสำเนาภาพในเบราว์เซอร์ได้ กรุณาอย่าปิดหน้าจนกว่าจะบันทึกสำเร็จ" : "Browser image recovery is unavailable. Keep this page open until saving finishes."}</p>}<form inert={!!recoveryCandidate} className={styles.split} onSubmit={(event) => { event.preventDefault(); void submit(); }} aria-busy={preparing || busy}><section className={styles.panel}><h2>{t.uploadImage}</h2>
    {!prepared ? <label className={styles.uploadTarget}><Upload aria-hidden="true" /><span>{t.selectFile}</span><span>{t.imageFormats}</span><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || preparing} onChange={(event) => void chooseFile(event.target.files?.[0])} /></label> : <><div className={styles.uploadPreview}><Image src={prepared.url} alt={alt[locale] || prepared.file.name} width={prepared.width} height={prepared.height} unoptimized /></div><p className={styles.hint}>{prepared.file.name}</p><div className={styles.fileMeta}><span>{prepared.width} × {prepared.height}</span><span>{(prepared.file.size / 1024 / 1024).toFixed(2)} MB</span><span>{prepared.file.type.replace("image/", "").toUpperCase()}</span></div><button type="button" className={styles.button} disabled={busy || phase === "uncertain"} onClick={() => void clearSelection()}><X aria-hidden="true" />{t.clearSelection}</button></>}
    {preparing && <p className={styles.progress} role="status"><LoaderCircle aria-hidden="true" />{t.imagePreparing}</p>}
  </section><section className={styles.panel}><h2>{t.mediaMetadata}</h2><p className={styles.hint}>{t.altHelp}</p><div className={styles.form}>{locales.map((language) => <label className={styles.field} key={language}><span>{localeSettings(language).label}</span><textarea lang={language} dir={localeSettings(language).direction} value={alt[language]} maxLength={500} disabled={busy || metadataLocked} onChange={(event) => setAlt({ ...alt, [language]: event.target.value })} /></label>)}
    <div className={styles.transferStatus} role="status" aria-live="polite" data-error={!!transferError}><div className={styles.transferHeading}>{transferring ? <LoaderCircle className={styles.progress} aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}<span>{transferError || phaseText}</span></div>{(attempts.upload > 0 || attempts.save > 0) && <div className={styles.transferAttempts}><span>{t.mediaUploadAttempt}: {attempts.upload}/{MAX_MEDIA_RETRIES + 1}</span><span>{t.mediaSaveAttempt}: {attempts.save}/{MAX_MEDIA_RETRIES + 1}</span></div>}<p className={styles.hint}>{phase === "saveError" ? t.mediaSaveRetryHelp : phase === "uncertain" ? t.mediaUncertainHelp : t.mediaSubmitHelp}</p></div>
    {phase === "uncertain" ? <button className="button" type="button" disabled={busy} onClick={() => void resolveOutcome()}><RefreshCw aria-hidden="true" />{t.mediaCheckStatus}</button> : <button className="button" type="submit" disabled={!prepared || busy || preparing}>{transferring ? <LoaderCircle className={styles.progress} aria-hidden="true" /> : phase === "uploadError" || phase === "saveError" || phase === "abandoned" ? <RefreshCw aria-hidden="true" /> : <Upload aria-hidden="true" />}{transferring ? phaseText : submitText}</button>}{dirty && <p className={styles.hint}>{t.mediaUnsaved}</p>}</div></section></form>
    <section className={`${styles.panel} ${styles.cleanupPanel}`}><div><h2>{t.mediaCleanup}</h2><p className={styles.hint}>{t.mediaCleanupHelp}</p></div><button className={styles.button} type="button" disabled={busy || preparing || !!prepared || !!alt.ar || !!alt.th || !!alt.en || dirty} onClick={() => void cleanup()}>{cleanupBusy ? <LoaderCircle className={styles.progress} aria-hidden="true" /> : <Trash2 aria-hidden="true" />}{cleanupBusy ? t.mediaCleaning : t.mediaCleanup}</button></section>
    <section className={styles.panel}><label className={styles.field}><span>{t.search}</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label><h2>{t.uploadedImages}</h2>{uploaded.length === 0 && <p className={styles.empty}>{content.media.length === 0 ? t.noMedia : t.emptySearch}</p>}<div className={styles.mediaGrid}>{uploaded.map((media) => <article className={styles.mediaCard} key={media.id}><div className={styles.imageFrame}><Image src={media.src} alt={media.alt[locale]} fill unoptimized sizes="16rem" /></div><p>{media.name}</p><p className={styles.hint}>{media.width} × {media.height} · {(media.bytes / 1024).toFixed(0)} KB</p><div className={styles.toolbar}><button className={styles.button} type="button" disabled={busy} onClick={() => setEditing(editing === media.id ? null : media.id)}><Pencil aria-hidden="true" />{t.edit}</button><button className={`${styles.iconButton} ${styles.danger}`} type="button" disabled={busy} aria-label={`${t.moveToTrash} ${media.name}`} title={t.moveToTrash} onClick={() => void remove(media)}><Trash2 aria-hidden="true" /></button></div>{editing === media.id && <>{locales.map((language) => <label className={styles.field} key={language}><span>{localeSettings(language).label}</span><textarea lang={language} dir={localeSettings(language).direction} value={media.alt[language]} maxLength={500} onChange={(event) => update(media, language, event.target.value)} /></label>)}<p className={styles.hint}>{t.unsaved}</p></>}</article>)}</div></section>
    <section className={styles.panel}><h2>{t.existingImages}</h2><div className={styles.mediaGrid}>{existing.map((image) => <article className={styles.mediaCard} key={image.src}><div className={styles.imageFrame}><Image src={image.src} alt={image.name} fill unoptimized sizes="16rem" /></div><p>{image.name}</p><p className={styles.hint}>{image.src}</p><ImageIcon aria-hidden="true" /></article>)}</div></section>
    {confirmation}
  </div>;
}

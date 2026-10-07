"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Archive, ChevronLeft, ChevronRight, Plus, RefreshCw, Save, Send, X } from "lucide-react";
import { usePublished } from "./PublishedProvider";
import { CmsDialog } from "./CmsDialog";
import { useCmsConfirm } from "./CmsConfirm";
import { sharedOperationsCopy } from "@/content/shared-operations";
import { workflowCopy } from "@/content/workflow";
import { mockCheckoutCopy } from "@/content/mock-checkout";
import { staffCopy } from "@/content/staff";
import { operationsCopy } from "@/content/cms-operations";
import { formatPrice, MAX_QUANTITY } from "@/lib/catalog";
import { orderTransitions, type OrderStage } from "@/lib/commerce-workflow";
import { demoStatuses, type DemoStatus } from "@/lib/demo-types";
import type { Locale } from "@/lib/i18n";
import type { OperationsNotice, OperationsRequest, OperationsSettings } from "@/lib/operations/types";
import styles from "./SharedOperations.module.css";

type View = "orders" | "messages" | "customers" | "notifications";
type Inbox = { records: OperationsRequest[]; notices: OperationsNotice[]; total: number; page: number; pageSize: number; owner: boolean; settings: OperationsSettings };
type Result = { record: OperationsRequest | null; notice: OperationsNotice | null; settings: OperationsSettings | null };
class OperationsClientError extends Error { constructor(readonly code: string) { super(code); } }
async function api(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.any([AbortSignal.timeout(15000), ...(init?.signal ? [init.signal] : [])]), cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new OperationsClientError(body.code || "UNAVAILABLE");
  return body;
}
function errorText(error: unknown, locale: Locale) {
  const t = sharedOperationsCopy[locale], code = error instanceof OperationsClientError ? error.code : "";
  return code === "OPERATIONS_CONFLICT" ? t.conflict : ["UNAUTHENTICATED", "FORBIDDEN"].includes(code) ? t.unauthorized : code === "OPERATIONS_STOCK" ? t.stockError : t.failed;
}
function useCommand() {
  const previous = useRef<{ payload: string; key: string } | null>(null);
  return async (body: Record<string, unknown>): Promise<Result> => {
    const payload = JSON.stringify(body);
    if (previous.current?.payload !== payload) previous.current = { payload, key: crypto.randomUUID() };
    return api("/api/cms/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, key: previous.current.key }) });
  };
}
const date = (value: string, locale: Locale) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

function RequestDetails({ record, locale, owner, done, history, close, onDirtyChange }: { record: OperationsRequest; locale: Locale; owner: boolean; done: (record: OperationsRequest) => void; history: (email: string) => void; close: () => void; onDirtyChange: (dirty: boolean) => void }) {
  const t = sharedOperationsCopy[locale], w = workflowCopy[locale], m = mockCheckoutCopy[locale], c = staffCopy[locale], { products } = usePublished(), command = useCommand();
  const [notes, setNotes] = useState(record.notes), [assignedTo, setAssignedTo] = useState(record.assignedTo || ""), [status, setStatus] = useState(record.status);
  const [stage, setStage] = useState<OrderStage | "">(""), [carrier, setCarrier] = useState(record.order?.carrier || ""), [tracking, setTracking] = useState(record.order?.tracking || ""), [restock, setRestock] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const dirty = notes !== record.notes || assignedTo !== (record.assignedTo || "") || status !== record.status || Boolean(stage) || carrier !== (record.order?.carrier || "") || tracking !== (record.order?.tracking || "");
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  async function mutate(body: Record<string, unknown>) {
    if (busy) return; setBusy(true); setError("");
    try { const result = await command({ ...body, id: record.id, revision: record.revision }); if (result.record) done(result.record); }
    catch (reason) { setError(errorText(reason, locale)); }
    finally { setBusy(false); }
  }
  const current = record.order?.stage || "enquiry";
  return <section className={styles.detail}>
    <header className={styles.header}><div><p>{record.reference} · {t.revision} {record.revision}</p><h2>{record.name}</h2><p>{t.sourceLabels[record.source]}</p></div><button type="button" className={styles.icon} aria-label={t.close} onClick={close} disabled={busy}><X aria-hidden="true" /></button></header>
    <dl className={styles.facts}><div><dt>{t.email}</dt><dd>{record.email}</dd></div>{record.phone && <div><dt>{c.phone}</dt><dd>{record.phone}</dd></div>}<div><dt>{c.received}</dt><dd>{date(record.createdAt, locale)}</dd></div>{record.customer?.address && <div><dt>{c.address}</dt><dd>{["address", "district", "province", "postcode"].map((key) => record.customer?.[key]).filter(Boolean).join(", ")}</dd></div>}{record.message && <div><dt>{t.message}</dt><dd>{record.message}</dd></div>}
      {record.wholesale && <><div><dt>{w.product}</dt><dd>{products.find((product) => product.id === record.wholesale!.productId)?.name[locale] || record.wholesale.productId}</dd></div><div><dt>{w.quantity}</dt><dd>{record.wholesale.quantity}</dd></div><div><dt>{w.business}</dt><dd>{record.wholesale.business}</dd></div><div><dt>{w.destination}</dt><dd>{record.wholesale.destination}</dd></div>{record.wholesale.neededBy && <div><dt>{w.neededBy}</dt><dd>{record.wholesale.neededBy}</dd></div>}</>}
    </dl><button className={styles.quiet} type="button" onClick={() => history(record.email)} disabled={busy || dirty}>{t.emailHistory}</button>
    {record.items?.map((item) => <p key={item.id}>{products.find((product) => product.id === item.id)?.name[locale] || item.id} × {item.quantity} · {formatPrice(item.quantity * item.unitPrice, locale)}</p>)}
    {record.subtotal !== undefined && <p><strong>{formatPrice(record.subtotal, locale)}</strong>{record.shippingQuote?.state !== "quoted" && <> · {m.pendingNote}</>}</p>}
    {record.shippingQuote?.state === "quoted" && <p>{m.shipping}: {formatPrice(record.shippingQuote.fee, locale)} · {m.total}: {formatPrice(record.shippingQuote.total, locale)}</p>}
    <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void mutate({ action: "update", patch: { status, notes, assignedTo } }); }}><fieldset disabled={busy}>
      <label>{c.status}<select value={status} onChange={(event) => setStatus(event.target.value as DemoStatus)}>{demoStatuses.map((value) => <option key={value} value={value}>{c.statuses[value]}</option>)}</select></label><label>{w.assignedTo}<input value={assignedTo} maxLength={100} onChange={(event) => setAssignedTo(event.target.value)} /></label><label>{t.notes}<textarea rows={4} value={notes} maxLength={5000} onChange={(event) => setNotes(event.target.value)} /></label><button type="submit" className={styles.primary}><Save aria-hidden="true" />{t.save}</button>
    </fieldset></form>
    {record.kind === "order" && <section className={styles.panel}><h3>{w.workflow}</h3><p>{w.stages[current]}</p><p>{w.mockNote}</p><p>{t.stock}: {t.stockStates[record.stockState]}</p>{record.stockExpiresAt && <p>{t.expires}: {date(record.stockExpiresAt, locale)}</p>}{record.order?.tracking && <p>{record.order.carrier} · {record.order.tracking}</p>}
      {owner && !record.archived && orderTransitions[current].length > 0 && <form className={styles.form} onSubmit={(event) => { event.preventDefault(); if (stage) void mutate({ action: "transition", stage, carrier, tracking, ...(stage === "refunded" ? { restock } : {}) }); }}><fieldset disabled={busy}>
        <label>{w.nextStage}<select required value={stage} onChange={(event) => setStage(event.target.value as OrderStage)}><option value="">—</option>{orderTransitions[current].map((value) => <option key={value} value={value}>{w.stages[value]}</option>)}</select></label>
        {stage === "shipped" && <><label>{w.carrier}<input required maxLength={100} value={carrier} onChange={(event) => setCarrier(event.target.value)} /></label><label>{w.tracking}<input dir="ltr" required maxLength={100} value={tracking} onChange={(event) => setTracking(event.target.value)} /></label></>}
        {stage === "refunded" && ["shipped", "delivered"].includes(current) && <label className={styles.checkbox}><input type="checkbox" checked={restock} onChange={(event) => setRestock(event.target.checked)} />{m.restock}</label>}
        <button className={styles.primary} type="submit" disabled={!stage}>{w.applyStage}</button>
      </fieldset></form>}{!owner && <p>{t.ownerOnly}</p>}</section>}
    <section className={styles.panel}><h3>{t.activity}</h3><ol className={styles.activity}>{[...record.activity || []].reverse().map((event) => <li key={event.id}><strong>{event.action === "order-transition" ? w.orderTransition : event.action === "request-created" ? w.requestCreated : w.requestUpdated}</strong><span>{event.detail.split(/ → |, /).map((part) => w.stages[part as OrderStage] || w.fieldNames[part as keyof typeof w.fieldNames] || (part === "archive" ? t.archive : part === "restore" ? t.restore : "")).filter(Boolean).join(event.action === "order-transition" ? " → " : ", ")}</span><span>{event.actor} · {date(event.at, locale)}</span></li>)}</ol></section>
    <p>{t.archiveNote}</p><button type="button" className={styles.quiet} disabled={busy || dirty} onClick={() => void mutate({ action: record.archived ? "restore" : "archive" })}><Archive aria-hidden="true" />{record.archived ? t.restore : t.archive}</button>
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </section>;
}

function NewTestRequest({ locale, done, onDirtyChange }: { locale: Locale; done: () => void; onDirtyChange: (dirty: boolean) => void }) {
  const t = sharedOperationsCopy[locale], c = staffCopy[locale], { products } = usePublished(), command = useCommand();
  const [values, setValues] = useState({ kind: "contact", name: "", email: "", message: "", productId: products[0]?.id || "", quantity: "1", postcode: "" });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const dirty = values.kind !== "contact" || Boolean(values.name || values.email || values.message || values.postcode) || values.quantity !== "1";
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  const update = (field: keyof typeof values, value: string) => setValues((current) => ({ ...current, [field]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    try { await command({ action: "create", input: { kind: values.kind, name: values.name, email: values.email, message: values.message, locale, ...(values.kind === "order" ? { items: [{ id: values.productId, quantity: Number(values.quantity), unitPrice: 0 }], customer: { postcode: values.postcode }, payment: "enquiry" } : {}) } }); done(); }
    catch (reason) { setError(errorText(reason, locale)); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className={styles.form}><h2>{t.add}</h2><p>{t.testNote}</p><fieldset disabled={busy}><label>{t.kind}<select value={values.kind} onChange={(event) => update("kind", event.target.value)}><option value="contact">{c.kinds.contact}</option><option value="order">{c.kinds.order}</option></select></label>
    <label>{t.name}<input required maxLength={100} value={values.name} onChange={(event) => update("name", event.target.value)} /></label><label>{t.email}<input required type="email" maxLength={254} value={values.email} onChange={(event) => update("email", event.target.value)} /></label><label>{t.message}<textarea maxLength={5000} rows={4} value={values.message} onChange={(event) => update("message", event.target.value)} /></label>
    {values.kind === "order" && <><label>{t.product}<select required value={values.productId} onChange={(event) => update("productId", event.target.value)}>{products.map((product) => <option key={product.id} value={product.id}>{product.name[locale]}</option>)}</select></label><label>{t.quantity}<input type="number" required min={1} max={MAX_QUANTITY} value={values.quantity} onChange={(event) => update("quantity", event.target.value)} /></label><label>{t.postcode}<input dir="ltr" pattern="[0-9]{5}" maxLength={5} value={values.postcode} onChange={(event) => update("postcode", event.target.value)} /></label></>}
    <button className={styles.primary} type="submit">{t.submit}</button></fieldset>{error && <p className={styles.error} role="alert">{error}</p>}</form>;
}

function Notice({ notice, locale, owner, done }: { notice: OperationsNotice; locale: Locale; owner: boolean; done: () => void }) {
  const t = sharedOperationsCopy[locale], w = workflowCopy[locale], command = useCommand();
  const [outcome, setOutcome] = useState("success"), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function deliver() { if (busy) return; setBusy(true); setError(""); try { await command({ action: notice.state === "processing" ? "resolve-notice" : "deliver", id: notice.id, revision: notice.revision, ...(notice.state === "processing" ? {} : { outcome }) }); done(); } catch (reason) { setError(errorText(reason, locale)); } finally { setBusy(false); } }
  return <details className={styles.panel}><summary><strong>{notice.subject}</strong><span>{t.states[notice.state]}</span></summary><p>{notice.recipient}</p><p>{t.attempts}: {notice.attempts} / 3</p><pre>{notice.body}</pre>{notice.receiptId && <p>{t.receipt}: {notice.receiptId}</p>}
    {owner && !["mock-delivered", "exhausted"].includes(notice.state) && <div className={styles.form}>{notice.state !== "processing" && <label>{w.outcome}<select value={outcome} disabled={busy} onChange={(event) => setOutcome(event.target.value)}><option value="success">{w.success}</option><option value="failure">{w.failure}</option></select></label>}<button className={styles.primary} type="button" disabled={busy} onClick={() => void deliver()}><Send aria-hidden="true" />{notice.state === "processing" ? t.resolve : t.deliver}</button></div>}{error && <p className={styles.error} role="alert">{error}</p>}
  </details>;
}

function ShippingSettings({ locale, settings, done, onDirtyChange }: { locale: Locale; settings: OperationsSettings; done: () => void; onDirtyChange: (dirty: boolean) => void }) {
  const t = mockCheckoutCopy[locale], s = sharedOperationsCopy[locale], command = useCommand();
  const [rules, setRules] = useState(() => settings.shippingRules.map((rule) => ({ ...rule, fee: String(rule.fee), freeOver: rule.freeOver === null ? "" : String(rule.freeOver) })));
  const [baseline] = useState(JSON.stringify(rules)), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const dirty = JSON.stringify(rules) !== baseline;
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  const update = (id: string, field: string, value: string) => setRules((current) => current.map((rule) => rule.id === id ? { ...rule, [field]: value } : rule));
  return <details className={styles.panel}><summary>{s.settings}</summary><p>{s.intro}</p><p>{t.prefixHint}</p><form className={styles.form} onSubmit={async (event) => { event.preventDefault(); if (busy) return; setBusy(true); setError(""); try { await command({ action: "shipping", revision: settings.revision, rules: rules.map((rule) => ({ ...rule, fee: rule.fee.trim() ? Number(rule.fee) : NaN, freeOver: rule.freeOver.trim() ? Number(rule.freeOver) : null })) }); done(); } catch (reason) { setError(errorText(reason, locale)); } finally { setBusy(false); } }}><fieldset disabled={busy}>
    {!rules.length && <p>{t.empty}</p>}{rules.map((rule) => <div key={rule.id} className={styles.rule}><label>{t.label}<input required maxLength={100} value={rule.label} onChange={(event) => update(rule.id, "label", event.target.value)} /></label><label>{t.prefix}<input dir="ltr" required maxLength={5} pattern="\*|[0-9]{1,5}" value={rule.postcodePrefix} onChange={(event) => update(rule.id, "postcodePrefix", event.target.value)} /></label><label>{t.fee}<input required type="number" min={0} max={1000000} step="0.01" value={rule.fee} onChange={(event) => update(rule.id, "fee", event.target.value)} /></label><label>{t.freeOver}<input type="number" min={0} max={1000000} step="0.01" value={rule.freeOver} onChange={(event) => update(rule.id, "freeOver", event.target.value)} /></label><button className={styles.quiet} type="button" onClick={() => setRules((current) => current.filter((entry) => entry.id !== rule.id))}>{t.remove}</button></div>)}
    <div className={styles.actions}><button type="button" className={styles.quiet} disabled={rules.length >= 20} onClick={() => setRules((current) => [...current, { id: crypto.randomUUID(), label: "", postcodePrefix: "", fee: "", freeOver: "" }])}><Plus aria-hidden="true" />{t.add}</button><button className={styles.primary} type="submit" disabled={!dirty}>{t.save}</button></div>
  </fieldset>{error && <p className={styles.error} role="alert">{error}</p>}</form></details>;
}

export default function SharedOperations({ locale, view, onDirtyChange }: { locale: Locale; view: View; onDirtyChange?: (dirty: boolean) => void }) {
  const t = sharedOperationsCopy[locale], c = staffCopy[locale], w = workflowCopy[locale];
  const [data, setData] = useState<Inbox | null>(null), [query, setQuery] = useState(""), [debounced, setDebounced] = useState(""), [page, setPage] = useState(1), [revision, setRevision] = useState(0);
  const [kind, setKind] = useState("all"), [status, setStatus] = useState("all"), [assignment, setAssignment] = useState("all"), [archived, setArchived] = useState(false), [email, setEmail] = useState("");
  const [record, setRecord] = useState<OperationsRequest | null>(null), [creating, setCreating] = useState(false), [loadingDetail, setLoadingDetail] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [feedback, setFeedback] = useState("");
  const [dirty, setDirty] = useState(false), [settingsDirty, setSettingsDirty] = useState(false), { confirm, confirmation } = useCmsConfirm(locale);
  useEffect(() => { onDirtyChange?.(dirty || settingsDirty); return () => onDirtyChange?.(false); }, [dirty, settingsDirty, onDirtyChange]);
  useEffect(() => { const timer = setTimeout(() => setDebounced(query), 200); return () => clearTimeout(timer); }, [query]);
  useEffect(() => {
    const controller = new AbortController(), params = new URLSearchParams({ view: view === "notifications" ? "outbox" : "requests", q: debounced, page: String(page), kind: view === "orders" ? "order" : kind, status, assignment, archived: String(archived), email });
    void api(`/api/cms/operations?${params}`, { signal: controller.signal }).then((value: Inbox) => { setData(value); setError(""); }).catch((reason) => { if (!controller.signal.aborted) setError(errorText(reason, locale)); });
    return () => controller.abort();
  }, [view, debounced, page, kind, status, assignment, archived, email, revision, locale]);
  const reload = () => setRevision((value) => value + 1);
  async function sync() { if (busy || settingsDirty) return; setBusy(true); setError(""); try { const result = await api("/api/cms/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sync" }) }); setFeedback(!result.configured ? t.noSource : result.remaining ? t.pendingImports : t.synced); reload(); } catch (reason) { setError(errorText(reason, locale)); } finally { setBusy(false); } }
  async function open(id: string) { setLoadingDetail(true); setError(""); try { const result = await api(`/api/cms/operations?id=${encodeURIComponent(id)}`); setRecord(result.record); } catch (reason) { setError(errorText(reason, locale)); } finally { setLoadingDetail(false); } }
  async function close() { if (dirty && !await confirm({ title: operationsCopy[locale].unsavedTitle, body: operationsCopy[locale].discardBody, label: operationsCopy[locale].discard, destructive: true })) return; setRecord(null); setCreating(false); setDirty(false); }
  return <div className={styles.workspace}><p>{t.intro}</p><p className={styles.note}>{t.sourceNote}</p><div className={styles.actions}><button className={styles.quiet} type="button" disabled={busy || settingsDirty} onClick={() => void sync()}><RefreshCw aria-hidden="true" />{t.refresh}</button>{data?.owner && view !== "notifications" && <button type="button" className={styles.primary} onClick={() => setCreating(true)}><Plus aria-hidden="true" />{t.add}</button>}</div>
    {view === "orders" && data?.owner && <ShippingSettings key={data.settings.revision} locale={locale} settings={data.settings} done={() => { setSettingsDirty(false); reload(); setFeedback(t.saved); }} onDirtyChange={setSettingsDirty} />}
    <div className={styles.filters}><input type="search" maxLength={100} aria-label={t.search} placeholder={t.search} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />{view !== "notifications" && <><select aria-label={t.kind} disabled={view === "orders"} value={view === "orders" ? "order" : kind} onChange={(event) => { setKind(event.target.value); setPage(1); }}><option value="all">{w.allRequests}</option>{(["contact", "wholesale", "order", "newsletter"] as const).map((value) => <option key={value} value={value}>{c.kinds[value]}</option>)}</select><select aria-label={c.status} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="all">{t.filters}</option>{demoStatuses.map((value) => <option value={value} key={value}>{c.statuses[value]}</option>)}</select><select aria-label={w.assignedTo} value={assignment} onChange={(event) => { setAssignment(event.target.value); setPage(1); }}><option value="all">{w.allAssignees}</option><option value="assigned">{w.assigned}</option><option value="unassigned">{w.unassigned}</option></select><select aria-label={t.archived} value={String(archived)} onChange={(event) => { setArchived(event.target.value === "true"); setPage(1); }}><option value="false">{t.active}</option><option value="true">{t.archived}</option></select></>}</div>
    {email && <button type="button" className={styles.quiet} onClick={() => { setEmail(""); setPage(1); }}>{t.clearEmail}: {email}</button>}
    {error && <p className={styles.error} role="alert">{error}</p>}<p role="status">{feedback || (loadingDetail ? t.loadingDetail : !data ? t.load : "")}</p>
    {data && (view === "notifications" ? data.notices.map((notice) => <Notice key={`${notice.id}-${notice.revision}`} notice={notice} locale={locale} owner={data.owner} done={reload} />) : data.records.map((entry) => <button className={styles.record} type="button" key={entry.id} disabled={loadingDetail} onClick={() => void open(entry.id)}><span><strong>{entry.name}</strong><span>{entry.reference} · {c.kinds[entry.kind]}</span><span>{entry.email}</span><span>{entry.assignedTo || w.unassigned}</span></span><span>{c.statuses[entry.status]}</span><ChevronRight aria-hidden="true" /></button>))}
    {data?.total === 0 && <p className={styles.empty}>{t.empty}</p>}{data && data.total > data.pageSize && <nav className={styles.pagination} aria-label={t.page}><button type="button" className={styles.icon} aria-label={t.previous} disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft aria-hidden="true" /></button><span>{t.page} {page} / {Math.ceil(data.total / data.pageSize)}</span><button type="button" className={styles.icon} aria-label={t.next} disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}><ChevronRight aria-hidden="true" /></button></nav>}
    {(record || creating) && <CmsDialog label={record?.reference || t.add} className={styles.dialog} onClose={() => void close()}>{creating ? <NewTestRequest locale={locale} done={() => { setCreating(false); setDirty(false); setFeedback(t.saved); reload(); }} onDirtyChange={setDirty} /> : record && <RequestDetails key={`${record.id}-${record.revision}`} record={record} locale={locale} owner={data?.owner || false} done={(updated) => { setRecord(updated); setDirty(false); setFeedback(t.saved); reload(); }} history={(customerEmail) => { if (!dirty) { setEmail(customerEmail); setPage(1); setRecord(null); } }} close={() => void close()} onDirtyChange={setDirty} />}</CmsDialog>}{confirmation}
  </div>;
}

"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, Copy, Download, Inbox, Mail, MessageSquare, Plus, Save, ShoppingBag, Trash2, Users, X } from "lucide-react";
import { useDemo } from "@/components/demo/DemoProvider";
import { useStore } from "@/components/commerce/StoreProvider";
import { staffCopy } from "@/content/staff";
import { operationsCopy } from "@/content/cms-operations";
import { workflowCopy } from "@/content/workflow";
import { sharedOperationsCopy } from "@/content/shared-operations";
import { NotificationDelivery, RequestWorkflow } from "@/components/demo/RequestWorkflow";
import { formatPrice, MAX_QUANTITY } from "@/lib/catalog";
import { demoStatuses, type DemoInput, type DemoRecord, type DemoStatus } from "@/lib/demo-types";
import type { Locale } from "@/lib/i18n";
import { CmsDialog } from "./CmsDialog";
import { useCmsConfirm } from "./CmsConfirm";
import styles from "./CmsOperations.module.css";

type View = "orders" | "messages" | "customers" | "notifications";
const SharedOperations = dynamic(() => import("./SharedOperations"));
const PaidOrders = dynamic(() => import("./PaidOrders").then((module) => module.PaidOrders));
export function CmsOperations({ locale, view, onDirtyChange }: { locale: Locale; view: View; onDirtyChange?: (dirty: boolean) => void }) {
  const { enabled } = useDemo(), t = sharedOperationsCopy[locale], c = operationsCopy[locale];
  const [source, setSource] = useState<"shared" | "browser">("shared"), [dirty, setDirty] = useState(false);
  const { confirm, confirmation } = useCmsConfirm(locale);
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  async function change(next: "shared" | "browser") {
    if (next === source || dirty && !await confirm({ title: c.unsavedTitle, body: c.discardBody, label: c.discard, destructive: true })) return;
    setDirty(false); setSource(next);
  }
  return <><div className={styles.actions} role="group" aria-label={t.source}>{(["shared", ...(enabled ? ["browser"] : [])] as const).map((value) => <button type="button" key={value} aria-pressed={source === value} className={source === value ? styles.primary : styles.quiet} onClick={() => void change(value as "shared" | "browser")}>{value === "shared" ? t.shared : t.browser}</button>)}</div>{source === "shared" ? <>{view === "orders" && <PaidOrders locale={locale} />}<SharedOperations locale={locale} view={view} onDirtyChange={setDirty} /></> : <BrowserOperations locale={locale} view={view} onDirtyChange={setDirty} />}{confirmation}</>;
}
function date(value: string, locale: Locale) { return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function downloadCsv(rows: string[][], filename: string) {
  const text = "\uFEFF" + rows.map((row) => row.map((value) => `"${(/^\s*[=+@-]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Details({ record, locale, close, deleted, onDirtyChange }: { record: DemoRecord; locale: Locale; close: () => void; deleted: () => void; onDirtyChange: (dirty: boolean) => void }) {
  const c = staffCopy[locale], t = operationsCopy[locale], w = workflowCopy[locale];
  const { updateRecord, deleteRecord } = useDemo();
  const { products } = useStore();
  const [notes, setNotes] = useState(record.notes), [status, setStatus] = useState(record.status);
  const [assignedTo, setAssignedTo] = useState(record.assignedTo || ""), [workflowDirty, setWorkflowDirty] = useState(false);
  const [feedback, setFeedback] = useState(""), [error, setError] = useState(""), [confirming, setConfirming] = useState(false);
  const dirty = notes !== record.notes || status !== record.status || assignedTo !== (record.assignedTo || "") || workflowDirty;
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  const save = (event: FormEvent) => { event.preventDefault(); try { updateRecord(record.id, { notes, status, assignedTo }); setFeedback(c.saved); setError(""); } catch { setError(t.failed); } };
  return <section className={styles.detail} aria-label={c.details}>
    <header className={styles.detailHeader}><div><span className={styles.kicker}>{record.reference}</span><h2>{record.name}</h2><p>{c.kinds[record.kind]}</p></div><button type="button" className={styles.iconButton} onClick={close} aria-label={t.close}><X aria-hidden="true" /></button></header>
    <dl className={styles.facts}>
      <div><dt>{c.received}</dt><dd>{date(record.createdAt, locale)}</dd></div>
      <div><dt>{c.email}</dt><dd>{record.email}</dd></div>
      {record.phone && <div><dt>{c.phone}</dt><dd>{record.phone}</dd></div>}
      {record.customer?.company && <div><dt>{c.company}</dt><dd>{record.customer.company}</dd></div>}
      {record.customer?.address && <div><dt>{c.address}</dt><dd>{["address", "district", "province", "postcode", "country"].map((key) => record.customer?.[key]).filter(Boolean).join(", ")}</dd></div>}
      {record.message && <div><dt>{c.message}</dt><dd>{record.message}</dd></div>}
    </dl>
    {record.items?.length ? <div className={styles.orderItems}>{record.items.map((item) => <div key={item.id}><span>{products.find((product) => product.id === item.id)?.name[locale] ?? item.id} × {item.quantity}</span><strong>{formatPrice(item.lineTotal ?? item.unitPrice * item.quantity, locale, record.currency ?? "THB")}</strong></div>)}<div className={styles.total}><span>{t.orderValue}</span><strong>{formatPrice(record.subtotal ?? 0, locale, record.currency ?? "THB")}</strong></div><p>{t.totalNote}</p></div> : null}
    {record.payment && <p className={styles.payment}>{c.paymentStates[record.payment]}</p>}
    <form onSubmit={save} className={styles.form}>
      <label>{c.status}<select value={status} onChange={(event) => { setStatus(event.target.value as DemoStatus); setFeedback(""); }}>{demoStatuses.map((state) => <option key={state} value={state}>{c.statuses[state]}</option>)}</select></label>
      <label>{w.assignedTo}<input maxLength={100} value={assignedTo} placeholder={w.unassigned} onChange={(event) => { setAssignedTo(event.target.value); setFeedback(""); }} /></label>
      <label>{c.notes}<textarea rows={5} maxLength={5000} value={notes} onChange={(event) => { setNotes(event.target.value); setFeedback(""); }} placeholder={c.notesPlaceholder} /></label>
      <div className={styles.actions}><button className={styles.primary} type="submit"><Save aria-hidden="true" />{t.save}</button><span role="status">{feedback}</span></div>
    </form>
    <RequestWorkflow record={record} locale={locale} onDirtyChange={setWorkflowDirty} />
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.deleteArea}>{confirming ? <><p>{t.confirmRemove}</p><div className={styles.actions}><button type="button" className={styles.danger} onClick={() => { try { deleteRecord(record.id); deleted(); } catch { setError(t.failed); } }}>{t.confirm}</button><button type="button" className={styles.quiet} onClick={() => setConfirming(false)}>{t.cancel}</button></div></> : <button type="button" className={styles.quiet} onClick={() => setConfirming(true)}><Trash2 aria-hidden="true" />{t.remove}</button>}</div>
  </section>;
}

function NewRecord({ locale, close, created, onDirtyChange }: { locale: Locale; close: () => void; created: () => void; onDirtyChange: (dirty: boolean) => void }) {
  const c = staffCopy[locale], t = operationsCopy[locale], w = workflowCopy[locale];
  const { submit } = useDemo(), { products } = useStore();
  const [kind, setKind] = useState<DemoInput["kind"]>("contact"), [productId, setProductId] = useState(products[0]?.id ?? ""), [error, setError] = useState("");
  const [initialProduct] = useState(productId);
  const [fields, setFields] = useState({ name: "", email: "", phone: "", message: "", quantity: "1", business: "", destination: "", neededBy: "" });
  const dirty = kind !== "contact" || productId !== initialProduct || fields.name !== "" || fields.email !== "" || fields.phone !== "" || fields.message !== "" || fields.quantity !== "1" || fields.business !== "" || fields.destination !== "" || fields.neededBy !== "";
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  const selectedProduct = products.find((product) => product.id === productId);
  const available = selectedProduct && "stock" in selectedProduct && typeof selectedProduct.stock === "number" ? selectedProduct.stock : MAX_QUANTITY;
  const quantityLimit = selectedProduct ? Math.min(MAX_QUANTITY, available) : 0;
  const submission = useRef<{ id: string; payload: string } | null>(null);
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try {
      const product = products.find((entry) => entry.id === productId);
      const input: DemoInput = { kind, locale, name: String(form.get("name") ?? ""), email: String(form.get("email") ?? ""), phone: String(form.get("phone") ?? ""), message: String(form.get("message") ?? ""), ...(kind === "order" && product ? { items: [{ id: product.id, quantity: Number(form.get("quantity")), unitPrice: 0 }], payment: "enquiry" } : {}) };
      if (kind === "wholesale") input.wholesale = { productId, quantity: Number(fields.quantity), business: fields.business, destination: fields.destination, neededBy: fields.neededBy };
      const payload = JSON.stringify(input);
      if (!submission.current || submission.current.payload !== payload) submission.current = { id: crypto.randomUUID(), payload };
      submit(input, submission.current.id); created();
    } catch { setError(t.failed); }
  }
  return <form className={styles.form} onSubmit={save}>
    <h2>{t.add}</h2><label>{c.filter}<select value={kind} onChange={(event) => setKind(event.target.value as DemoInput["kind"])}>{(["contact", "wholesale", "order", "newsletter"] as const).map((value) => <option key={value} value={value}>{c.kinds[value]}</option>)}</select></label>
    <div className={styles.formGrid}><label>{c.customer}<input name="name" required maxLength={100} autoComplete="name" value={fields.name} onChange={(event) => setFields({ ...fields, name: event.target.value })} /></label><label>{c.email}<input name="email" type="email" required maxLength={254} autoComplete="email" value={fields.email} onChange={(event) => setFields({ ...fields, email: event.target.value })} /></label></div>
    <label>{c.phone}<input name="phone" type="tel" maxLength={30} autoComplete="tel" value={fields.phone} onChange={(event) => setFields({ ...fields, phone: event.target.value })} /></label>
    {kind === "order" && <div className={styles.formGrid}><label>{t.product}<select value={productId} onChange={(event) => setProductId(event.target.value)} required><option value="">—</option>{products.map((product) => <option key={product.id} value={product.id} disabled={"stock" in product && product.stock === 0}>{product.name[locale]}</option>)}</select></label><label>{t.quantity}<input name="quantity" type="number" min={1} max={Math.max(1, quantityLimit)} value={fields.quantity} onChange={(event) => setFields({ ...fields, quantity: event.target.value })} disabled={!quantityLimit} required /></label></div>}
    {kind === "wholesale" && <><div className={styles.formGrid}><label>{w.product}<select value={productId} onChange={(event) => setProductId(event.target.value)} required><option value="">{w.chooseProduct}</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name[locale]}</option>)}</select></label><label>{w.quantity}<input type="number" required min={1} max={1000000} step={1} value={fields.quantity} onChange={(event) => setFields({ ...fields, quantity: event.target.value })} /></label></div><label>{w.business}<input required maxLength={160} value={fields.business} onChange={(event) => setFields({ ...fields, business: event.target.value })} /></label><label>{w.destination}<input required maxLength={500} value={fields.destination} onChange={(event) => setFields({ ...fields, destination: event.target.value })} /></label><label>{w.neededBy}<input type="date" value={fields.neededBy} onChange={(event) => setFields({ ...fields, neededBy: event.target.value })} /></label><p className={styles.note}>{w.wholesaleNote}</p></>}
    <label>{c.message}<textarea name="message" rows={4} maxLength={5000} value={fields.message} onChange={(event) => setFields({ ...fields, message: event.target.value })} /></label>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.actions}><button type="submit" className={styles.primary} disabled={kind === "order" && !quantityLimit}>{t.create}</button><button type="button" className={styles.quiet} onClick={close}>{t.cancel}</button></div>
  </form>;
}

function BrowserOperations({ locale, view, onDirtyChange }: { locale: Locale; view: View; onDirtyChange?: (dirty: boolean) => void }) {
  const c = staffCopy[locale], t = operationsCopy[locale], w = workflowCopy[locale];
  const demo = useDemo();
  const [query, setQuery] = useState(""), [status, setStatus] = useState("all"), [sort, setSort] = useState("new"), [page, setPage] = useState(1);
  const [kind, setKind] = useState("all"), [assignment, setAssignment] = useState("all");
  const [selected, setSelected] = useState<string | null>(null), [customer, setCustomer] = useState<string | null>(null), [creating, setCreating] = useState(false), [feedback, setFeedback] = useState(""), [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const { confirm, confirmation } = useCmsConfirm(locale);
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  const filtered = demo.records.filter((record) => (view !== "orders" || record.kind === "order") && (view === "orders" || kind === "all" || record.kind === kind) && (status === "all" || record.status === status) && (assignment === "all" || Boolean(record.assignedTo) === (assignment === "assigned")) && `${record.name} ${record.email} ${record.reference} ${record.message ?? ""} ${record.assignedTo ?? ""} ${record.wholesale?.business ?? ""}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === "new" ? b.updatedAt.localeCompare(a.updatedAt) : a.updatedAt.localeCompare(b.updatedAt));
  const totalPages = Math.max(1, Math.ceil(filtered.length / 20)), currentPage = Math.min(page, totalPages);
  const shown = filtered.slice((currentPage - 1) * 20, currentPage * 20);
  const customers = useMemo(() => {
    const groups = new Map<string, { name: string; email: string; phone: string; records: DemoRecord[] }>();
    for (const record of [...demo.records].sort((a,b) => b.createdAt.localeCompare(a.createdAt))) { const entry = groups.get(record.email) ?? { name: record.name, email: record.email, phone: record.phone ?? "", records: [] }; entry.records.push(record); groups.set(record.email, entry); }
    return [...groups.values()];
  }, [demo.records]);
  const opened = demo.records.find((record) => record.id === selected);
  const openedCustomer = customers.find((entry) => entry.email === customer);
  const hasDialog = Boolean(opened || creating || openedCustomer);
  const finishClose = () => { setDirty(false); setSelected(null); setCreating(false); setCustomer(null); };
  const requestClose = async () => {
    if (dirty && !await confirm({ title: t.unsavedTitle, body: t.discardBody, label: t.discard, destructive: true })) return;
    finishClose();
  };
  const close = () => { void requestClose(); };
  function seed() { try { demo.seedSamples(); setError(""); } catch { setError(t.failed); } }
  const recordsExport = () => downloadCsv([["Reference", "Kind", "Name", "Email", "Phone", "Status", "Assigned to", "Order stage", "Tracking", "Business", "Quantity", "Destination", "Needed by", "Currency", "Subtotal", "Created", "Notes"], ...filtered.map((r) => [r.reference, r.kind, r.name, r.email, r.phone ?? "", r.status, r.assignedTo || "", r.order?.stage || "", r.order?.tracking || "", r.wholesale?.business || "", String(r.wholesale?.quantity || ""), r.wholesale?.destination || "", r.wholesale?.neededBy || "", r.kind === "order" ? r.currency ?? "THB" : "", String(r.subtotal ?? ""), r.createdAt, r.notes])], `vetra-${view}.csv`);
  if (!demo.enabled) return <p>{t.unavailable}</p>;
  if (!demo.hydrated) return <p role="status">{c.loading}</p>;
  return <div className={styles.workspace}>
    <div className={styles.stats}>
      <article><ShoppingBag aria-hidden="true" /><span>{t.orderCount}</span><strong>{demo.records.filter((record) => record.kind === "order").length}</strong></article>
      <article><Inbox aria-hidden="true" /><span>{t.openCount}</span><strong>{demo.records.filter((record) => record.status !== "completed").length}</strong></article>
      <article><Users aria-hidden="true" /><span>{t.customerCount}</span><strong>{customers.length}</strong></article>
    </div>
    <p className={styles.note}>{t.localNote}</p>
    <div className={styles.toolbar}>
      {(view === "orders" || view === "messages") && <><select aria-label={w.allRequests} value={view === "orders" ? "order" : kind} disabled={view === "orders"} onChange={(event) => { setKind(event.target.value); setPage(1); }}><option value="all">{w.allRequests}</option>{(["contact", "wholesale", "order", "newsletter"] as const).map((value) => <option key={value} value={value}>{c.kinds[value]}</option>)}</select><select aria-label={w.assignedTo} value={assignment} onChange={(event) => { setAssignment(event.target.value); setPage(1); }}><option value="all">{w.allAssignees}</option><option value="assigned">{w.assigned}</option><option value="unassigned">{w.unassignedFilter}</option></select></>}
      <input type="search" aria-label={view === "orders" || view === "messages" ? t.requestSearch : c.search} placeholder={view === "orders" || view === "messages" ? t.requestSearchPlaceholder : c.searchPlaceholder} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
      {(view === "orders" || view === "messages") && <><select aria-label={c.status} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="all">{t.allStatuses}</option>{demoStatuses.map((state) => <option key={state} value={state}>{c.statuses[state]}</option>)}</select><select aria-label={t.latest} value={sort} onChange={(event) => setSort(event.target.value)}><option value="new">{t.newFirst}</option><option value="old">{t.oldFirst}</option></select></>}
      <div className={styles.actions}>{view !== "notifications" && <button type="button" className={styles.quiet} onClick={view === "customers" ? () => downloadCsv([["Name", "Email", "Phone", "Records"], ...customers.filter((entry) => `${entry.name} ${entry.email}`.toLowerCase().includes(query.toLowerCase())).map((entry) => [entry.name, entry.email, entry.phone, String(entry.records.length)])], "vetra-customers.csv") : recordsExport}><Download aria-hidden="true" />{t.export}</button>}{view !== "notifications" && <button type="button" className={styles.primary} onClick={() => setCreating(true)}><Plus aria-hidden="true" />{t.add}</button>}</div>
    </div>
    <p role="status" className={styles.feedback}>{feedback}</p>{error && <p role="alert" className={styles.error}>{error}</p>}
    {view === "customers" ? <div className={styles.cards}>{customers.filter((entry) => `${entry.name} ${entry.email} ${entry.phone}`.toLowerCase().includes(query.toLowerCase())).map((entry) => <button type="button" key={entry.email} className={styles.customerCard} onClick={() => setCustomer(entry.email)}><span className={styles.avatar}>{entry.name.slice(0, 1)}</span><strong>{entry.name}</strong><span>{entry.email}</span><span>{entry.records.length} {t.records}</span><span className={styles.link}>{t.history}<ChevronRight aria-hidden="true" /></span></button>)}{!customers.length && <div className={styles.empty}><Users aria-hidden="true" /><h2>{t.noCustomer}</h2><p>{t.noCustomerBody}</p><button type="button" className={styles.quiet} onClick={seed}>{t.sample}</button></div>}</div>
    : view === "notifications" ? <><p className={styles.note}>{t.emailNotes}</p><div className={styles.notifications}>{demo.outbox.filter((entry) => `${entry.subject} ${entry.recipient} ${entry.body}`.toLowerCase().includes(query.toLowerCase())).map((entry) => <details className={styles.notification} key={entry.id}><summary><Mail aria-hidden="true" /><span><strong>{entry.subject}</strong><span>{entry.recipient}</span></span><span className={styles.pill}>{w.deliveryStates[entry.state]}</span></summary><div><p>{date(entry.createdAt, locale)}</p><pre>{entry.body}</pre><NotificationDelivery notification={entry} locale={locale} /><button type="button" className={styles.quiet} onClick={async () => { try { await navigator.clipboard.writeText(entry.body); setFeedback(t.copied); } catch { setError(t.failed); } }}><Copy aria-hidden="true" />{t.copy}</button></div></details>)}{!demo.outbox.length && <div className={styles.empty}><Mail aria-hidden="true" /><p>{c.outboxEmpty}</p></div>}</div></>
    : <><div className={styles.records}>{shown.map((record) => <button type="button" className={styles.record} key={record.id} onClick={() => setSelected(record.id)}><span className={styles.recordIcon}>{record.kind === "order" ? <ShoppingBag aria-hidden="true" /> : <MessageSquare aria-hidden="true" />}</span><span className={styles.recordName}><strong>{record.name}</strong><span>{record.reference} · {c.kinds[record.kind]}</span><span>{record.assignedTo || w.unassigned}</span></span><span className={styles.pill} data-status={record.status}>{c.statuses[record.status]}</span><span className={styles.recordDate}>{date(record.createdAt, locale)}</span><ChevronRight aria-hidden="true" /></button>)}{!shown.length && <div className={styles.empty}><Inbox aria-hidden="true" /><h2>{demo.records.length ? t.filtered : t.noData}</h2><button type="button" className={styles.quiet} onClick={seed}>{t.sample}</button></div>}</div>{totalPages > 1 && <nav className={styles.pagination} aria-label={t.page}><button type="button" className={styles.iconButton} aria-label={t.previous} disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft aria-hidden="true" /></button><span>{t.page} {currentPage} {t.of} {totalPages}</span><button type="button" className={styles.iconButton} aria-label={t.next} disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}><ChevronRight aria-hidden="true" /></button></nav>}</>}
    {hasDialog && <CmsDialog label={creating ? t.add : c.details} className={styles.dialog} onClose={close}>
      {creating ? <NewRecord locale={locale} close={close} created={() => { finishClose(); setFeedback(t.created); }} onDirtyChange={setDirty} /> : opened ? <Details key={opened.id} record={opened} locale={locale} close={close} deleted={() => { finishClose(); setFeedback(t.deleted); }} onDirtyChange={setDirty} /> : openedCustomer ? <section><header className={styles.detailHeader}><div><h2>{openedCustomer.name}</h2><p>{openedCustomer.email}</p></div><button className={styles.iconButton} aria-label={t.close} type="button" onClick={close}><X aria-hidden="true" /></button></header><div className={styles.records}>{openedCustomer.records.map((record) => <button type="button" className={styles.record} key={record.id} onClick={() => { setCustomer(null); setSelected(record.id); }}><span className={styles.recordName}><strong>{record.reference}</strong><span>{c.kinds[record.kind]} · {date(record.createdAt, locale)}</span></span><span className={styles.pill}>{c.statuses[record.status]}</span><ChevronRight aria-hidden="true" /></button>)}</div></section> : null}
    </CmsDialog>}
    {confirmation}
  </div>;
}

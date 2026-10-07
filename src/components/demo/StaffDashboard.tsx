"use client";

import Link from "@/components/loading/NavigationLink";
import { useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ClipboardCheck,
  CreditCard,
  Database,
  FlaskConical,
  Inbox,
  Mail,
  MessageCircle,
  PackageCheck,
  Plus,
  Save,
  ShieldCheck,
  ShoppingBag,
  Store,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { staffCopy } from "@/content/staff";
import LoadingScreen from "@/components/loading/LoadingScreen";
import { workflowCopy } from "@/content/workflow";
import { NotificationDelivery, RequestWorkflow } from "./RequestWorkflow";
import { catalogProducts, formatPrice } from "@/lib/catalog";
import { localizedPath, type Locale } from "@/lib/i18n";
import { demoKinds, demoStatuses, type DemoRecord } from "@/lib/demo-types";
import { useDemo } from "./DemoProvider";
import styles from "./StaffDashboard.module.css";

type Section = "inbox" | "outbox" | "launch";
const kindIcons = {
  order: ShoppingBag,
  contact: MessageCircle,
  wholesale: Store,
  newsletter: Mail,
};
const launchChecks = [
  { key: "shipping", icon: Truck },
  { key: "returns", icon: PackageCheck },
  { key: "stock", icon: ShoppingBag },
  { key: "wholesale", icon: Store },
  { key: "contact", icon: MessageCircle },
  { key: "domain", icon: ShieldCheck },
  { key: "payment", icon: CreditCard },
  { key: "data", icon: Database },
] as const;

function displayDate(value: string, locale: Locale) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(({ th: "th-TH", ar: "ar", en: "en-GB" }[locale]), {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function RecordDetails({ record, locale, close }: {
  record: DemoRecord;
  locale: Locale;
  close: () => void;
}) {
  const c = staffCopy[locale];
  const w = workflowCopy[locale];
  const { updateRecord } = useDemo();
  const [notes, setNotes] = useState(record.notes);
  const [assignedTo, setAssignedTo] = useState(record.assignedTo || "");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const address = record.customer
    ? ["address", "district", "province", "postcode"]
        .map((key) => record.customer?.[key]?.trim())
        .filter(Boolean)
        .join("\n")
    : "";
  function saveNotes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      updateRecord(record.id, { notes, assignedTo });
      setSaved(true);
      setSaveError(false);
    } catch {
      setSaved(false);
      setSaveError(true);
    }
  }
  return (
    <>
      <div className={styles.detailHeading}>
        <div>
          <h2>{c.details}</h2>
          <p>{record.reference} · {c.kinds[record.kind]}</p>
        </div>
        <button className={styles.iconButton} type="button" onClick={close} aria-label={c.closeDetails}>
          <X aria-hidden="true" />
        </button>
      </div>
      <div className={styles.field}>
        <label htmlFor="staff-record-status">{c.status}</label>
        <select
          id="staff-record-status"
          value={record.status}
          onChange={(event) => {
            try {
              updateRecord(record.id, { status: event.target.value as DemoRecord["status"] });
              setSaveError(false);
            } catch { setSaveError(true); }
          }}
        >
          {demoStatuses.map((status) => <option key={status} value={status}>{c.statuses[status]}</option>)}
        </select>
      </div>
      <dl className={styles.detailList}>
        <div><dt>{c.received}</dt><dd>{displayDate(record.createdAt, locale)}</dd></div>
        {record.name && <div><dt>{c.customer}</dt><dd>{record.name}</dd></div>}
        <div><dt>{c.email}</dt><dd>{record.email}</dd></div>
        {record.phone && <div><dt>{c.phone}</dt><dd>{record.phone}</dd></div>}
        {record.customer?.company && <div><dt>{c.company}</dt><dd>{record.customer.company}</dd></div>}
        {record.message && <div><dt>{c.message}</dt><dd>{record.message}</dd></div>}
        {address && <div><dt>{c.address}</dt><dd>{address}</dd></div>}
        {record.items?.length ? (
          <div>
            <dt>{c.items}</dt>
            <dd>
              <ul className={styles.productList}>
                {record.items.map((item, index) => {
                  const product = catalogProducts.find((entry) => entry.id === item.id);
                  return <li key={`${item.id}-${index}`}>
                    {product?.name[locale] ?? item.id} × {item.quantity}
                    <br />{formatPrice(item.lineTotal ?? item.unitPrice * item.quantity, locale, record.currency ?? "THB")}
                  </li>;
                })}
              </ul>
            </dd>
          </div>
        ) : null}
        {typeof record.subtotal === "number" && <div><dt>{c.total}</dt><dd>{formatPrice(record.subtotal, locale, record.currency ?? "THB")}</dd></div>}
        {record.payment && <div>
          <dt>{c.payment}</dt>
          <dd>{c.paymentStates[record.payment]}</dd>
          <dd className={styles.paymentNote}>{c.paymentNote}</dd>
        </div>}
      </dl>
      <form className={styles.notes} onSubmit={saveNotes}>
        <div className={styles.field}><label htmlFor="staff-assignee">{w.assignedTo}</label><input id="staff-assignee" value={assignedTo} maxLength={100} placeholder={w.unassigned} onChange={(event) => { setAssignedTo(event.target.value); setSaved(false); }} /></div>
        <div className={styles.field}>
          <label htmlFor="staff-record-notes">{c.notes}</label>
          <textarea id="staff-record-notes" maxLength={4000} value={notes} placeholder={c.notesPlaceholder}
            onChange={(event) => { setNotes(event.target.value); setSaved(false); setSaveError(false); }} />
        </div>
        <div className={styles.notesActions}>
          <button className={styles.quietButton} type="submit"><Save aria-hidden="true" />{c.saveNotes}</button>
          <p className={styles.feedback} role="status">{saved ? c.saved : ""}</p>
        </div>
        {saveError && <p className={styles.error} role="alert">{c.storageError}</p>}
      </form>
      <RequestWorkflow record={record} locale={locale} />
    </>
  );
}

export default function StaffDashboard({ locale }: { locale: Locale }) {
  const c = staffCopy[locale];
  const w = workflowCopy[locale];
  const { enabled, hydrated, records, outbox, checklist, updateChecklist, seedSamples, resetDemo } = useDemo();
  const [section, setSection] = useState<Section>("inbox");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | DemoRecord["kind"]>("all");
  const [assignment, setAssignment] = useState("all"), [requestStatus, setRequestStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checklistFeedback, setChecklistFeedback] = useState("");
  const [actionError, setActionError] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetStatus, setResetStatus] = useState<"idle" | "success" | "error">("idle");
  const detailRef = useRef<HTMLDivElement>(null);
  const recordButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const resetTriggerRef = useRef<HTMLButtonElement>(null);
  const resetConfirmationRef = useRef<HTMLDivElement>(null);
  if (!enabled) return null;
  const visible = records.filter((record) => {
    const searchable = `${record.name} ${record.email} ${record.reference} ${record.message ?? ""} ${record.assignedTo || ""} ${record.wholesale?.business || ""}`.toLocaleLowerCase();
    return (kind === "all" || record.kind === kind) && (requestStatus === "all" || record.status === requestStatus) && (assignment === "all" || Boolean(record.assignedTo) === (assignment === "assigned")) && searchable.includes(query.trim().toLocaleLowerCase());
  });
  const selected = visible.find((record) => record.id === selectedId);
  const totals = {
    all: records.length,
    open: records.filter((record) => record.status !== "completed").length,
    orders: records.filter((record) => record.kind === "order").length,
    subscribers: records.filter((record) => record.kind === "newsletter").length,
  };
  function selectRecord(id: string) {
    setSelectedId(id);
    requestAnimationFrame(() => {
      detailRef.current?.focus({ preventScroll: true });
      detailRef.current?.scrollIntoView({ block: "nearest", behavior: "auto" });
    });
  }
  function closeRecord(id: string) {
    setSelectedId(null);
    requestAnimationFrame(() => recordButtonRefs.current.get(id)?.focus());
  }
  function addSamples() {
    try { seedSamples(); setActionError(false); }
    catch { setActionError(true); }
  }
  function openResetConfirmation() {
    setConfirmingReset(true);
    setResetStatus("idle");
    requestAnimationFrame(() => resetConfirmationRef.current?.focus());
  }
  function cancelReset() {
    setConfirmingReset(false);
    setResetStatus("idle");
    requestAnimationFrame(() => resetTriggerRef.current?.focus());
  }
  function confirmReset() {
    try {
      resetDemo();
      setSelectedId(null);
      setChecklistFeedback("");
      setActionError(false);
      setConfirmingReset(false);
      setResetStatus("success");
      requestAnimationFrame(() => resetTriggerRef.current?.focus());
    } catch { setResetStatus("error"); }
  }
  return (
    <section className={styles.workspace} aria-labelledby="staff-title">
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>{c.eyebrow}</p>
          <h1 id="staff-title">{c.title}</h1>
          <p>{c.intro}</p>
        </div>
        <Link className={styles.backLink} href={localizedPath(locale)}><ArrowLeft aria-hidden="true" />{c.back}</Link>
      </header>
      <aside className={styles.demoBanner} aria-label={c.demoTitle}>
        <FlaskConical aria-hidden="true" />
        <div><strong>{c.demoTitle}</strong><p>{c.demoNote}</p></div>
      </aside>
      {!hydrated ? <LoadingScreen variant="panel" layout="content" locale={locale} label={c.loading} /> : <>
        <dl className={styles.stats}>
          {(Object.keys(totals) as (keyof typeof totals)[]).map((key) => <div className={styles.stat} key={key}><dt>{c.totals[key]}</dt><dd>{totals[key]}</dd></div>)}
        </dl>
        <nav className={styles.tabs} aria-label={c.title}>
          {([{ key: "inbox", icon: Inbox }, { key: "outbox", icon: Mail }, { key: "launch", icon: ClipboardCheck }] as const).map(({ key, icon: Icon }) =>
            <button type="button" key={key} className={styles.tab} aria-pressed={section === key} onClick={() => setSection(key)}>
              <Icon aria-hidden="true" />{c.sections[key]}
            </button>,
          )}
        </nav>
        {section === "inbox" && <section aria-label={c.sections.inbox}>
          <div className={styles.toolbar}>
            <div className={styles.field}><label htmlFor="staff-assignment-filter">{w.assignedTo}</label><select id="staff-assignment-filter" value={assignment} onChange={(event) => setAssignment(event.target.value)}><option value="all">{w.allAssignees}</option><option value="assigned">{w.assigned}</option><option value="unassigned">{w.unassignedFilter}</option></select></div>
            <div className={styles.field}><label htmlFor="staff-status-filter">{c.status}</label><select id="staff-status-filter" value={requestStatus} onChange={(event) => setRequestStatus(event.target.value)}><option value="all">{c.all}</option>{demoStatuses.map((value) => <option key={value} value={value}>{c.statuses[value]}</option>)}</select></div>
            <div className={styles.field}>
              <label htmlFor="staff-search">{c.search}</label>
              <input id="staff-search" type="search" value={query} placeholder={c.searchPlaceholder} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <div className={styles.field}>
              <label htmlFor="staff-kind">{c.filter}</label>
              <select id="staff-kind" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
                <option value="all">{c.all}</option>
                {demoKinds.map((key) => <option key={key} value={key}>{c.kinds[key]}</option>)}
              </select>
            </div>
          </div>
          {!records.length ? <div className={styles.empty}>
            <Inbox aria-hidden="true" /><h2>{c.emptyTitle}</h2><p>{c.emptyBody}</p>
            <button type="button" className="button" onClick={addSamples}><Plus aria-hidden="true" />{c.seed}</button>
            <p className={styles.sampleNote}>{c.samplesNote}</p>
          </div> : <>
            <div className={styles.inbox}>
              <div className={styles.list}>
                {visible.length ? visible.map((record) => {
                  const Icon = kindIcons[record.kind];
                  return <button type="button" className={styles.record} key={record.id}
                    ref={(element) => {
                      if (element) recordButtonRefs.current.set(record.id, element);
                      else recordButtonRefs.current.delete(record.id);
                    }}
                    onClick={() => selectRecord(record.id)} aria-pressed={selected?.id === record.id} aria-controls="staff-record-details">
                    <span className={styles.recordIcon}><Icon aria-hidden="true" /></span>
                    <span className={styles.recordCopy}>
                      <strong>{record.name || record.email}</strong>
                      <span>{record.reference} · {c.kinds[record.kind]}</span>
                      <span className={styles.recordMeta}><span className={styles.statusPill} data-status={record.status}>{c.statuses[record.status]}</span><span>{displayDate(record.createdAt, locale)}</span></span>
                    </span>
                  </button>;
                }) : <div className={styles.empty}><p>{c.noMatches}</p><button type="button" className={styles.quietButton} onClick={() => { setQuery(""); setKind("all"); setAssignment("all"); setRequestStatus("all"); }}>{c.clear}</button></div>}
              </div>
              <div className={styles.detail} id="staff-record-details" ref={detailRef} tabIndex={-1}>
                {selected ? <RecordDetails key={selected.id} record={selected} locale={locale} close={() => closeRecord(selected.id)} /> : <p>{c.selectRecord}</p>}
              </div>
            </div>
            <div className={styles.sampleActions}>
              <button type="button" className={styles.quietButton} onClick={addSamples}><Plus aria-hidden="true" />{c.seed}</button>
              <p>{c.samplesNote}</p>
            </div>
          </>}
        </section>}
        {section === "outbox" && <section aria-labelledby="staff-outbox-title">
          <div className={styles.sectionIntro}><h2 id="staff-outbox-title">{c.outboxTitle}</h2><p>{c.outboxNote}</p></div>
          <div className={styles.outbox}>
            {outbox.length ? outbox.map((notification) => <details className={styles.notification} key={notification.id}>
              <summary><span><strong>{notification.subject}</strong><span>{c.outboxDestinations[notification.to]} · {c.mockOnly}</span></span><Plus aria-hidden="true" /></summary>
              <dl>
                <div><dt>{c.recipient}</dt><dd>{notification.recipient}</dd></div>
                <div><dt>{c.received}</dt><dd>{displayDate(notification.createdAt, locale)}</dd></div>
                <div><dt>{c.body}</dt><dd><pre>{notification.body}</pre></dd></div>
              </dl>
              <NotificationDelivery notification={notification} locale={locale} />
            </details>) : <div className={styles.empty}><Mail aria-hidden="true" /><p>{c.outboxEmpty}</p></div>}
          </div>
        </section>}
        {section === "launch" && <section aria-labelledby="staff-launch-title">
          <div className={styles.sectionIntro}><h2 id="staff-launch-title">{c.launchTitle}</h2><p>{c.launchNote}</p></div>
          <div className={styles.checklist}>
            {launchChecks.map(({ key, icon: Icon }) => <article className={styles.checklistCard} key={key}>
              <div className={styles.checklistIcon}><Icon aria-hidden="true" /></div>
              <h3>{c.checklist[key].title}</h3><p>{c.checklist[key].description}</p>
              <div className={styles.field}>
                <label htmlFor={`staff-check-${key}`} className="srOnly">{c.checklist[key].title}</label>
                <select id={`staff-check-${key}`} value={checklist[key]} onChange={(event) => {
                  try {
                    updateChecklist(key, event.target.value as "needs-confirmation" | "reviewed");
                    setChecklistFeedback(c.checklistSaved);
                    setActionError(false);
                  } catch { setActionError(true); setChecklistFeedback(""); }
                }}>
                  <option value="needs-confirmation">{c.needsConfirmation}</option><option value="reviewed">{c.confirmed}</option>
                </select>
              </div>
            </article>)}
          </div>
          <p className={styles.feedback} role="status">{checklistFeedback}</p>
        </section>}
        {actionError && <p className={styles.error} role="alert">{c.storageError}</p>}
        <section className={styles.resetSection} aria-labelledby="staff-reset-title">
          <div className={styles.resetHeading}>
            <div><h2 id="staff-reset-title">{c.resetTitle}</h2><p>{c.resetNote}</p></div>
            <button type="button" className={styles.quietButton} ref={resetTriggerRef}
              aria-expanded={confirmingReset} aria-controls={confirmingReset ? "staff-reset-confirmation" : undefined}
              onClick={openResetConfirmation}>
              <Trash2 aria-hidden="true" />{c.resetTrigger}
            </button>
          </div>
          {confirmingReset && <div className={styles.resetConfirmation} id="staff-reset-confirmation"
            role="group" aria-labelledby="staff-reset-confirm-title" ref={resetConfirmationRef} tabIndex={-1}>
            <h3 id="staff-reset-confirm-title">{c.resetConfirmTitle}</h3>
            <p>{c.resetNote}</p>
            <div className={styles.resetActions}>
              <button type="button" className="button" onClick={confirmReset}>{c.resetConfirm}</button>
              <button type="button" className={styles.quietButton} onClick={cancelReset}>{c.resetCancel}</button>
            </div>
          </div>}
          <p className={styles.resetFeedback} role="status">{resetStatus === "success" ? c.resetSuccess : ""}</p>
          {resetStatus === "error" && <p className={styles.error} role="alert">{c.resetError}</p>}
        </section>
      </>}
    </section>
  );
}

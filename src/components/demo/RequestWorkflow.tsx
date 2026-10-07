"use client";
import { useEffect, useState, type FormEvent } from "react";
import { CheckCheck, History, Send, Truck } from "lucide-react";
import { usePublished } from "@/components/cms/PublishedProvider";
import { workflowCopy } from "@/content/workflow";
import { mockCheckoutCopy } from "@/content/mock-checkout";
import { MockStockError } from "@/lib/mock-checkout";
import { initialOrderWorkflow, MAX_OUTBOX_ATTEMPTS, orderStages, orderTransitions, type OrderStage } from "@/lib/commerce-workflow";
import type { DemoNotification, DemoRecord } from "@/lib/demo-types";
import type { Locale } from "@/lib/i18n";
import { useDemo } from "./DemoProvider";
import MockOrderFacts from "./MockOrderFacts";
import styles from "./RequestWorkflow.module.css";

export function WholesaleFacts({ record, locale }: { record: DemoRecord; locale: Locale }) {
  const w = workflowCopy[locale], { products } = usePublished();
  if (!record.wholesale) return null;
  const value = record.wholesale;
  return <section className={styles.panel}><h3>{w.wholesaleTitle}</h3><dl className={styles.facts}>
    <div><dt>{w.product}</dt><dd>{products.find((product) => product.id === value.productId)?.name[locale] || value.productId}</dd></div>
    <div><dt>{w.quantity}</dt><dd>{value.quantity.toLocaleString(locale)}</dd></div>
    <div><dt>{w.business}</dt><dd>{value.business}</dd></div>
    <div><dt>{w.destination}</dt><dd>{value.destination}</dd></div>
    {value.neededBy && <div><dt>{w.neededBy}</dt><dd>{new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(value.neededBy))}</dd></div>}
  </dl></section>;
}

export function RequestWorkflow({ record, locale, onDirtyChange }: { record: DemoRecord; locale: Locale; onDirtyChange?: (dirty: boolean) => void }) {
  const w = workflowCopy[locale], m = mockCheckoutCopy[locale], demo = useDemo();
  const order = record.order || initialOrderWorkflow(record.payment), available = orderTransitions[order.stage];
  const [chosen, setChosen] = useState<OrderStage | "">("");
  const stage = available.includes(chosen as OrderStage) ? chosen : "";
  const [carrier, setCarrier] = useState(order.carrier), [tracking, setTracking] = useState(order.tracking);
  const [error, setError] = useState(""), [saved, setSaved] = useState(false), [restock, setRestock] = useState(false);
  const dirty = Boolean(stage) || carrier !== order.carrier || tracking !== order.tracking;
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  function transition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!stage) return;
    try { demo.transitionOrder(record.id, stage, { carrier, tracking, ...(stage === "refunded" ? { restock } : {}) }); setChosen(""); setRestock(false); setSaved(true); setError(""); }
    catch (reason) { setError(reason instanceof MockStockError ? m.stockError : w.failed); setSaved(false); }
  }
  return <div className={styles.stack}>
    <WholesaleFacts record={record} locale={locale} />
    {record.kind === "order" && <section className={styles.panel}>
      <h3><Truck aria-hidden="true" />{w.workflow}</h3><p className={styles.stage}>{w.stages[order.stage]}</p><p className={styles.note}>{w.mockNote}</p>
      {order.tracking && <p>{order.carrier} · {order.tracking}</p>}
      <MockOrderFacts record={record} locale={locale} />
      {available.length ? <form onSubmit={transition} className={styles.form}>
        <label>{w.nextStage}<select value={stage} required onChange={(event) => { setChosen(event.target.value as OrderStage); setSaved(false); }}><option value="">—</option>{available.map((next) => <option key={next} value={next}>{w.stages[next]}</option>)}</select></label>
        {stage === "shipped" && <div className={styles.grid}><label>{w.carrier}<input value={carrier} onChange={(event) => setCarrier(event.target.value)} required maxLength={100} /></label><label>{w.tracking}<input value={tracking} onChange={(event) => setTracking(event.target.value)} required maxLength={100} /></label></div>}
        {stage === "refunded" && ["shipped", "delivered"].includes(order.stage) && <><label className={styles.checkbox}><input type="checkbox" checked={restock} onChange={(event) => setRestock(event.target.checked)} />{m.restock}</label><p className={styles.note}>{m.restockNote}</p></>}
        <button className={styles.button} type="submit" disabled={!stage}><CheckCheck aria-hidden="true" />{w.applyStage}</button>
      </form> : <p>{w.finished}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}<p role="status">{saved ? w.saved : ""}</p>
    </section>}
    <section className={styles.panel}><h3><History aria-hidden="true" />{w.activity}</h3>
      {record.activity?.length ? <ol className={styles.activity}>{[...record.activity].reverse().map((event) => {
        const title = event.action === "request-created" ? w.requestCreated : event.action === "order-transition" ? w.orderTransition : w.requestUpdated;
        const detail = event.action === "order-transition" ? event.detail.split(" → ").map((part) => orderStages.includes(part as OrderStage) ? w.stages[part as OrderStage] : part).join(" → ") : event.action === "request-updated" ? event.detail.split(", ").map((part) => w.fieldNames[part as keyof typeof w.fieldNames] || part).join(", ") : "";
        return <li key={event.id}><strong>{title}</strong>{detail && <span>{detail}</span>}<span>{event.actor === "Mock staff" ? w.mockStaff : w.mockCustomer} · <time dateTime={event.at}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.at))}</time></span></li>;
      })}</ol> : <p>{w.noActivity}</p>}
    </section>
  </div>;
}

export function NotificationDelivery({ notification, locale }: { notification: DemoNotification; locale: Locale }) {
  const w = workflowCopy[locale], demo = useDemo();
  const [outcome, setOutcome] = useState<"success" | "failure">("success"), [error, setError] = useState(false);
  const attempts = notification.attempts || 0, done = notification.state === "mock-delivered", exhausted = attempts >= MAX_OUTBOX_ATTEMPTS;
  return <section className={styles.panel} aria-label={w.delivery}><p className={styles.stage} role="status">{w.deliveryStates[notification.state]}</p><p>{w.attempts}: {attempts} / {MAX_OUTBOX_ATTEMPTS}</p><p className={styles.note}>{w.mockNote}</p>
    {!done && !exhausted && <div className={styles.form}><label>{w.outcome}<select value={outcome} onChange={(event) => setOutcome(event.target.value as "success" | "failure")}><option value="success">{w.success}</option><option value="failure">{w.failure}</option></select></label><button className={styles.button} type="button" onClick={() => { try { demo.retryNotification(notification.id, outcome); setError(false); } catch { setError(true); } }}><Send aria-hidden="true" />{attempts ? w.retry : w.simulate}</button></div>}
    {exhausted && !done && <p>{w.exhausted}</p>}{error && <p role="alert" className={styles.error}>{w.failed}</p>}
  </section>;
}

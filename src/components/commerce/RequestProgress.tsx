"use client";
import { useState } from "react";
import { useDemo } from "@/components/demo/DemoProvider";
import MockOrderFacts from "@/components/demo/MockOrderFacts";
import { initialOrderWorkflow, orderTransitions } from "@/lib/commerce-workflow";
import { workflowCopy } from "@/content/workflow";
import type { Locale } from "@/lib/i18n";
import styles from "./RequestProgress.module.css";

export default function RequestProgress({ locale }: { locale: Locale }) {
  const demo = useDemo(), w = workflowCopy[locale], [error, setError] = useState(false);
  if (!demo.enabled || !demo.hydrated) return null;
  const orders = demo.records.filter((record) => record.kind === "order");
  return <section className={styles.section} id="requests" aria-labelledby="request-progress-title"><h2 id="request-progress-title">{w.requestsTitle}</h2><p>{w.requestsNote}</p>
    {orders.length ? <div className={styles.list}>{orders.map((record) => {
      const order = record.order || initialOrderWorkflow(record.payment);
      return <details key={record.id} className={styles.request}><summary><strong>{record.reference}</strong><span>{w.stages[order.stage]}</span></summary><div><p>{new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(record.createdAt))}</p>{order.tracking && <p>{w.tracking}: {order.carrier} · {order.tracking}</p>}<MockOrderFacts record={record} locale={locale} /><p>{w.mockNote}</p>{orderTransitions[order.stage].includes("cancelled") && <button type="button" className="button buttonOutline" onClick={() => { try { demo.transitionOrder(record.id, "cancelled"); setError(false); } catch { setError(true); } }}>{w.cancelRequest}</button>}</div></details>;
    })}</div> : <p>{w.noRequests}</p>}{error && <p role="alert">{w.failed}</p>}
  </section>;
}

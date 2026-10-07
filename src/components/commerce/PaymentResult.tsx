"use client";

import { useEffect, useState } from "react";
import Link from "@/components/loading/NavigationLink";
import Icon from "@/components/Icon";
import { paymentCheckoutCopy } from "@/content/payment-checkout";
import { localizedPath, type Locale } from "@/lib/i18n";
import styles from "./PaymentResult.module.css";

type PaymentState =
  | { kind: "loading" | "missing" | "error" }
  | { kind: "ready"; status: "pending" | "paid" | "failed"; reference: string };

export default function PaymentResult({ locale, orderId }: { locale: Locale; orderId: string }) {
  const copy = paymentCheckoutCopy[locale];
  const validOrderId = /^[0-9a-f-]{36}$/i.test(orderId);
  const [state, setState] = useState<PaymentState>(validOrderId ? { kind: "loading" } : { kind: "missing" });
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!validOrderId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let checks = 0;
    const controller = new AbortController();
    async function checkStatus() {
      try {
        checks += 1;
        const response = await fetch(`/api/payment-orders/${encodeURIComponent(orderId)}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Payment status unavailable");
        const result: unknown = await response.json();
        if (!result || typeof result !== "object") throw new Error("Invalid payment status");
        const { reference, status } = result as Record<string, unknown>;
        if (typeof reference !== "string" || (status !== "pending" && status !== "paid" && status !== "failed")) throw new Error("Invalid payment status");
        if (controller.signal.aborted) return;
        setState((previous) => previous.kind === "ready" && previous.status === status && previous.reference === reference ? previous : { kind: "ready", status, reference });
        if (status === "pending" && checks < 12) timer = setTimeout(checkStatus, 5000);
      } catch {
        if (!controller.signal.aborted) setState({ kind: "error" });
      }
    }
    void checkStatus();
    return () => { controller.abort(); if (timer) clearTimeout(timer); };
  }, [orderId, refresh, validOrderId]);

  const title = state.kind === "ready" ? state.status === "paid" ? copy.paidTitle : state.status === "failed" ? copy.failedTitle : copy.pendingTitle : state.kind === "missing" ? copy.missingTitle : state.kind === "error" ? copy.statusErrorTitle : copy.loading;
  const body = state.kind === "ready" ? state.status === "paid" ? copy.paidBody : state.status === "failed" ? copy.failedBody : copy.pendingBody : state.kind === "missing" ? copy.missingBody : state.kind === "error" ? copy.statusErrorBody : "";

  return (
    <section className={`container ${styles.page}`}>
      <div className={styles.card} role="status" aria-live="polite">
        <span className={styles.icon}><Icon name={state.kind === "ready" && state.status === "paid" ? "check" : state.kind === "ready" && state.status === "failed" ? "close" : "shield"} size={30} /></span>
        <p className={`eyebrow ${styles.eyebrow}`}>VETRA STORE · {copy.resultTitle}</p>
        <h1>{title}</h1>
        {body && <p className={styles.body}>{body}</p>}
        {state.kind === "ready" && <p className={styles.reference}>{copy.reference}<strong dir="ltr">{state.reference}</strong></p>}
        <div className={styles.actions}>
          {(state.kind === "error" || state.kind === "ready" && state.status === "pending") && <button className="button" type="button" onClick={() => setRefresh((value) => value + 1)}>{copy.refresh}<Icon name="chevron" size={19} /></button>}
          {(state.kind === "missing" || state.kind === "ready" && (state.status === "pending" || state.status === "failed")) && <Link href={localizedPath(locale, state.kind === "ready" ? `/checkout?order=${encodeURIComponent(orderId)}` : "/checkout")} className="button">{copy.returnCheckout}<Icon name="chevron" size={19} /></Link>}
          <Link href={localizedPath(locale, state.kind === "error" || state.kind === "missing" ? "/contact?subject=order" : "/products")} className="button buttonOutline">{state.kind === "error" || state.kind === "missing" ? copy.contact : copy.browse}<Icon name="chevron" size={19} /></Link>
        </div>
      </div>
    </section>
  );
}

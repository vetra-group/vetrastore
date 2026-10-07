"use client";
import { mockCheckoutCopy } from "@/content/mock-checkout";
import { formatPrice } from "@/lib/catalog";
import type { DemoRecord } from "@/lib/demo-types";
import type { Locale } from "@/lib/i18n";
import { useDemo } from "./DemoProvider";
import styles from "./RequestWorkflow.module.css";

export default function MockOrderFacts({ record, locale }: { record: DemoRecord; locale: Locale }) {
  const t = mockCheckoutCopy[locale], demo = useDemo(), quote = record.shippingQuote;
  const hold = demo.inventory.find((entry) => entry.orderId === record.id);
  return <dl className={styles.facts}>
    {quote && <><div><dt>{t.shipping}</dt><dd>{quote.state === "quoted" ? `${quote.label} · ${formatPrice(quote.fee, locale)}` : `${t.pending[quote.reason]} · ${t.pendingNote}`}</dd></div>{quote.state === "quoted" && <div><dt>{t.total}</dt><dd>{formatPrice(quote.total, locale)}</dd></div>}</>}
    <div><dt>{t.inventory}</dt><dd>{t.inventoryStates[hold?.state || "untracked"]}</dd></div>
    {hold?.state === "reserved" && hold.expiresAt && <div><dt>{t.expires}</dt><dd><time dateTime={hold.expiresAt}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(hold.expiresAt))}</time></dd></div>}
  </dl>;
}

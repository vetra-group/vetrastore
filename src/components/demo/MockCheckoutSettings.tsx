"use client";
import { useEffect, useState, type FormEvent } from "react";
import { ChevronDown, Plus, Save, Settings2, Trash2 } from "lucide-react";
import { usePublished } from "@/components/cms/PublishedProvider";
import { mockCheckoutCopy } from "@/content/mock-checkout";
import { availableMockStock, type MockShippingRule } from "@/lib/mock-checkout";
import type { Locale } from "@/lib/i18n";
import { useDemo } from "./DemoProvider";
import styles from "./MockCheckoutSettings.module.css";

const draftRules = (rules: MockShippingRule[]) => rules.map((rule) => ({ ...rule, fee: String(rule.fee), freeOver: rule.freeOver === null ? "" : String(rule.freeOver) }));
export default function MockCheckoutSettings({ locale, onDirtyChange }: { locale: Locale; onDirtyChange?: (dirty: boolean) => void }) {
  const t = mockCheckoutCopy[locale], demo = useDemo(), { products } = usePublished();
  const [rules, setRules] = useState(() => draftRules(demo.mockShippingRules));
  const [baseline, setBaseline] = useState(() => JSON.stringify(draftRules(demo.mockShippingRules)));
  const [feedback, setFeedback] = useState<"saved" | "failed" | "">("");
  const dirty = JSON.stringify(rules) !== baseline;
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  function update(id: string, field: "label" | "postcodePrefix" | "fee" | "freeOver", value: string) {
    setRules((current) => current.map((rule) => rule.id === id ? { ...rule, [field]: value } : rule)); setFeedback("");
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      demo.updateMockShippingRules(rules.map((rule) => ({ ...rule, fee: rule.fee.trim() ? Number(rule.fee) : NaN, freeOver: rule.freeOver.trim() ? Number(rule.freeOver) : null })));
      setBaseline(JSON.stringify(rules)); setFeedback("saved");
    } catch { setFeedback("failed"); }
  }
  return <details className={styles.panel}><summary><Settings2 aria-hidden="true" /><span>{t.settings}</span><ChevronDown className={styles.chevron} aria-hidden="true" /></summary><div className={styles.body}>
    <p>{t.note}</p><form onSubmit={save} className={styles.form}><h3>{t.rules}</h3><p id="mock-shipping-prefix-help">{t.prefixHint}</p>
      {!rules.length && <p>{t.empty}</p>}
      {rules.map((rule, index) => <fieldset className={styles.rule} key={rule.id}><legend>{t.rules} {index + 1}</legend><div className={styles.fields}>
        <label>{t.label}<input required maxLength={100} value={rule.label} onChange={(event) => update(rule.id, "label", event.target.value)} /></label>
        <label>{t.prefix}<input required maxLength={5} pattern="\*|[0-9]{1,5}" aria-describedby="mock-shipping-prefix-help" value={rule.postcodePrefix} onChange={(event) => update(rule.id, "postcodePrefix", event.target.value)} /></label>
        <label>{t.fee}<input required type="number" min={0} max={1000000} step="0.01" value={rule.fee} onChange={(event) => update(rule.id, "fee", event.target.value)} /></label>
        <label>{t.freeOver}<input type="number" min={0} max={1000000} step="0.01" value={rule.freeOver} onChange={(event) => update(rule.id, "freeOver", event.target.value)} /></label>
      </div><button className={styles.quiet} type="button" onClick={() => { setRules((current) => current.filter((entry) => entry.id !== rule.id)); setFeedback(""); }}><Trash2 aria-hidden="true" />{t.remove}</button></fieldset>)}
      <div className={styles.actions}><button className={styles.quiet} disabled={rules.length >= 20} type="button" onClick={() => { setRules((current) => [...current, { id: crypto.randomUUID(), label: "", postcodePrefix: "", fee: "", freeOver: "" }]); setFeedback(""); }}><Plus aria-hidden="true" />{t.add}</button><button className={styles.primary} type="submit" disabled={!dirty}><Save aria-hidden="true" />{t.save}</button></div>
      <p role={feedback === "failed" ? "alert" : "status"} className={feedback === "failed" ? styles.error : undefined}>{feedback ? t[feedback] : ""}</p>
    </form>
    <section className={styles.stock}><h3>{t.stock}</h3><p>{t.stockNote}</p><dl>{products.map((product) => { const available = availableMockStock(product, demo.inventory); return <div key={product.id}><dt>{product.name[locale]}</dt><dd>{available === null ? t.unknown : `${available.toLocaleString(locale)} ${t.units}`}</dd></div>; })}</dl></section>
  </div></details>;
}

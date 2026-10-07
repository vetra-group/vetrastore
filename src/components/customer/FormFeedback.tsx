"use client";
import type { Locale } from "@/lib/i18n";
import { customerFormCopy } from "@/lib/customer-form";
import type { useCustomerForm } from "./useCustomerForm";
import styles from "./FormFeedback.module.css";
export type CustomerFormState = ReturnType<typeof useCustomerForm>;

export function FieldError({ state, name }: { state: CustomerFormState; name: string }) {
  return state.errors[name] ? <span className={styles.fieldError} id={state.errorId(name)}>{state.errors[name]}</span> : null;
}
export function FormErrorSummary({ state, locale }: { state: CustomerFormState; locale: Locale }) {
  const { attachSummary } = state;
  const errors = Object.entries(state.errors).filter(([, error]) => error);
  if (!errors.length) return null;
  return <div className={styles.summary} ref={attachSummary} tabIndex={-1} aria-label={customerFormCopy[locale].errors}>
    <p><strong>{customerFormCopy[locale].errors}</strong></p>
    <ul>{errors.map(([name, error]) => <li key={name}><button type="button" onClick={() => state.focusField(name)}>{state.rules[name]?.label}: {error}</button></li>)}</ul>
  </div>;
}
export function FormRecovery({ state, locale, disabled = false }: { state: CustomerFormState; locale: Locale; disabled?: boolean }) {
  const c = customerFormCopy[locale];
  return <div className={styles.recovery} data-form-recovery>
    {state.candidate ? <>
      <p>{c.available}</p><div className={styles.actions}><button type="button" className="button buttonOutline" disabled={disabled} onClick={state.restore}>{c.restore}</button><button type="button" className={styles.delete} disabled={disabled} onClick={state.clearRecovery}>{c.discard}</button></div>
    </> : <label className={styles.remember}><input type="checkbox" checked={state.remember} disabled={disabled} onChange={(event) => state.setRemember(event.target.checked)} /><span><strong>{c.remember}</strong><span>{c.rememberHint}</span></span></label>}
    {state.recoveryStatus && <p role="status" className={styles.recoveryStatus}>{c[state.recoveryStatus]}</p>}
  </div>;
}

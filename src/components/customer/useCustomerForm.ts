"use client";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { makeCustomerDraft, parseCustomerDraft, validateCustomerFields, type CustomerDraft, type FieldErrors, type FieldRules, type FormSubmission, type FormValues } from "@/lib/customer-form";
import type { Locale } from "@/lib/i18n";

function readValues(form: HTMLFormElement | null): FormValues {
  if (!form) return {};
  const values: FormValues = {};
  // Read disabled controls as well so the pending state cannot erase a checkpoint.
  for (const field of Array.from(form.elements)) {
    if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) || !field.name) continue;
    if (field instanceof HTMLInputElement && ["checkbox", "radio"].includes(field.type) && !field.checked) continue;
    values[field.name] = field.value;
  }
  return values;
}

export function useCustomerForm({ locale, kind, rules, allowed, onRestore }: { locale: Locale; kind: string; rules: FieldRules; allowed: readonly string[]; onRestore?: (values: FormValues) => void }) {
  const formRef = useRef<HTMLFormElement>(null), summaryRef = useRef<HTMLDivElement>(null);
  const attachForm = useCallback((node: HTMLFormElement | null) => { formRef.current = node; }, []);
  const attachSummary = useCallback((node: HTMLDivElement | null) => { summaryRef.current = node; }, []);
  const id = useId(), key = `vetra-customer-draft:v1:${kind}:${locale}`;
  const [errors, setErrors] = useState<FieldErrors>({}), [candidate, setCandidate] = useState<CustomerDraft | null>(null);
  const [remember, setRememberState] = useState(false), [recoveryStatus, setRecoveryStatus] = useState<"saved" | "recovered" | "unavailable" | "deleteFailed" | null>(null);
  const enabled = useRef(false), attempted = useRef(false), submission = useRef<FormSubmission | undefined>(undefined);
  const current = useRef({ key, allowed, rules, locale, onRestore });
  useEffect(() => { current.current = { key, allowed, rules, locale, onRestore }; });

  function persist() {
    if (!enabled.current || !formRef.current) return;
    try {
      const draft = makeCustomerDraft(readValues(formRef.current), current.current.allowed, submission.current);
      localStorage.setItem(current.current.key, JSON.stringify(draft));
      setRecoveryStatus("saved");
    } catch { setRecoveryStatus("unavailable"); }
  }

  useEffect(() => {
    enabled.current = false;
    submission.current = undefined;
    const initialize = setTimeout(() => {
      setRememberState(false); setRecoveryStatus(null); setCandidate(null);
      try {
        const raw = localStorage.getItem(key), draft = parseCustomerDraft(raw, current.current.allowed);
        setCandidate(draft);
        if (raw && !draft) localStorage.removeItem(key);
      } catch { /* Persistence is optional; do not obstruct an untouched form. */ }
    }, 0);
    const flush = () => persist();
    const visibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", visibility);
    return () => { clearTimeout(initialize); window.removeEventListener("pagehide", flush); document.removeEventListener("visibilitychange", visibility); };
    // The key isolates each form and language. The refs read current controls when flushing.
  }, [key]);

  function clearRecovery() {
    enabled.current = false; submission.current = undefined;
    setRememberState(false); setCandidate(null); setRecoveryStatus(null);
    try { localStorage.removeItem(key); } catch { setRecoveryStatus("deleteFailed"); }
  }
  function setRemember(value: boolean) {
    if (!value) { clearRecovery(); return; }
    enabled.current = true; setRememberState(true); setCandidate(null); persist();
  }
  function restore() {
    if (!candidate) return;
    // Recheck the expiry when the user acts, not only when the page mounts.
    const draft = parseCustomerDraft(JSON.stringify(candidate), allowed);
    if (!draft) { clearRecovery(); return; }
    current.current.onRestore?.(draft.values);
    requestAnimationFrame(() => {
      const form = formRef.current;
      if (!form) return;
      for (const [name, value] of Object.entries(draft.values)) {
        const field = form.elements.namedItem(name);
        if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) field.value = value;
      }
      const consent = form.elements.namedItem("consent");
      if (consent instanceof HTMLInputElement) consent.checked = false;
      submission.current = draft.submission;
      enabled.current = true; setRememberState(true); setCandidate(null); setRecoveryStatus("recovered");
      attempted.current = false; setErrors({});
      const first = form.querySelector<HTMLInputElement>("input[name=name]"); first?.focus();
    });
  }
  function validate() {
    const next = validateCustomerFields(readValues(formRef.current), rules, locale);
    attempted.current = true; setErrors(next);
    if (Object.keys(next).length) requestAnimationFrame(() => summaryRef.current?.focus());
    return !Object.keys(next).length;
  }
  function changed(event: FormEvent<HTMLFormElement>) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
    if (attempted.current || errors[target.name]) {
      const next = validateCustomerFields(readValues(formRef.current), rules, locale);
      setErrors(attempted.current ? next : { ...errors, [target.name]: next[target.name] ?? "" });
    }
    if (enabled.current) persist();
  }
  function blurred(event: FormEvent<HTMLFormElement>) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) || !rules[target.name]) return;
    const next = validateCustomerFields(readValues(formRef.current), { [target.name]: rules[target.name] }, locale);
    setErrors((previous) => ({ ...previous, [target.name]: next[target.name] ?? "" }));
  }
  function resetValidation() { attempted.current = false; setErrors({}); }
  function saveSubmission(value: FormSubmission) { submission.current = value; persist(); }
  return {
    attachForm, attachSummary, errors, rules, candidate, remember, recoveryStatus, restore, clearRecovery, setRemember, validate, resetValidation, changed, blurred, saveSubmission,
    getSubmission: () => submission.current,
    field: (name: string, hint?: string) => ({ id: `${id}-${name}`, "aria-invalid": errors[name] ? true as const : undefined, "aria-describedby": [hint, errors[name] ? `${id}-${name}-error` : null].filter(Boolean).join(" ") || undefined }),
    errorId: (name: string) => `${id}-${name}-error`,
    focusField: (name: string) => { const field = formRef.current?.elements.namedItem(name); if (field instanceof HTMLElement) field.focus(); },
  };
}

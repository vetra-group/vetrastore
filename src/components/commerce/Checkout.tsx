"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { useDemo } from "@/components/demo/DemoProvider";
import { SharedDemoTarget, sharedDemoCopy, submitSharedDemoRequest, useSharedDemoTarget } from "@/components/demo/SharedDemoTarget";
import type { DemoInput } from "@/lib/demo-types";
import { commerce } from "@/content/commerce";
import { workflowCopy } from "@/content/workflow";
import { mockCheckoutCopy } from "@/content/mock-checkout";
import { MockStockError, quoteMockShipping } from "@/lib/mock-checkout";
import { resolveSellingDetails } from "@/lib/business-settings";
import { usePublished, usePublishedCopy } from "@/components/cms/PublishedProvider";
import { localizedPath, type Locale } from "@/lib/i18n";
import { useStore } from "./StoreProvider";
import OrderSummary from "./OrderSummary";
import { customerFormCopy, customerRequestFingerprint, normalizeCustomerNumber, type FieldRules } from "@/lib/customer-form";
import { useCustomerForm } from "@/components/customer/useCustomerForm";
import { FieldError, FormErrorSummary, FormRecovery } from "@/components/customer/FormFeedback";
import styles from "./Checkout.module.css";
const recoverableFields = ["name", "email", "phone", "address", "district", "province", "postcode", "notes"] as const;

type Status = "idle" | "pending" | "error" | "success" | "declined";
type PreviewMethod = "enquiry" | "payment";

export default function Checkout({ locale, enquiriesEnabled }: { locale: Locale; enquiriesEnabled: boolean }) {
  const { content } = usePublished();
  const w = workflowCopy[locale], m = mockCheckoutCopy[locale], selling = resolveSellingDetails(content.settings, locale);
  const t = usePublishedCopy(commerce[locale], `commerce.${locale}`);
  const f = customerFormCopy[locale];
  const demo = useDemo();
  const sharedDemo = useSharedDemoTarget(demo.enabled), sharedCopy = sharedDemoCopy[locale];
  const [sharedSuccess, setSharedSuccess] = useState(false);
  const { products, items, itemCount, hydrated } = useStore();
  const [status, setStatus] = useState<Status>("idle");
  const [reference, setReference] = useState("");
  const [method, setMethod] = useState<PreviewMethod>("enquiry");
  const [outcome, setOutcome] = useState<"approved" | "declined">("approved");
  const [successPayment, setSuccessPayment] = useState(false);
  const [postcode, setPostcode] = useState(""), [stockError, setStockError] = useState(false);
  const submission = useRef<{ key: string; payload: string } | null>(null);
  const failedAttempt = useRef<{ id: string; details: string } | null>(null);
  const inFlight = useRef(false);
  const confirmationRef = useRef<HTMLHeadingElement>(null);
  const canSubmit = demo.enabled || enquiriesEnabled;
  const usesShared = demo.enabled && method === "enquiry" && sharedDemo.target === "shared";
  const shippingQuote = demo.enabled && !usesShared ? quoteMockShipping(demo.mockShippingRules, postcode, items.reduce((sum, item) => sum + (products.find((product) => product.id === item.id)?.price || 0) * item.quantity, 0)) : undefined;
  const rules: FieldRules = {
    name: { label: t.fullName, required: true, max: 100 }, email: { label: t.email, required: true, max: 254, kind: "email" }, phone: { label: t.phone, required: true, kind: "phone" },
    address: { label: t.address, required: true, max: 500 }, district: { label: t.district, required: true, max: 100 }, province: { label: t.province, required: true, max: 100 },
    postcode: { label: t.postcode, required: true, kind: "postcode" }, notes: { label: t.notes, max: 1000 }, consent: { label: t.privacy, kind: "consent" },
  };
  const feedback = useCustomerForm({ locale, kind: "checkout", rules, allowed: recoverableFields, onRestore: (values) => { setPostcode(values.postcode || ""); setStatus("idle"); } });

  useEffect(() => {
    if (status === "success") confirmationRef.current?.focus();
  }, [status]);

  const { attachForm } = feedback;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !canSubmit || !itemCount || usesShared && !sharedDemo.ready) return;
    if (!feedback.validate()) return;
    const data = new FormData(event.currentTarget);
    const customer = Object.fromEntries(
      ["name", "email", "phone", "address", "district", "province", "postcode", "notes"]
        .map((key) => { const value = String(data.get(key) || "").trim(); return [key, ["phone", "postcode"].includes(key) ? normalizeCustomerNumber(value) : value]; }),
    );
    const payment = method === "enquiry" ? "enquiry" : outcome === "approved" ? "demo-paid" : "demo-failed";
    const orderDetails = JSON.stringify({ customer, items, locale });
    const payload = JSON.stringify({ customer, items, locale, consent: data.get("consent") === "on", ...(demo.enabled ? { payment, target: usesShared ? "shared" : "browser" } : {}) });
    if (data.get("consent") !== "on") return;
    inFlight.current = true;
    setStockError(false);
    setStatus("pending");
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const fingerprint = await customerRequestFingerprint(payload), recovered = feedback.getSubmission();
      if (!submission.current || submission.current.payload !== fingerprint) submission.current = { key: recovered?.fingerprint === fingerprint ? recovered.id : crypto.randomUUID(), payload: fingerprint };
      feedback.saveSubmission({ id: submission.current.key, fingerprint });
      if (demo.enabled) {
        const input: DemoInput = {
          kind: "order", locale, name: customer.name, email: customer.email, phone: customer.phone,
          message: customer.notes, customer,
          items: items.map((item) => ({ ...item, unitPrice: products.find((product) => product.id === item.id)?.price ?? 0 })),
          subtotal: items.reduce((sum, item) => sum + (products.find((product) => product.id === item.id)?.price ?? 0) * item.quantity, 0), payment,
        };
        if (usesShared) {
          const result = await submitSharedDemoRequest(input, submission.current.key);
          feedback.clearRecovery(); feedback.resetValidation();
          setReference(result.reference); setSuccessPayment(false); setSharedSuccess(true); setStatus("success");
          return;
        }
        const retry = payment === "demo-paid" && failedAttempt.current?.details === orderDetails ? demo.records.find((record) => record.id === failedAttempt.current?.id) : undefined;
        const result = retry || demo.submit(input, submission.current.key);
        if (retry && retry.order?.stage !== "paid") demo.transitionOrder(retry.id, "paid");
        if (payment === "demo-failed") failedAttempt.current = { id: result.id, details: orderDetails };
        else failedAttempt.current = null;
        setReference(result.reference);
        setSuccessPayment(payment === "demo-paid");
        setSharedSuccess(false);
        if (payment !== "demo-failed") { feedback.clearRecovery(); feedback.resetValidation(); }
        setStatus(payment === "demo-failed" ? "declined" : "success");
      } else {
        const controller = new AbortController();
        timeout = setTimeout(() => controller.abort(), 15000);
        const response = await fetch("/api/orders", {
          method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": submission.current.key },
          body: payload, signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok || typeof result.reference !== "string") throw new Error("Submission was not confirmed");
        feedback.clearRecovery(); feedback.resetValidation();
        setReference(result.reference);
        setSuccessPayment(false);
        setStatus("success");
      }
    } catch (error) {
      setStockError(error instanceof MockStockError);
      setStatus("error");
    } finally {
      if (timeout) clearTimeout(timeout);
      inFlight.current = false;
    }
  }

  return (
    <section className={`container ${styles.page}`}>
      <nav className={styles.steps} aria-label={t.checkoutEyebrow}>
        <Link href={localizedPath(locale, "/cart")}>{t.cartTitle}</Link>
        <Icon name="chevron" size={17} />
        <span aria-current="page">{t.checkoutEyebrow}</span>
      </nav>
      <header className={styles.heading}>
        <p className="eyebrow">VETRA STORE</p>
        <h1>{t.checkoutTitle}</h1>
      </header>
      {!hydrated || (demo.enabled && !demo.hydrated) ? (
        <p role="status" className={styles.loading}>{t.loading}</p>
      ) : status === "success" ? (
        <div className={styles.success} role="status" aria-live="polite">
          <span className={styles.successIcon}><Icon name="check" size={29} /></span>
          <h2 ref={confirmationRef} tabIndex={-1}>{sharedSuccess ? sharedCopy.enquiry : demo.enabled ? successPayment ? t.demoPaymentSuccess : t.demoSuccessTitle : t.successTitle}</h2>
          <p>{sharedSuccess ? sharedCopy.success : demo.enabled ? successPayment ? t.demoPaymentSuccessBody : t.demoSuccessBody : t.successBody}</p>
          <p className={styles.reference}>{demo.enabled ? t.demoReference : t.referenceLabel}<strong>{reference}</strong></p>
          {feedback.recoveryStatus === "deleteFailed" && <p role="alert">{f.deleteFailed}</p>}
          <div className={styles.successActions}>
            {demo.enabled && !sharedSuccess && <Link href={localizedPath(locale, "/account#requests")} className="button buttonOutline">{w.viewProgress}<Icon name="chevron" size={19} /></Link>}
            <Link href={localizedPath(locale, "/products")} className="button">{t.continue}<Icon name="chevron" size={19} /></Link>
            {demo.enabled && <button className="button buttonOutline" type="button" onClick={() => { submission.current = null; setStatus("idle"); setReference(""); }}>{t.demoNewPreview}</button>}
          </div>
        </div>
      ) : !itemCount ? (
        <div className={styles.empty}>
          <Icon name="bag" size={35} /><h2>{t.emptyTitle}</h2><p>{t.emptyBody}</p>
          <Link href={localizedPath(locale, "/products")} className="button">{t.browse}<Icon name="chevron" size={19} /></Link>
        </div>
      ) : (
        <div className={styles.layout}>
          <div className={styles.formColumn}>
            {!canSubmit ? (
              <section className={styles.notice}>
                <Icon name="leaf" size={31} /><h2>{t.setupTitle}</h2><p>{t.setupBody}</p>
                <Link href={localizedPath(locale, "/contact?subject=order")} className="button">{t.contact}<Icon name="chevron" size={19} /></Link>
                <Link href={localizedPath(locale, "/cart")} className={styles.back}>{t.returnBag}</Link>
              </section>
            ) : (
              <>
                <div className={styles.enquiryNote}>
                  <Icon name={demo.enabled ? "shield" : "mail"} size={24} />
                  <div><h2>{usesShared ? sharedCopy.enquiry : demo.enabled ? t.demoTitle : t.enquiryTitle}</h2><p>{usesShared ? sharedCopy.sharedNote : demo.enabled ? t.demoBody : t.enquiryBody}</p></div>
                </div>
                <form ref={attachForm} onSubmit={submit} onChange={feedback.changed} onBlur={feedback.blurred} noValidate className={styles.form} aria-busy={status === "pending"}>
                  <p className={styles.requiredHint}>{f.requiredHint}</p>
                  <FormErrorSummary state={feedback} locale={locale} />
                  {feedback.candidate && <FormRecovery state={feedback} locale={locale} disabled={status === "pending"} />}
                  <details className={styles.terms}><summary>{w.shippingTerms}</summary><h3>{selling.shipping.title}</h3><p>{selling.shipping.description}</p><h3>{selling.returns.title}</h3><p>{selling.returns.description}</p></details>
                  <fieldset disabled={status === "pending"}>
                    <legend className="srOnly">{t.shippingInfo}</legend>
                    <fieldset className={styles.section}><legend>{f.contactDetails}</legend>
                    <div className={styles.fields}>
                      <label>{t.fullName} *<input {...feedback.field("name")} name="name" autoComplete="name" required pattern=".*\S.*" maxLength={100} /><FieldError state={feedback} name="name" /></label>
                      <label>{t.email} *<input {...feedback.field("email")} name="email" type="email" autoComplete="email" required pattern="[^\s@]+@[^\s@]+\.[^\s@]+" maxLength={254} /><FieldError state={feedback} name="email" /></label>
                      <label>{t.phone} *<input {...feedback.field("phone")} name="phone" type="tel" autoComplete="tel" required minLength={7} maxLength={30} /><FieldError state={feedback} name="phone" /></label>
                    </div></fieldset>
                    <fieldset className={styles.section}><legend>{f.deliveryDetails}</legend><div className={styles.fields}>
                      <label className={styles.wide}>{t.address} *<textarea {...feedback.field("address")} name="address" autoComplete="street-address" required maxLength={500} rows={2} /><FieldError state={feedback} name="address" /></label>
                      <label>{t.district} *<input {...feedback.field("district")} name="district" autoComplete="address-level2" required maxLength={100} /><FieldError state={feedback} name="district" /></label>
                      <label>{t.province} *<input {...feedback.field("province")} name="province" autoComplete="address-level1" required maxLength={100} /><FieldError state={feedback} name="province" /></label>
                      <label>{t.postcode} *<input {...feedback.field("postcode", `${feedback.field("postcode").id}-hint`)} name="postcode" inputMode="numeric" autoComplete="postal-code" required pattern="[0-9]{5}" maxLength={5} value={postcode} onChange={(event) => setPostcode(normalizeCustomerNumber(event.target.value))} /><span className={styles.hint} id={`${feedback.field("postcode").id}-hint`}>{f.postcodeHint}</span><FieldError state={feedback} name="postcode" /></label>
                    </div></fieldset>
                    <fieldset className={styles.section}><legend>{f.optionalDetails}</legend><div className={styles.fields}>
                      <label className={styles.wide}>{t.notes}<textarea {...feedback.field("notes")} name="notes" maxLength={1000} rows={3} /><FieldError state={feedback} name="notes" /></label>
                    </div>
                    </fieldset>
                    {demo.enabled && (
                      <fieldset className={styles.methods}>
                        <legend>{t.demoMethod}</legend>
                        <div className={styles.methodGrid}>
                          <label className={styles.method}>
                            <input type="radio" name="preview-method" value="enquiry" checked={method === "enquiry"} onChange={() => { setMethod("enquiry"); setStatus("idle"); }} />
                            <span><strong>{t.demoEnquiry}</strong><span>{t.demoEnquiryDescription}</span></span>
                          </label>
                          <label className={styles.method}>
                            <input type="radio" name="preview-method" value="payment" checked={method === "payment"} onChange={() => { setMethod("payment"); setStatus("idle"); }} />
                            <span><strong>{t.demoPayment}</strong><span>{t.demoPaymentDescription}</span></span>
                          </label>
                        </div>
                        {method === "payment" && <label className={styles.outcome}>{t.demoOutcome}<select name="preview-outcome" value={outcome} onChange={(event) => { setOutcome(event.target.value as "approved" | "declined"); setStatus("idle"); }}><option value="approved">{t.demoApproved}</option><option value="declined">{t.demoDeclined}</option></select></label>}
                        {method === "enquiry" && <SharedDemoTarget locale={locale} state={sharedDemo} disabled={status === "pending"} />}
                        <p className={styles.previewNote}>{shippingQuote?.state === "quoted" ? m.quoteNote : m.pendingNote}</p>
                      </fieldset>
                    )}
                    <label className={styles.consent}>
                      <input {...feedback.field("consent")} type="checkbox" name="consent" required />
                      <span>{usesShared ? sharedCopy.consent : demo.enabled ? t.demoConsent : t.consent}{" "}<Link href={localizedPath(locale, "/help#privacy")}>{t.privacy}</Link> *<FieldError state={feedback} name="consent" /></span>
                    </label>
                    {!feedback.candidate && <FormRecovery state={feedback} locale={locale} disabled={status === "pending"} />}
                    {status === "declined" && <div className={styles.declined} role="alert"><h2>{t.demoFailureTitle}</h2><p>{t.demoFailureBody}</p><p className={styles.reference}>{t.demoReference}<strong>{reference}</strong></p></div>}
                    <button className={`button ${styles.submit}`} type="submit" disabled={usesShared && !sharedDemo.ready}>{status === "pending" ? demo.enabled ? t.demoSaving : t.sending : demo.enabled ? method === "payment" ? t.demoPay : t.demoSend : t.send}<Icon name="chevron" size={19} /></button>
                  </fieldset>
                  {status === "pending" && <p role="status" className={styles.hint}>{f.saving}</p>}
                  {status === "error" && <p className={styles.error} role="alert">{stockError ? m.stockError : usesShared ? sharedCopy.error : demo.enabled ? t.demoStorageError : t.error}</p>}
                </form>
              </>
            )}
          </div>
          <OrderSummary locale={locale} shippingQuote={shippingQuote} />
        </div>
      )}
    </section>
  );
}

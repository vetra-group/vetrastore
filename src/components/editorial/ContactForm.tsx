"use client";
import { contactArabic } from "@/content/customer-ar";
import Link from "@/components/loading/NavigationLink";
import { useRef, useState, type FormEvent } from "react";
import Icon from "@/components/Icon";
import { useDemo } from "@/components/demo/DemoProvider";
import { SharedDemoTarget, sharedDemoCopy, submitSharedDemoRequest, useSharedDemoTarget } from "@/components/demo/SharedDemoTarget";
import type { DemoInput } from "@/lib/demo-types";
import { localizedPath, type Locale } from "@/lib/i18n";
import { usePublished } from "@/components/cms/PublishedProvider";
import { normalizeWholesale } from "@/lib/commerce-workflow";
import { workflowCopy } from "@/content/workflow";
import { resolveSellingDetails } from "@/lib/business-settings";
import { customerFormCopy, customerRequestFingerprint, normalizeCustomerNumber, type FieldRules } from "@/lib/customer-form";
import { useCustomerForm } from "@/components/customer/useCustomerForm";
import { FieldError, FormErrorSummary, FormRecovery } from "@/components/customer/FormFeedback";
import styles from "./ContactForm.module.css";
const recoverableFields = ["name", "email", "phone", "subject", "message", "product", "quantity", "business", "destination", "neededBy"] as const;
const copy = {
  ar: contactArabic,
  th: {
    title: "ฝากข้อความถึงเรา",
    name: "ชื่อของคุณ",
    email: "อีเมล",
    subject: "เรื่องที่ต้องการสอบถาม",
    message: "ข้อความ",
    placeholder: "บอกเราเกี่ยวกับสิ่งที่คุณสนใจ หรือคำถามของคุณ",
    consent: "ฉันยินยอมให้ใช้ข้อมูลที่ส่งมาเพื่อตอบคำถามนี้ ตาม",
    privacy: "ข้อมูลความเป็นส่วนตัว",
    send: "ส่งข้อความ",
    sending: "กำลังส่งข้อความ…",
    success: "ได้รับข้อความของคุณแล้ว ขอบคุณที่ติดต่อ VETRA STORE",
    demoHint: "ตัวอย่าง: บันทึกในเบราว์เซอร์นี้เท่านั้น ยังไม่ส่งข้อความถึงทีมงาน",
    demoSend: "บันทึกข้อความตัวอย่าง",
    demoSuccess: "บันทึกข้อความตัวอย่างแล้ว เลขอ้างอิง",
    demoError: "ยังบันทึกตัวอย่างไม่ได้ กรุณาตรวจสอบว่าบราว์เซอร์อนุญาตให้จัดเก็บข้อมูล ข้อมูลของคุณยังอยู่ในแบบฟอร์ม",
    error:
      "ขณะนี้ยังส่งข้อความไม่สำเร็จ ข้อมูลของคุณยังอยู่ในแบบฟอร์ม กรุณาลองอีกครั้งภายหลัง",
    invalid: "กรุณาตรวจสอบข้อมูลและยืนยันความยินยอมก่อนส่ง",
    rate: "คุณส่งคำขอหลายครั้ง กรุณารอสักครู่แล้วลองใหม่",
    options: [
      ["general", "สอบถามทั่วไป"],
      ["product", "ข้อมูลสินค้า"],
      ["wholesale", "ค้าส่งและความร่วมมือ"],
      ["order", "สอบถามคำสั่งซื้อ"],
      ["privacy", "ข้อมูลส่วนบุคคล"],
    ],
  },
  en: {
    title: "Leave us a note",
    name: "Your name",
    email: "Email address",
    subject: "What is it about?",
    message: "Your message",
    placeholder: "Tell us what you have in mind, or how we can help.",
    consent:
      "I agree to my details being used to respond to this inquiry, as described in the",
    privacy: "privacy information",
    send: "Send message",
    sending: "Sending your message…",
    success:
      "Your message has been received. Thank you for getting in touch with VETRA STORE.",
    demoHint: "Demo: saved in this browser only. No message is sent to the team.",
    demoSend: "Save demo message",
    demoSuccess: "Demo message saved. Reference",
    demoError: "The demo could not be saved. Check that browser storage is allowed. Your details are still in the form.",
    error:
      "Your message could not be sent right now. Your details are still in the form. Please try again later.",
    invalid:
      "Please check your details and confirm your consent before sending.",
    rate: "You have sent several requests. Please wait a little and try again.",
    options: [
      ["general", "General inquiry"],
      ["product", "Product information"],
      ["wholesale", "Wholesale & partnerships"],
      ["order", "Order inquiry"],
      ["privacy", "Personal information"],
    ],
  },
};
export default function ContactForm({
  locale,
  initialSubject = "general",
  initialWholesale = {},
}: {
  locale: Locale;
  initialSubject?: string;
  initialWholesale?: Partial<Record<"product" | "quantity" | "business" | "destination" | "neededBy", string>>;
}) {
  const c = copy[locale];
  const f = customerFormCopy[locale];
  const w = workflowCopy[locale];
  const { products, content } = usePublished();
  const selling = resolveSellingDetails(content.settings, locale);
  const [subject, setSubject] = useState(c.options.some(([key]) => key === initialSubject) ? initialSubject : "general");
  const demo = useDemo();
  const sharedDemo = useSharedDemoTarget(demo.enabled), sharedCopy = sharedDemoCopy[locale];
  const [status, setStatus] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const submission = useRef<{ id: string; payload: string } | null>(null);
  const inFlight = useRef(false);
  const rules: FieldRules = {
    name: { label: c.name, required: true, max: 100 }, email: { label: c.email, required: true, max: 254, kind: "email" },
    subject: { label: c.subject, required: true, options: c.options.map(([key]) => key) }, phone: { label: w.phone, max: 30 },
    message: { label: c.message, required: true, min: 10, max: 5000 }, consent: { label: c.privacy, kind: "consent" },
    ...(subject === "wholesale" ? {
      product: { label: w.product, required: true, options: products.map((product) => product.id) }, quantity: { label: w.quantity, required: true, kind: "quantity" as const },
      business: { label: w.business, required: true, max: 160 }, destination: { label: w.destination, required: true, max: 500 }, neededBy: { label: w.neededBy, kind: "date" as const },
    } : {}),
  };
  const feedback = useCustomerForm({ locale, kind: "contact", rules, allowed: recoverableFields, onRestore: (values) => { setSubject(c.options.some(([key]) => key === values.subject) ? values.subject : "general"); setStatus(null); } });
  const { attachForm } = feedback;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !sharedDemo.ready) return;
    const form = event.currentTarget;
    if (!feedback.validate()) return;
    const data = new FormData(form);
    const payload = {
      name: String(data.get("name") || ""),
      email: String(data.get("email") || ""),
      subject: String(data.get("subject") || ""),
      message: String(data.get("message") || ""),
      consent: data.get("consent") === "on",
      website: String(data.get("website") || ""),
      locale,
      phone: normalizeCustomerNumber(String(data.get("phone") || "")),
      ...(subject === "wholesale" ? { wholesale: { productId: String(data.get("product") || ""), quantity: Number(normalizeCustomerNumber(String(data.get("quantity") || ""))), business: String(data.get("business") || ""), destination: String(data.get("destination") || ""), neededBy: String(data.get("neededBy") || "") } } : {}),
    };
    const serialized = JSON.stringify({ ...payload, target: demo.enabled ? sharedDemo.target : "real" });
    if (!payload.consent || payload.website || !payload.name.trim() || payload.message.trim().length < 10) {
      setStatus({ kind: "error", text: c.invalid });
      return;
    }
    setPending(true);
    inFlight.current = true;
    setStatus(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const fingerprint = await customerRequestFingerprint(serialized), recovered = feedback.getSubmission();
      if (!submission.current || submission.current.payload !== fingerprint)
        submission.current = { id: recovered?.fingerprint === fingerprint ? recovered.id : crypto.randomUUID(), payload: fingerprint };
      feedback.saveSubmission({ id: submission.current.id, fingerprint });
      if (payload.wholesale) normalizeWholesale(payload.wholesale, products);
      if (demo.enabled) {
        const input: DemoInput = {
          kind: payload.subject === "wholesale" ? "wholesale" : "contact",
          locale, name: payload.name, email: payload.email,
          message: payload.message, customer: { subject: payload.subject },
          phone: payload.phone, ...(payload.wholesale ? { wholesale: payload.wholesale } : {}),
        };
        const record = sharedDemo.target === "shared" ? await submitSharedDemoRequest(input, submission.current.id, controller.signal) : demo.submit(input, submission.current.id);
        setStatus({ kind: "success", text: `${sharedDemo.target === "shared" ? sharedCopy.success : c.demoSuccess} ${record.reference}` });
        form.reset();
        feedback.clearRecovery(); feedback.resetValidation(); setSubject(c.options.some(([key]) => key === initialSubject) ? initialSubject : "general");
        submission.current = null;
        return;
      }
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          submissionId: submission.current.id,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        setStatus({
          kind: "error",
          text:
            response.status === 400
              ? c.invalid
              : response.status === 429
                ? c.rate
                : c.error,
        });
        return;
      }
      setStatus({ kind: "success", text: c.success });
      form.reset();
      feedback.clearRecovery(); feedback.resetValidation(); setSubject(c.options.some(([key]) => key === initialSubject) ? initialSubject : "general");
      submission.current = null;
    } catch {
      setStatus({ kind: "error", text: demo.enabled ? sharedDemo.target === "shared" ? sharedCopy.error : c.demoError : c.error });
    } finally {
      clearTimeout(timeout);
      setPending(false);
      inFlight.current = false;
    }
  }
  return (
    <form ref={attachForm} onSubmit={submit} onChange={feedback.changed} onBlur={feedback.blurred} noValidate className={styles.form} aria-busy={pending}>
      <h2>{c.title}</h2>
      <p className={styles.requiredHint}>{f.requiredHint}</p>
      <FormErrorSummary state={feedback} locale={locale} />
      {feedback.candidate && <FormRecovery state={feedback} locale={locale} disabled={pending} />}
      <fieldset disabled={pending} className={styles.section}>
      <legend>{f.contactDetails}</legend>
      <div className={styles.row}>
        <label className={styles.field}>
          {c.name} *
          <input {...feedback.field("name")} name="name" autoComplete="name" required maxLength={100} />
          <FieldError state={feedback} name="name" />
        </label>
        <label className={styles.field}>
          {c.email} *
          <input
            {...feedback.field("email")}
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
          <FieldError state={feedback} name="email" />
        </label>
      </div>
      <label className={styles.field}>{w.phone}<input {...feedback.field("phone")} name="phone" type="tel" autoComplete="tel" maxLength={30} /><FieldError state={feedback} name="phone" /></label>
      </fieldset>
      <fieldset disabled={pending} className={styles.section}>
      <legend>{f.messageDetails}</legend>
      <label className={styles.field}>
        {c.subject}
        <select {...feedback.field("subject")} name="subject" value={subject} onChange={(event) => { setSubject(event.target.value); setStatus(null); feedback.resetValidation(); }}>
          {c.options.map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
        <FieldError state={feedback} name="subject" />
      </label>
      {subject === "wholesale" && <fieldset className={styles.wholesale}>
        <legend>{w.wholesaleTitle}</legend>
        <div className={styles.row}>
          <label className={styles.field}>{w.product} *<select {...feedback.field("product")} name="product" required defaultValue={products.some((product) => product.id === initialWholesale.product) ? initialWholesale.product : ""}><option value="">{w.chooseProduct}</option>{products.map((product) => <option value={product.id} key={product.id}>{product.name[locale]}</option>)}</select><FieldError state={feedback} name="product" /></label>
          <label className={styles.field}>{w.quantity} *<input {...feedback.field("quantity")} name="quantity" type="text" inputMode="numeric" required maxLength={7} defaultValue={initialWholesale.quantity} /><FieldError state={feedback} name="quantity" /></label>
        </div>
        <label className={styles.field}>{w.business} *<input {...feedback.field("business")} name="business" autoComplete="organization" required maxLength={160} defaultValue={initialWholesale.business} /><FieldError state={feedback} name="business" /></label>
        <label className={styles.field}>{w.destination} *<input {...feedback.field("destination")} name="destination" required maxLength={500} defaultValue={initialWholesale.destination} /><FieldError state={feedback} name="destination" /></label>
        <label className={styles.field}>{w.neededBy}<input {...feedback.field("neededBy")} name="neededBy" type="date" defaultValue={initialWholesale.neededBy} /><FieldError state={feedback} name="neededBy" /></label>
        <p>{w.wholesaleNote}</p>
        <p>{selling.wholesale.description}</p>
      </fieldset>}
      <label className={styles.field}>
        {c.message} *
        <textarea
          {...feedback.field("message", `${feedback.field("message").id}-hint`)}
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={5}
          placeholder={c.placeholder}
        />
        <span className={styles.hint} id={`${feedback.field("message").id}-hint`}>{f.messageHint}</span>
        <FieldError state={feedback} name="message" />
      </label>
      </fieldset>
      <div className={styles.trap} aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className={styles.consent}>
        <input {...feedback.field("consent")} name="consent" type="checkbox" required disabled={pending} />
        <span>
          {c.consent}{" "}
          <Link href={localizedPath(locale, "/help#privacy")}>{c.privacy}</Link> *
          <FieldError state={feedback} name="consent" />
        </span>
      </label>
      {!feedback.candidate && <FormRecovery state={feedback} locale={locale} disabled={pending} />}
      {demo.enabled && <SharedDemoTarget locale={locale} state={sharedDemo} disabled={pending} />}
      <button
        type="submit"
        className={`button ${styles.submit}`}
        disabled={pending || !sharedDemo.ready || (demo.enabled && sharedDemo.target === "browser" && !demo.hydrated)}
      >
        {pending ? c.sending : demo.enabled ? c.demoSend : c.send}
        <Icon name="chevron" size={18} />
      </button>
      {pending && <p role="status" className={styles.hint}>{f.saving}</p>}
      {status && (
        <p
          className={`${styles.status} ${styles[status.kind]}`}
          role={status.kind === "error" ? "alert" : "status"}
        >
          {status.text}
        </p>
      )}
    </form>
  );
}

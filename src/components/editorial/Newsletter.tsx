"use client";
import { newsletterArabic } from "@/content/customer-ar";
import Link from "@/components/loading/NavigationLink";
import { useId, useRef, useState, type FormEvent } from "react";
import { useDemo } from "@/components/demo/DemoProvider";
import Icon from "@/components/Icon";
import { localizedPath, type Locale } from "@/lib/i18n";
import styles from "./Newsletter.module.css";
const copy = {
  ar: newsletterArabic,
  th: {
    email: "อีเมลของคุณ",
    subscribe: "รับข่าวสารจาก VETRA",
    consent: "ฉันยินยอมรับข่าวสารทางอีเมลจาก VETRA ตาม",
    privacy: "ข้อมูลความเป็นส่วนตัว",
    success: "บันทึกการสมัครรับข่าวสารแล้ว ขอบคุณที่ติดตามเรา",
    error: "ยังสมัครไม่สำเร็จ กรุณาลองใหม่ภายหลัง",
    invalid: "กรุณาตรวจสอบอีเมลและยืนยันความยินยอม",
    pending: "กำลังบันทึก…",
    demoHint: "ตัวอย่างเท่านั้น บันทึกในเบราว์เซอร์ ยังไม่มีอีเมลส่งออก",
    demoSuccess: "บันทึกการสมัครตัวอย่างแล้ว ยังไม่มีการส่งอีเมล",
    subscriber: "ผู้สมัครข่าวสาร",
  },
  en: {
    email: "Your email address",
    subscribe: "Subscribe to VETRA news",
    consent: "I agree to receive VETRA emails, as described in the",
    privacy: "privacy information",
    success: "Your subscription is saved. Thank you for joining us.",
    error: "We could not save your subscription. Please try again later.",
    invalid: "Please check your email and confirm your consent.",
    pending: "Saving your subscription…",
    demoHint: "Demo only. Saved in this browser; no emails are sent.",
    demoSuccess: "Demo subscription saved. No email has been sent.",
    subscriber: "Newsletter subscriber",
  },
};
export default function Newsletter({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const demo = useDemo();
  const inFlight = useRef(false);
  const id = useId();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    if (data.get("consent") !== "on" || data.get("website")) {
      setStatus({ ok: false, text: c.invalid });
      return;
    }
    inFlight.current = true;
    setPending(true);
    setStatus(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      if (demo.enabled) {
        demo.submit({ kind: "newsletter", locale, name: c.subscriber, email: String(data.get("email") || "") });
        setStatus({ ok: true, text: c.demoSuccess });
        form.reset();
        return;
      }
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(data.get("email") || ""),
          consent: data.get("consent") === "on",
          website: String(data.get("website") || ""),
          locale,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        setStatus({
          ok: false,
          text: response.status === 400 ? c.invalid : c.error,
        });
        return;
      }
      setStatus({ ok: true, text: c.success });
      form.reset();
    } catch {
      setStatus({ ok: false, text: c.error });
    } finally {
      clearTimeout(timeout);
      setPending(false);
      inFlight.current = false;
    }
  }
  return (
    <form className={styles.form} onSubmit={submit}>
      <label className="srOnly" htmlFor={id}>
        {c.email}
      </label>
      <div className={styles.inputRow}>
        <input
          className={styles.input}
          type="email"
          name="email"
          id={id}
          autoComplete="email"
          placeholder={c.email}
          required
          maxLength={254}
        />
        <button
          className={styles.button}
          type="submit"
          disabled={pending || (demo.enabled && !demo.hydrated)}
          aria-label={c.subscribe}
        >
          <Icon name="arrow" size={20} />
        </button>
      </div>
      <div className={styles.trap} aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className={styles.consent}>
        <input type="checkbox" name="consent" required />
        <span>
          {c.consent}{" "}
          <Link href={localizedPath(locale, "/help#privacy")}>{c.privacy}</Link>
        </span>
      </label>
      {demo.enabled && <p className={styles.status}>{c.demoHint}</p>}
      {pending && (
        <p className={styles.status} role="status">
          {c.pending}
        </p>
      )}
      {status && (
        <p className={styles.status} role={status.ok ? "status" : "alert"}>
          {status.text}
        </p>
      )}
    </form>
  );
}

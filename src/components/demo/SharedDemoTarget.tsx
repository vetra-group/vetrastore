"use client";
import { sharedDemoArabic } from "@/content/customer-ar";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import type { DemoInput } from "@/lib/demo-types";
import styles from "./SharedDemoTarget.module.css";

export const sharedDemoCopy = {
  ar: sharedDemoArabic,
  en: { target: "Save test enquiry to", shared: "Shared staff inbox", browser: "This browser only", checking: "Checking local test storage…", sharedNote: "Saved on this local server for staff testing from another browser. No email or payment is sent.", browserNote: "Saved only in this browser. Staff using another browser cannot see this test.", unavailable: "Shared test storage is unavailable. You can keep your input and retry, or choose this browser only.", success: "Test enquiry saved in the shared staff inbox. Reference", error: "We could not confirm the shared save. Your input is preserved. Retry with the same details to avoid a duplicate.", enquiry: "Shared test enquiry", consent: "I agree to save these test details on this local server, as described in the" },
  th: { target: "บันทึกคำสอบถามทดสอบที่", shared: "กล่องคำขอร่วมของทีมงาน", browser: "เบราว์เซอร์นี้เท่านั้น", checking: "กำลังตรวจสอบพื้นที่ทดสอบ…", sharedNote: "บันทึกบนเซิร์ฟเวอร์ภายในเครื่อง เพื่อให้ทีมงานทดสอบจากเบราว์เซอร์อื่นได้ ไม่ส่งอีเมลหรือเรียกเก็บเงิน", browserNote: "บันทึกเฉพาะเบราว์เซอร์นี้ ทีมงานในเบราว์เซอร์อื่นจะไม่เห็นคำขอทดสอบนี้", unavailable: "พื้นที่ทดสอบร่วมยังไม่พร้อม ข้อมูลที่กรอกยังอยู่ ลองใหม่หรือเลือกบันทึกในเบราว์เซอร์นี้เท่านั้น", success: "บันทึกคำสอบถามทดสอบในกล่องคำขอร่วมแล้ว เลขอ้างอิง", error: "ยังยืนยันการบันทึกร่วมไม่ได้ ข้อมูลที่กรอกยังอยู่ ลองส่งรายละเอียดเดิมอีกครั้งเพื่อป้องกันรายการซ้ำ", enquiry: "คำสอบถามทดสอบร่วม", consent: "ฉันยินยอมให้บันทึกข้อมูลทดสอบนี้บนเซิร์ฟเวอร์ภายในเครื่อง ตาม" },
};
export function useSharedDemoTarget(enabled: boolean) {
  const [target, setTarget] = useState<"shared" | "browser">("shared");
  const [availability, setAvailability] = useState<"checking" | "available" | "unavailable">("checking");
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void fetch("/api/demo/requests", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) })
      .then(async (response) => { if (!response.ok) throw new Error("Storage unavailable"); return response.json(); })
      .then((value) => { if (controller.signal.aborted) return; setAvailability(value.available ? "available" : "unavailable"); if (!value.available) setTarget("browser"); })
      .catch(() => { if (!controller.signal.aborted) setAvailability("unavailable"); });
    return () => controller.abort();
  }, [enabled]);
  return { target, setTarget, availability, ready: !enabled || target === "browser" || availability !== "checking" };
}
export function SharedDemoTarget({ locale, state, disabled }: { locale: Locale; state: ReturnType<typeof useSharedDemoTarget>; disabled?: boolean }) {
  const t = sharedDemoCopy[locale];
  return <div className={styles.target}><label>{t.target}<select disabled={disabled} value={state.target} onChange={(event) => state.setTarget(event.target.value as "shared" | "browser")}><option value="shared">{t.shared}</option><option value="browser">{t.browser}</option></select></label><p>{state.target === "browser" ? t.browserNote : state.availability === "checking" ? t.checking : state.availability === "unavailable" ? t.unavailable : t.sharedNote}</p></div>;
}
export async function submitSharedDemoRequest(input: DemoInput, submissionId: string, signal?: AbortSignal): Promise<{ reference: string }> {
  // Price and total are calculated from the server's published catalog.
  const details = { ...input }; delete details.subtotal;
  const response = await fetch("/api/demo/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: details, submissionId, consent: true, website: "" }), signal: signal || AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!response.ok || typeof result.reference !== "string") throw new Error("Shared save unconfirmed");
  return { reference: result.reference };
}

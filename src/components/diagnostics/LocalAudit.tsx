"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { isLocale, languageConfig } from "@/lib/i18n";
import styles from "./LocalAudit.module.css";

type PaintEntry = PerformanceEntry & { value?: number; hadRecentInput?: boolean; interactionId?: number };
type Samples = { lcpMs: number | null; cls: number; sessionStart: number; lastShift: number; sessionScore: number; longestInteractionMs: number | null; longTaskMs: number; supported: string[] };
const emptySamples = (): Samples => ({ lcpMs: null, cls: 0, sessionStart: 0, lastShift: 0, sessionScore: 0, longestInteractionMs: null, longTaskMs: 0, supported: [] });
const subscribe = () => () => {};
const localAuditEnabled = () => ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) && new URLSearchParams(location.search).get("audit") === "1";
const copy = {
  en: { title: "Local quality checks", intro: "Lab observations only. Nothing is sent or stored. Capture after loading and interacting. Reload for a fresh navigation sample.", baseline: "Text baseline simulation", browser: "Browser default", zoom: "32px (200% of 16px)", note: "This tests larger rem text. It does not change actual browser zoom or font preferences.", capture: "Capture local report", report: "Local performance report" },
  ar: { title: "فحوص الجودة المحلية", intro: "ملاحظات اختبار محلي فقط. لا يُرسل أو يُخزّن شيء. التقط التقرير بعد التحميل والتفاعل مع الصفحة. أعد التحميل لأخذ عيّنة تصفح جديدة.", baseline: "محاكاة حجم النص الأساسي", browser: "الإعداد الافتراضي للمتصفح", zoom: "32 بكسل (200٪ من 16 بكسل)", note: "يختبر هذا الخيار تكبير النص بوحدة rem. ولا يغيّر تكبير المتصفح الفعلي أو تفضيلات الخط.", capture: "التقاط التقرير المحلي", report: "تقرير الأداء المحلي" },
  th: { title: "ตรวจสอบคุณภาพในเครื่อง", intro: "ผลทดสอบในเครื่องเท่านั้น ไม่มีการส่งหรือเก็บข้อมูล เก็บรายงานหลังโหลดและใช้งานหน้าเว็บ โหลดใหม่เพื่อเริ่มการวัดครั้งใหม่", baseline: "จำลองขนาดตัวอักษรพื้นฐาน", browser: "ค่าเริ่มต้นของเบราว์เซอร์", zoom: "32px (200% ของ 16px)", note: "ทดสอบข้อความ rem ที่ใหญ่ขึ้น ไม่เปลี่ยนการซูมจริงหรือการตั้งค่าแบบอักษรของเบราว์เซอร์", capture: "เก็บรายงานในเครื่อง", report: "รายงานประสิทธิภาพในเครื่อง" },
};

/** Opt-in local diagnostics. No analytics, cookies, uploads, or customer data. */
export default function LocalAudit() {
  const segment = usePathname().split("/")[1];
  const c = copy[isLocale(segment) ? segment : languageConfig.defaultLocale];
  const enabled = useSyncExternalStore(subscribe, localAuditEnabled, () => false);
  const [report, setReport] = useState("");
  const [baseline, setBaseline] = useState("default");
  const samples = useRef(emptySamples());
  const observers = useRef<PerformanceObserver[]>([]);
  const applyEntries = useRef<(entries: PerformanceEntry[]) => void>(() => {});
  useEffect(() => {
    if (!enabled) return;
    samples.current = emptySamples();
    const supported = PerformanceObserver.supportedEntryTypes ?? [];
    samples.current.supported = [...supported];
    const collect = (entries: PerformanceEntry[]) => {
      for (const raw of entries) {
        const entry = raw as PaintEntry, value = samples.current;
        if (entry.entryType === "largest-contentful-paint") value.lcpMs = entry.startTime;
        if (entry.entryType === "layout-shift" && !entry.hadRecentInput) {
          if (entry.startTime - value.lastShift > 1000 || entry.startTime - value.sessionStart > 5000) { value.sessionStart = entry.startTime; value.sessionScore = 0; }
          value.lastShift = entry.startTime; value.sessionScore += entry.value ?? 0; value.cls = Math.max(value.cls, value.sessionScore);
        }
        if (entry.entryType === "event" && entry.interactionId) value.longestInteractionMs = Math.max(value.longestInteractionMs ?? 0, entry.duration);
        if (entry.entryType === "longtask") value.longTaskMs += entry.duration;
      }
    };
    applyEntries.current = collect;
    for (const type of ["largest-contentful-paint", "layout-shift", "event", "longtask"]) {
      if (!supported.includes(type)) continue;
      const observer = new PerformanceObserver((list) => collect(list.getEntries()));
      observer.observe({ type, buffered: true, ...(type === "event" ? { durationThreshold: 16 } : {}) });
      observers.current.push(observer);
    }
    return () => { observers.current.forEach((observer) => observer.disconnect()); observers.current = []; };
  }, [enabled]);
  useEffect(() => {
    if (!enabled || baseline === "default") return;
    const root = document.documentElement, previous = root.style.getPropertyValue("--root-font-base");
    root.style.setProperty("--root-font-base", `${baseline}px`);
    return () => { if (previous) root.style.setProperty("--root-font-base", previous); else root.style.removeProperty("--root-font-base"); };
  }, [baseline, enabled]);
  function capture() {
    observers.current.forEach((observer) => applyEntries.current(observer.takeRecords()));
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const root = document.documentElement, value = samples.current;
    setReport(JSON.stringify({
      capturedAt: new Date().toISOString(), path: location.pathname, environment: "Local lab sample; no CPU throttling; not field Core Web Vitals",
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio, rootPx: getComputedStyle(root).fontSize, textBaselineSimulation: baseline, horizontalOverflow: root.scrollWidth > innerWidth },
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      metrics: { ttfbMs: navigation ? Math.round(navigation.responseStart - navigation.startTime) : null, fcpMs: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null, lcpSoFarMs: value.lcpMs, clsSoFar: Number(value.cls.toFixed(5)), longestObservedInteractionMs: value.longestInteractionMs, totalLongTaskMs: Math.round(value.longTaskMs) },
      fontStatus: document.fonts.status, supportedEntryTypes: value.supported,
      resources: resources.map((entry) => ({ path: new URL(entry.name).pathname, type: entry.initiatorType, encodedBytes: entry.encodedBodySize, transferBytes: entry.transferSize, durationMs: Math.round(entry.duration) })),
      images: Array.from(document.images).map((image) => ({ path: new URL(image.currentSrc || image.src, location.href).pathname, loading: image.loading, priority: image.fetchPriority, renderedWidth: Math.round(image.getBoundingClientRect().width), complete: image.complete && image.naturalWidth > 0 })),
    }, null, 2));
  }
  if (!enabled) return null;
  return <aside className={styles.audit} aria-label={c.title}><details><summary>{c.title}</summary><p>{c.intro}</p><label>{c.baseline}<select value={baseline} onChange={(event) => setBaseline(event.target.value)}><option value="default">{c.browser}</option><option value="20">20px</option><option value="24">24px</option><option value="32">{c.zoom}</option></select></label><p>{c.note}</p><button type="button" onClick={capture}>{c.capture}</button>{report && <pre tabIndex={0} dir="ltr" aria-label={c.report}>{report}</pre>}</details></aside>;
}

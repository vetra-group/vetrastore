"use client";

import { cmsArabicUi } from "@/content/cms-ar-ui";

import { useState } from "react";
import { ArrowRight, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import styles from "./CmsSignIn.module.css";

export default function CmsSignIn({ locale, mode, busy, onLogin, error, onRetry }: { locale: Locale; mode: "local" | "configured" | "unavailable"; busy: boolean; onLogin: (credentials: { email?: string; password?: string }) => void; error?: string; onRetry: () => void }) {
  const [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const th = locale === "th";
  return <section className={styles.panel}>
    <span className={styles.badge}><ShieldCheck aria-hidden="true" />{mode === "local" ? (locale === "ar" ? cmsArabicUi["Local workspace"] : th ? "พื้นที่ทดลองในเครื่อง" : "Local workspace") : (locale === "ar" ? cmsArabicUi["VETRA staff"] : th ? "สำหรับทีมงาน VETRA" : "VETRA staff")}</span>
    <h1>{locale === "ar" ? cmsArabicUi["Your store, thoughtfully managed"] : th ? "ดูแลร้านของคุณ" : "Your store, thoughtfully managed"}</h1>
    <p>{mode === "unavailable" ? (locale === "ar" ? cmsArabicUi["CMS access is not configured for this environment. Check the setup, then try again."] : th ? "ระบบจัดการยังไม่พร้อมใช้งาน กรุณาตรวจสอบการตั้งค่าแล้วลองอีกครั้ง" : "CMS access is not configured for this environment. Check the setup, then try again.") : mode === "local" ? (locale === "ar" ? cmsArabicUi["Manage products, articles, and store details in this local preview."] : th ? "จัดการสินค้า บทความ และข้อมูลร้านในพื้นที่ทดลองนี้" : "Manage products, articles, and store details in this local preview.") : (locale === "ar" ? cmsArabicUi["Sign in with your staff account."] : th ? "เข้าสู่ระบบด้วยบัญชีทีมงานของคุณ" : "Sign in with your staff account.")}</p>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {mode === "unavailable" ? <button className="button buttonOutline" type="button" onClick={onRetry}><RefreshCw aria-hidden="true" />{locale === "ar" ? cmsArabicUi["Try again"] : th ? "ลองอีกครั้ง" : "Try again"}</button> : <form className={styles.form} onSubmit={(event) => { event.preventDefault(); onLogin(mode === "configured" ? { email, password } : {}); }}>
      {mode === "configured" && <><label>{locale === "ar" ? cmsArabicUi["Email"] : th ? "อีเมล" : "Email"}<input type="email" autoComplete="username" required maxLength={200} value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>{locale === "ar" ? cmsArabicUi["Password"] : th ? "รหัสผ่าน" : "Password"}<input type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} /></label></>}
      <button className="button" disabled={busy} type="submit">{busy ? <LoaderCircle className={styles.loading} aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}{busy ? (locale === "ar" ? cmsArabicUi["Signing in…"] : th ? "กำลังเข้าสู่ระบบ" : "Signing in…") : mode === "local" ? (locale === "ar" ? cmsArabicUi["Enter local workspace"] : th ? "เข้าสู่พื้นที่ทดลอง" : "Enter local workspace") : (locale === "ar" ? cmsArabicUi["Sign in"] : th ? "เข้าสู่ระบบ" : "Sign in")}</button>
    </form>}
  </section>;
}

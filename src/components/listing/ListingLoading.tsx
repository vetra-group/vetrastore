"use client";

import { usePathname } from "next/navigation";
import { languageConfig } from "@/lib/i18n";
import styles from "./ListingLoading.module.css";

export default function ListingLoading() {
  const pathname = usePathname();
  const locale = languageConfig.locales.find(({ code }) => pathname === `/${code}` || pathname.startsWith(`/${code}/`))?.code ?? languageConfig.defaultLocale;
  return <div className={`container ${styles.loading}`} role="status" aria-live="polite" aria-busy="true"><p>{locale === "th" ? "กำลังโหลดรายการ…" : locale === "ar" ? "جارٍ تحميل النتائج…" : "Loading results…"}</p><div className={styles.placeholders} aria-hidden="true"><span /><span /><span /></div></div>;
}

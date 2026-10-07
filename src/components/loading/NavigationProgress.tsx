"use client";

import { createPortal } from "react-dom";
import { loadingCopy } from "@/content/loading";
import type { Locale } from "@/lib/i18n";
import { useLoadingLocale } from "./LoadingScreen";
import styles from "./NavigationProgress.module.css";

export default function NavigationProgress({ pending, locale: suppliedLocale }: { pending: boolean; locale?: Locale }) {
  const routeLocale = useLoadingLocale();
  const locale = suppliedLocale ?? routeLocale;
  if (!pending || typeof document === "undefined") return null;
  return createPortal(<div className={styles.progress} data-navigation-loading="true">
    <span className="srOnly" role="status" lang={locale}>{loadingCopy[locale].navigation}</span>
    <span className={styles.track} aria-hidden="true" />
  </div>, document.body);
}

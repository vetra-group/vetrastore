"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { loadingCopy } from "@/content/loading";
import { isLocale, languageConfig, localeSettings, type Locale } from "@/lib/i18n";
import styles from "./LoadingScreen.module.css";

type Props = {
  variant?: "page" | "admin" | "panel" | "compact";
  layout?: "cards" | "content" | "form";
  locale?: Locale;
  label?: string;
  detail?: string;
};

export function useLoadingLocale() {
  const first = usePathname().split("/")[1];
  return isLocale(first) ? first : languageConfig.defaultLocale;
}

function Skeleton({ layout }: { layout: NonNullable<Props["layout"]> }) {
  return <div className={styles.skeleton} data-layout={layout} aria-hidden="true">
    {layout === "cards" ? <div className={styles.cards}>{[0, 1, 2].map((key) => <div className={styles.card} key={key}><span className={styles.photo} /><span className={styles.line} /><span className={`${styles.line} ${styles.short}`} /></div>)}</div>
      : layout === "form" ? <div className={styles.form}><span className={styles.line} /><div className={styles.fields}>{[0, 1, 2, 3].map((key) => <span key={key} className={styles.field} />)}</div><span className={styles.action} /></div>
        : <div className={styles.content}><span className={styles.photo} /><div className={styles.prose}><span className={styles.line} /><span className={`${styles.line} ${styles.short}`} /><span className={styles.line} /><span className={styles.action} /></div></div>}
  </div>;
}

export default function LoadingScreen({ variant = "page", layout = "cards", locale: suppliedLocale, label, detail }: Props) {
  const routeLocale = useLoadingLocale();
  const locale = suppliedLocale ?? routeLocale;
  const t = loadingCopy[locale];
  const title = label ?? (variant === "admin" ? t.adminTitle : variant === "page" ? t.pageTitle : t.panelTitle);
  const description = detail ?? (variant === "compact" ? "" : variant === "admin" ? t.adminDetail : variant === "page" ? t.pageDetail : t.panelDetail);
  return <div className={styles.stage} data-loading={variant} lang={locale} dir={localeSettings(locale).direction}>
    <span className="srOnly" role="status" aria-live="polite" aria-atomic="true">{title}{description ? `. ${description}` : ""}</span>
    {variant === "admin" && <aside className={styles.rail} aria-hidden="true"><Image src="/vetra-store-logo.svg" alt="" width={180} height={72} /><div>{[0, 1, 2, 3, 4, 5].map((key) => <span key={key} />)}</div><span className={styles.railFoot} /></aside>}
    <div className={styles.body} aria-busy="true" aria-hidden="true">
      <div className={styles.identity}>
        <div className={styles.emblem}><span className={styles.orbit} />{variant !== "compact" && <Image src="/vetra-store-logo.svg" alt="" width={180} height={72} className={styles.logo} />}</div>
        <div className={styles.copy}><p className={styles.title}>{title}</p>{description && <p className={styles.detail}>{description}</p>}</div>
        {variant !== "compact" && <span className={styles.rule} />}
      </div>
      {variant !== "compact" && <Skeleton layout={layout} />}
    </div>
  </div>;
}

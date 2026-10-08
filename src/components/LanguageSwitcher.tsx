"use client";

import { Suspense, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, X } from "lucide-react";
import { languageConfig, locales, localizedPath, type Locale } from "@/lib/i18n";
import NavigationProgress from "@/components/loading/NavigationProgress";
import { Modal } from "@/components/ui/Modal";
import { useStore } from "@/components/commerce/StoreProvider";
import styles from "./LanguageSwitcher.module.css";

const labels = { en: "Choose language", ar: "اختر اللغة", th: "เลือกภาษา" };
const closeLabels = { en: "Close language selection", ar: "إغلاق اختيار اللغة", th: "ปิดการเลือกภาษา" };
const unavailableLabels = { en: "Translation not available yet", ar: "الترجمة غير متاحة بعد", th: "ยังไม่มีคำแปล" };

function LanguageLinks({ locale, path, availableLocales = locales, query = "", close }: {
  locale: Locale;
  path: string;
  availableLocales?: readonly Locale[];
  query?: string;
  close: () => void;
}) {
  const router = useRouter();
  const { setLanguageCurrency } = useStore();
  const [navigating, startNavigation] = useTransition();

  return <>
    <NavigationProgress pending={navigating} locale={locale} />
    {languageConfig.locales.map((language) => !availableLocales.includes(language.code) ? (
      <span key={language.code} className={`${styles.pill} ${styles.unavailable}`} role="link" aria-disabled="true" lang={language.code} dir={language.direction}>
        <span>{language.label}</span>
        <small lang={locale}>{unavailableLabels[locale]}</small>
      </span>
    ) : (
      <a
        key={language.code}
        className={styles.pill}
        href={`${localizedPath(language.code, path)}${query ? `?${query}` : ""}`}
        hrefLang={language.code}
        lang={language.code}
        dir={language.direction}
        aria-current={locale === language.code ? "page" : undefined}
        onClick={(event) => {
          const destination = localizedPath(language.code, path) + window.location.search + window.location.hash;
          event.currentTarget.href = destination;
          // Bypass cached legacy document redirects when selecting Thai.
          if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
            setLanguageCurrency(language.code);
            if (language.code === locale) event.preventDefault();
            else if (language.code === "th") {
              event.preventDefault();
              startNavigation(() => router.push(destination));
            }
          }
          close();
        }}
      >
        <span>{language.label}</span>
        {locale === language.code && <Check aria-hidden="true" />}
      </a>
    ))}
  </>;
}

function QueryLinks(props: Omit<Parameters<typeof LanguageLinks>[0], "query">) {
  const params = useSearchParams();
  return <LanguageLinks {...props} query={params.toString()} />;
}

export default function LanguageSwitcher({ locale, path, availableLocales, onNavigate }: {
  locale: Locale;
  path: string;
  availableLocales?: readonly Locale[];
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); onNavigate(); };

  return <div className={styles.switcher}>
    <button
      type="button"
      className={styles.trigger}
      aria-label={`${labels[locale]} · ${languageConfig.locales.find((language) => language.code === locale)?.label}`}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls="store-languages"
      onClick={() => setOpen(true)}
    >
      <span className={styles.code} lang="en" aria-hidden="true">{locale.toUpperCase()}</span>
    </button>
    <Modal id="store-languages" label={labels[locale]} className={styles.dialog} open={open} onClose={close} initialFocusRef={closeRef}>
      <div className={styles.heading}>
        <h2>{labels[locale]}</h2>
        <button ref={closeRef} type="button" className={styles.close} onClick={close} aria-label={closeLabels[locale]}><X aria-hidden="true" /></button>
      </div>
      <nav className={styles.options} aria-label={labels[locale]}>
        <Suspense fallback={<LanguageLinks locale={locale} path={path} availableLocales={availableLocales} close={close} />}>
          <QueryLinks locale={locale} path={path} availableLocales={availableLocales} close={close} />
        </Suspense>
      </nav>
    </Modal>
  </div>;
}

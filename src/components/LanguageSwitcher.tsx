"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Globe2 } from "lucide-react";
import { languageConfig, locales, localizedPath, type Locale } from "@/lib/i18n";
import styles from "./LanguageSwitcher.module.css";

const labels = { en: "Choose language", ar: "اختر اللغة", th: "เลือกภาษา" };
const unavailableLabels = { en: "Translation not available yet", ar: "الترجمة غير متاحة بعد", th: "ยังไม่มีคำแปล" };

function LanguageLinks({ locale, path, availableLocales = locales, query = "", close }: { locale: Locale; path: string; availableLocales?: readonly Locale[]; query?: string; close: () => void }) {
  const router = useRouter();
  return languageConfig.locales.map(language => !availableLocales.includes(language.code) ? <span key={language.code} className={styles.unavailable} role="link" aria-disabled="true">
    <span lang={language.code} dir={language.direction}>{language.label}</span>
    <small>{unavailableLabels[locale]}</small>
  </span> : <a
    key={language.code}
    href={`${localizedPath(language.code, path)}${query ? `?${query}` : ""}`}
    hrefLang={language.code}
    lang={language.code}
    dir={language.direction}
    aria-current={locale === language.code ? "true" : undefined}
    onClick={event => {
      const destination = localizedPath(language.code, path) + window.location.search + window.location.hash;
      event.currentTarget.href = destination;
      // /th used to redirect permanently to English's current URL. Bypass
      // those cached document redirects when selecting Thai. Other languages
      // retain native navigation, including exact query and fragment handling.
      if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
        if (language.code === locale) {
          event.preventDefault();
        } else if (language.code === "th") {
          event.preventDefault();
          router.push(destination);
        }
      }
      close();
    }}
  ><span>{language.label}</span>{locale === language.code && <Check aria-hidden="true" />}</a>);
}

function QueryLinks(props: Omit<Parameters<typeof LanguageLinks>[0], "query">) {
  const params = useSearchParams();
  return <LanguageLinks {...props} query={params.toString()} />;
}

export default function LanguageSwitcher({ locale, path, availableLocales, onNavigate }: { locale: Locale; path: string; availableLocales?: readonly Locale[]; onNavigate: () => void }) {
  const details = useRef<HTMLDetailsElement>(null), trigger = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !details.current?.contains(event.target)) details.current?.removeAttribute("open"); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); details.current?.removeAttribute("open"); trigger.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  const close = () => { details.current?.removeAttribute("open"); onNavigate(); };
  return <details ref={details} className={styles.switcher} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary ref={trigger} aria-label={`${labels[locale]} · ${languageConfig.locales.find(language => language.code === locale)?.label}`} aria-expanded={open} aria-controls="store-languages"><Globe2 aria-hidden="true" /></summary>
    <nav id="store-languages" className={styles.options} aria-label={labels[locale]}>
      <Suspense fallback={<LanguageLinks locale={locale} path={path} availableLocales={availableLocales} close={close} />}><QueryLinks locale={locale} path={path} availableLocales={availableLocales} close={close} /></Suspense>
    </nav>
  </details>;
}

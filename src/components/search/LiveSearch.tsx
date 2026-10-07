"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, LoaderCircle, Search, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { formatPrice } from "@/lib/catalog";
import { publicPricingCopy } from "@/content/public-pricing";
import { localizedPath, type Locale } from "@/lib/i18n";
import type { QuickSearch } from "@/lib/search-suggestions";
import { quickSearchCopy } from "@/content/quick-search";
import styles from "./LiveSearch.module.css";

function Match({ text, query }: { text: string; query: string }) {
  const index = query.trim()
    ? text.toLocaleLowerCase().indexOf(query.trim().toLocaleLowerCase())
    : -1;

  return index < 0 ? text : (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + query.trim().length)}</mark>
      {text.slice(index + query.trim().length)}
    </>
  );
}

export default function LiveSearch({
  locale,
  open,
  onClose,
}: {
  locale: Locale;
  open: boolean;
  onClose: () => void;
}) {
  const t = quickSearchCopy[locale];
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [retry, setRetry] = useState(0);
  const [response, setResponse] = useState<{
    key: string;
    result?: QuickSearch;
    error?: boolean;
  } | null>(null);

  const key = `${locale}:${query.trim()}:${retry}`;
  const current = response?.key === key ? response : null;
  const busy = open && !current;
  const results = current?.result?.results || [];
  const selected = active >= 0 && active < results.length ? active : -1;
  const destination = localizedPath(
    locale,
    `/search${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`,
  );

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let currentRequest = true;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      timeout = setTimeout(() => controller.abort(), 10000);
      void fetch(
        `/api/search?locale=${locale}&q=${encodeURIComponent(query.trim())}`,
        { cache: "no-store", signal: controller.signal },
      )
        .then(async (response) => {
          if (!response.ok) throw new Error("Search unavailable");
          return response.json() as Promise<QuickSearch>;
        })
        .then((result) => {
          if (currentRequest) setResponse({ key, result });
        })
        .catch(() => {
          if (currentRequest) setResponse({ key, error: true });
        })
        .finally(() => clearTimeout(timeout));
    }, query.trim() ? 160 : 0);

    return () => {
      currentRequest = false;
      clearTimeout(timer);
      clearTimeout(timeout);
      controller.abort();
    };
  }, [key, locale, open, query]);

  useEffect(() => {
    if (selected >= 0) {
      document.getElementById(`quick-result-${selected}`)?.scrollIntoView({
        block: "nearest",
        behavior: "instant",
      });
    }
  }, [selected]);

  return (
    <Modal
      id="store-search"
      label={t.search}
      className={styles.dialog}
      open={open}
      animate
      onClose={onClose}
      initialFocusRef={input}
    >
      <div className={styles.heading}>
        <div>
          <p className="eyebrow">VETRA STORE</p>
          <h2 id="search-heading">{t.title}</h2>
          <p>{t.hint}</p>
        </div>
        <button
          type="button"
          className={styles.icon}
          aria-label={t.close}
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      </div>
      <form
        className={styles.form}
        action={localizedPath(locale, "/search")}
        onSubmit={onClose}
      >
        <Search aria-hidden="true" />
        <input
          ref={input}
          id="quick-search-input"
          type="search"
          name="q"
          maxLength={120}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(-1);
          }}
          placeholder={t.placeholder}
          aria-label={t.search}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && results.length > 0}
          aria-controls="quick-search-results"
          aria-describedby="quick-search-help"
          aria-activedescendant={
            selected >= 0 ? `quick-result-${selected}` : undefined
          }
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              if (results.length) {
                setActive((index) =>
                  event.key === "ArrowDown"
                    ? (index + 1) % results.length
                    : index <= 0
                      ? results.length - 1
                      : index - 1,
                );
              }
            } else if (event.key === "Enter" && selected >= 0) {
              event.preventDefault();
              onClose();
              router.push(results[selected].href);
            }
          }}
        />
        <button type="submit" className={styles.icon} aria-label={t.search}>
          <ArrowRight aria-hidden="true" />
        </button>
      </form>
      <p className="srOnly" id="quick-search-help">{t.help}</p>
      <div className={styles.meta} role="status" aria-live="polite">
        {busy ? (
          <>
            <LoaderCircle className={styles.spinner} aria-hidden="true" />
            {t.loading}
          </>
        ) : current?.error ? (
          t.failed
        ) : query.trim() ? (
          locale === "ar" ? `نتائج البحث: ${new Intl.NumberFormat(locale).format(current?.result?.total ?? 0)}` : `${current?.result?.total ?? 0} ${t.result}`
        ) : (
          t.explore
        )}
      </div>
      {current?.error && (
        <button
          type="button"
          className={styles.retry}
          onClick={() => {
            setRetry((value) => value + 1);
            setActive(-1);
          }}
        >
          {t.retry}
        </button>
      )}
      <div
        className={styles.results}
        id="quick-search-results"
        role="listbox"
        aria-label={t.search}
        aria-busy={busy}
      >
        {results.map((result, index) => (
          <Link
            key={result.key}
            id={`quick-result-${index}`}
            role="option"
            aria-selected={selected === index}
            tabIndex={-1}
            href={result.href}
            className={styles.result}
            data-kind={result.kind}
            onClick={onClose}
            onPointerMove={(event) => {
              if (
                event.pointerType === "mouse" &&
                window.matchMedia(
                  "(hover: hover) and (pointer: fine) and (not (any-pointer: coarse))",
                ).matches
              ) {
                setActive(index);
              }
            }}
          >
            <span className={styles.image}>
              {result.image && (
                <Image src={result.image} alt="" fill sizes="5rem" />
              )}
            </span>
            <span className={styles.text}>
              <span className={styles.kind}>{t[result.kind]}</span>
              <strong><Match text={result.title} query={query} /></strong>
              {result.price !== undefined && (
                <span>{result.currency === "USD" && <>{publicPricingCopy[locale].approximately} </>}<bdi>{formatPrice(result.price, locale, result.currency)}</bdi></span>
              )}
            </span>
            <ArrowRight aria-hidden="true" />
          </Link>
        ))}
      </div>
      {!busy && !current?.error && !results.length && (
        <div className={styles.empty}>
          <Search aria-hidden="true" />
          <h3>{t.empty}</h3>
          <p>{t.emptyHint}</p>
        </div>
      )}
      <div className={styles.footer}>
        <Link
          href={query.trim() ? destination : localizedPath(locale, "/products")}
          onClick={onClose}
        >
          {query.trim() ? t.all : t.browse}
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </Modal>
  );
}

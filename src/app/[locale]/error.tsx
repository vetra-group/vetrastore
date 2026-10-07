"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { isLocale, localizedPath, languageConfig } from "@/lib/i18n";
import { errorCopy } from "@/content/errors";
import styles from "./status.module.css";
export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const locale =
    typeof params.locale === "string" && isLocale(params.locale)
      ? params.locale
      : languageConfig.defaultLocale;
  const c = errorCopy[locale];
  return (
    <div className={`container ${styles.status}`}>
      <p className="eyebrow">VETRA STORE</p>
      <h1>{c.title}</h1>
      <p>{c.body}</p>
      <div>
        <button className="button" onClick={reset}>
          {c.retry}
        </button>
        <Link className="button buttonOutline" href={localizedPath(locale)}>
          {c.back}
        </Link>
      </div>
    </div>
  );
}

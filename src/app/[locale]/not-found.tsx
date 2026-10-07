"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { isLocale, localizedPath, languageConfig } from "@/lib/i18n";
import { errorCopy } from "@/content/errors";
import styles from "./status.module.css";
export default function NotFound() {
  const params = useParams();
  const locale =
    typeof params.locale === "string" && isLocale(params.locale)
      ? params.locale
      : languageConfig.defaultLocale;
  const c = errorCopy[locale];
  return (
    <div className={`container ${styles.status}`}>
      <p className="eyebrow">VETRA STORE · 404</p>
      <h1>{c.notFound}</h1>
      <p>{c.notFoundBody}</p>
      <Link className="button" href={localizedPath(locale, "/products")}>
        {c.shop}
      </Link>
    </div>
  );
}

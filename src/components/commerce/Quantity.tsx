"use client";
import Icon from "@/components/Icon";
import type { Locale } from "@/lib/i18n";
import { MAX_QUANTITY } from "@/lib/catalog";
import { commerce } from "@/content/commerce";
import styles from "./Quantity.module.css";
import { usePublishedCopy } from "@/components/cms/PublishedProvider";
export default function Quantity({
  value,
  onChange,
  locale,
  max = MAX_QUANTITY,
}: {
  value: number;
  onChange: (value: number) => void;
  locale: Locale;
  max?: number;
}) {
  const t = usePublishedCopy(commerce[locale], `commerce.${locale}`);
  return (
    <div className={styles.control} role="group" aria-label={t.quantity}>
      <button
        type="button"
        aria-label={t.decrease}
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Icon name="minus" size={14} />
      </button>
      <span aria-live="polite">{value}</span>
      <button
        type="button"
        aria-label={t.increase}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Icon name="plus" size={14} />
      </button>
    </div>
  );
}

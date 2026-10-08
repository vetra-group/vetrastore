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
  options,
}: {
  value: number;
  onChange: (value: number) => void;
  locale: Locale;
  max?: number;
  options?: readonly number[];
}) {
  const t = usePublishedCopy(commerce[locale], `commerce.${locale}`);
  if (options?.length) return <label className={styles.control}>
    <span className="srOnly">{t.quantity}</span>
    <select className={styles.select} value={value} onChange={(event) => onChange(Number(event.target.value))}>
      {options.filter((quantity) => quantity <= max).map((quantity) => <option key={quantity} value={quantity}>{new Intl.NumberFormat(locale).format(quantity)}</option>)}
    </select>
  </label>;
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

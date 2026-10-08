"use client";

import Image from "next/image";
import { useRef } from "react";
import { Check, X } from "lucide-react";
import { displayCurrencies, type DisplayCurrency } from "@/lib/catalog";
import type { Locale } from "@/lib/i18n";
import { Modal } from "@/components/ui/Modal";
import { useStore } from "./StoreProvider";
import styles from "./CurrencyDialog.module.css";

const copy = {
  en: {
    title: "Select currency",
    close: "Close currency selection",
  },
  th: {
    title: "เลือกสกุลเงิน",
    close: "ปิดการเลือกสกุลเงิน",
  },
  ar: {
    title: "اختر العملة",
    close: "إغلاق اختيار العملة",
  },
} as const;

// Local flag SVGs in public/flags are sourced from flagcdn.com.
const countries: Record<DisplayCurrency, { flag: string; name: Record<Locale, string> }> = {
  AED: { flag: "ae", name: { en: "Dubai, UAE", th: "ดูไบ, UAE", ar: "دبي، الإمارات" } },
  SAR: { flag: "sa", name: { en: "Saudi Arabia", th: "ซาอุดีอาระเบีย", ar: "السعودية" } },
  KWD: { flag: "kw", name: { en: "Kuwait", th: "คูเวต", ar: "الكويت" } },
  QAR: { flag: "qa", name: { en: "Qatar", th: "กาตาร์", ar: "قطر" } },
  MYR: { flag: "my", name: { en: "Malaysia", th: "มาเลเซีย", ar: "ماليزيا" } },
  BND: { flag: "bn", name: { en: "Brunei", th: "บรูไน", ar: "بروناي" } },
  SGD: { flag: "sg", name: { en: "Singapore", th: "สิงคโปร์", ar: "سنغافورة" } },
  CAD: { flag: "ca", name: { en: "Canada", th: "แคนาดา", ar: "كندا" } },
  AUD: { flag: "au", name: { en: "Australia", th: "ออสเตรเลีย", ar: "أستراليا" } },
  GBP: { flag: "gb", name: { en: "United Kingdom", th: "สหราชอาณาจักร", ar: "المملكة المتحدة" } },
  EUR: { flag: "ie", name: { en: "Ireland", th: "ไอร์แลนด์", ar: "أيرلندا" } },
  USD: { flag: "us", name: { en: "United States", th: "สหรัฐอเมริกา", ar: "الولايات المتحدة" } },
  THB: { flag: "th", name: { en: "Thailand", th: "ประเทศไทย", ar: "تايلاند" } },
};

export default function CurrencyDialog({ locale, open, onClose }: {
  locale: Locale;
  open: boolean;
  onClose: () => void;
}) {
  const { displayCurrency, setDisplayCurrency } = useStore();
  const closeRef = useRef<HTMLButtonElement>(null);
  const t = copy[locale];

  return <Modal id="store-currencies" label={t.title} className={styles.dialog} open={open} onClose={onClose} initialFocusRef={closeRef}>
    <div className={styles.heading}>
      <h2>{t.title}</h2>
      <button ref={closeRef} className={styles.close} type="button" onClick={onClose} aria-label={t.close}><X aria-hidden="true" /></button>
    </div>
    <div className={styles.content}>
      <div className={styles.currencyGrid} role="group" aria-label={t.title}>
        {displayCurrencies.map((currency) => {
          const country = countries[currency];
          return <button
            key={currency}
            type="button"
            data-currency={currency}
            className={styles.pill}
            aria-pressed={displayCurrency === currency}
            onClick={() => { setDisplayCurrency(currency); onClose(); }}
          >
            <span className={styles.identity}>
              <Image className={styles.flag} src={`/flags/${country.flag}.svg`} alt="" width={28} height={20} unoptimized />
              <span>{country.name[locale]}</span>
            </span>
            <span className={styles.meta}><bdi dir="ltr">{currency}</bdi>{displayCurrency === currency && <Check aria-hidden="true" />}</span>
          </button>;
        })}
      </div>
    </div>
  </Modal>;
}

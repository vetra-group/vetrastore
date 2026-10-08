"use client";

import type { Locale } from "@/lib/i18n";
import { formatPrice } from "@/lib/catalog";
import { useStore } from "./StoreProvider";
import styles from "./ApproximatePrice.module.css";

const copy = {
  en: { exact: "Order price", rate: "Reference rate", note: "Converted prices are estimates. Your card rate may differ." },
  th: { exact: "ราคาสั่งซื้อ", rate: "อัตราอ้างอิง", note: "ราคาแปลงสกุลเงินเป็นเพียงการประมาณ อัตราบัตรของคุณอาจต่างออกไป" },
  ar: { exact: "سعر الطلب", rate: "سعر الصرف المرجعي", note: "الأسعار المحوّلة تقديرية. قد يختلف سعر صرف بطاقتك." },
} as const;

export default function ApproximatePrice({ amount, locale }: { amount: number; locale: Locale }) {
  const { displayCurrency, exchangeRate } = useStore();
  if (displayCurrency === "THB" || !exchangeRate || !Number.isFinite(amount)) return null;
  const t = copy[locale];
  return <p className={styles.estimate}><span>{t.exact}: <bdi>{formatPrice(amount, locale, "THB")}</bdi></span><small>{t.rate} ({exchangeRate.source}): {exchangeRate.date}. {t.note}</small></p>;
}

"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { commerce } from "@/content/commerce";
import { publicPricingCopy } from "@/content/public-pricing";
import { formatPrice, HONEY_ID } from "@/lib/catalog";
import { publicQuote } from "@/lib/public-pricing";
import { usePublished, usePublishedCopy } from "@/components/cms/PublishedProvider";
import type { Locale } from "@/lib/i18n";
import styles from "./HoneyPurchaseShortcut.module.css";

type HoneyPurchaseShortcutProps = {
  locale: Locale;
  label: string;
};

function isEditing() {
  return document.activeElement?.matches(
    'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
  ) ?? false;
}

export default function HoneyPurchaseShortcut({ locale, label }: HoneyPurchaseShortcutProps) {
  const { products } = usePublished();
  const honey = products.find((product) => product.id === HONEY_ID);
  const t = usePublishedCopy(commerce[locale], `commerce.${locale}`);
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("honey-title")?.closest("section");
    const controls = document.getElementById("honey-purchase-controls");
    let footer = document.getElementById("store-footer");
    if (!hero || !controls || !("IntersectionObserver" in window)) return;

    let mounted = true;
    const updateVisibility = () => {
      const controlsRect = controls.getBoundingClientRect();
      const footerRect = footer?.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const controlsVisible = controlsRect.bottom > 0 && controlsRect.top < viewportHeight;
      const footerVisible = !!footerRect && footerRect.bottom > 0 && footerRect.top < viewportHeight;
      setVisible(hero.getBoundingClientRect().bottom <= 0 && !controlsVisible && !footerVisible);
      setEditing(isEditing());
    };
    const observer = new IntersectionObserver(updateVisibility);
    [hero, controls].forEach((element) => observer.observe(element));
    if (footer) observer.observe(footer);
    const footerObserver = !footer ? new MutationObserver(() => {
      const found = document.getElementById("store-footer");
      if (found) { footer = found; observer.observe(found); updateVisibility(); footerObserver?.disconnect(); }
    }) : null;
    footerObserver?.observe(document.body, { childList: true, subtree: true });

    const updateEditing = () => {
      // Focusout runs before the next element receives focus.
      queueMicrotask(() => {
        if (mounted) setEditing(isEditing());
      });
    };
    document.addEventListener("focusin", updateEditing);
    document.addEventListener("focusout", updateEditing);

    return () => {
      mounted = false;
      observer.disconnect();
      footerObserver?.disconnect();
      document.removeEventListener("focusin", updateEditing);
      document.removeEventListener("focusout", updateEditing);
    };
  }, []);

  if (!visible || editing || !honey) return null;
  const baseQuote = publicQuote(honey, 1, locale);

  return (
    <aside className={styles.shortcut} aria-label={honey.name[locale]}>
      <p className={styles.summary}>
        <strong><bdi>{baseQuote ? formatPrice(baseQuote.total, locale, baseQuote.currency) : publicPricingCopy[locale].unavailable}</bdi></strong>
        <span>{honey.weight} {t.gram}</span>
      </p>
      <a className={styles.choose} href="#honey-purchase">
        {label}
        <ChevronRight aria-hidden="true" strokeWidth={1.5} />
      </a>
    </aside>
  );
}

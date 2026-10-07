"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { cmsCopy } from "@/content/cms";
import type { Locale } from "@/lib/i18n";
import { CmsDialog } from "./CmsDialog";
import styles from "./CmsApp.module.css";

type Request = { title: string; body: string; label?: string; destructive?: boolean };

export function useCmsConfirm(locale: Locale) {
  const t = cmsCopy[locale];
  const [request, setRequest] = useState<Request | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);
  useEffect(() => () => { resolver.current?.(false); resolver.current = null; }, []);
  const confirm = (next: Request) => new Promise<boolean>((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    setRequest(next);
  });
  const finish = (confirmed: boolean) => {
    const resolve = resolver.current;
    resolver.current = null;
    setRequest(null);
    resolve?.(confirmed);
  };
  const confirmation = request && <CmsDialog className={styles.dialog} label={request.title} onClose={() => finish(false)}><div className={styles.statusRow}><h2>{request.title}</h2><button className={styles.iconButton} type="button" aria-label={t.close} onClick={() => finish(false)}><X aria-hidden="true" /></button></div><p>{request.body}</p><div className={styles.actions}><button className={styles.button} type="button" autoFocus onClick={() => finish(false)}>{t.cancel}</button><button className={`${styles.primary} ${request.destructive ? styles.confirmDanger : ""}`} type="button" onClick={() => finish(true)}>{request.destructive && <AlertTriangle aria-hidden="true" />}{request.label ?? t.confirm}</button></div></CmsDialog>;
  return { confirm, confirmation };
}

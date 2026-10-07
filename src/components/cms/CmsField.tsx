import type { ReactNode } from "react";
import styles from "./CmsEditor.module.css";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className={styles.field}><span>{label}</span>{children}{hint && <span className={styles.hint}>{hint}</span>}</label>;
}

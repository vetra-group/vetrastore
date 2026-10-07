import { cmsCopy } from "@/content/cms";
import { cmsArabicUi } from "@/content/cms-ar-ui";
import type { Locale } from "@/lib/i18n";

export function cmsAuditLabel(action: string, locale: Locale) {
  const t = cmsCopy[locale];
  if (action === "Saved draft") return t.auditActions.save;
  if (action === "Published content") return t.auditActions.publish;
  if (action === "Restored published content") return t.auditActions.restore;
  if (action.startsWith("Saved media submission:")) return t.uploadSuccess;
  if (action.startsWith("Uploaded image:")) return `${t.auditActions.upload}: ${action.slice(15).trim()}`;
  if (action.startsWith("Removed image:")) return `${t.auditActions.deleteMedia}: ${action.slice(14).trim()}`;
  if (action.startsWith("Moved ") && action.includes(" to trash:")) return `${t.moveToTrash}: ${action.split(" to trash:")[1].trim()}`;
  if (action.startsWith("Restored trash ")) return t.trashRestored;
  if (action.startsWith("Expired ") && action.includes(" trash items")) return locale === "ar" ? cmsArabicUi["Removed expired Trash entries"] : locale === "th" ? "ลบรายการในถังขยะที่ครบ 30 วันแล้ว" : "Removed expired Trash entries";
  if (action.startsWith("Published review ")) return t.auditActions.publish;
  if (action.startsWith("Restored backup ")) return t.auditActions.import;
  if (action.startsWith("Restored revision ")) return `${t.restore} · ${action.slice(18)}`;
  if (action === "Initial source content") return t.defaultValue;
  return t.auditActions[action as keyof typeof t.auditActions] ?? action;
}

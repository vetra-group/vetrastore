import type { CmsContent } from "@/lib/cms/types";
import { businessKeys } from "@/lib/business-settings";
import { isPublicHttpsOrigin } from "@/lib/site-origin";

export type ReadinessItem = { key: string; ready: boolean; required: boolean };
export function launchReadiness(content: CmsContent, env: Record<string, string | undefined> = process.env): ReadinessItem[] {
  const domain = isPublicHttpsOrigin(env.NEXT_PUBLIC_SITE_URL || "");
  return [
    { key: "domain", ready: domain, required: true },
    { key: "database", ready: env.CMS_STORAGE === "mongodb" && !!env.MONGODB_URI, required: true },
    { key: "media", ready: !!(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET), required: true },
    { key: "staff", ready: env.CMS_AUTH_MODE === "password" && !!env.CMS_STAFF_ACCOUNTS && (env.CMS_SESSION_SECRET?.length || 0) >= 64, required: true },
    { key: "contact", ready: !!content.settings.email && !!content.settings.phone, required: true },
    ...businessKeys.map((key) => ({ key, ready: content.settings.business?.[key]?.confirmed === true, required: true })),
    { key: "preview", ready: env.NEXT_PUBLIC_DEMO_MODE !== "true", required: true },
    { key: "indexing", ready: domain && env.NEXT_PUBLIC_DEMO_MODE !== "true" && env.SITE_NOINDEX !== "true", required: false },
    { key: "enquiries", ready: env.ORDER_ENQUIRIES_ENABLED === "true", required: false },
  ];
}

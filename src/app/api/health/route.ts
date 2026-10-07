import { getCmsState } from "@/lib/cms/server";
import { cmsMode } from "@/lib/cms/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
let lastCheck: { at: number; healthy: boolean } | undefined;
export async function GET() {
  if (!lastCheck || Date.now() - lastCheck.at > 30000) {
    try { if (cmsMode() !== "unavailable") await getCmsState(); else if (process.env.CMS_STORAGE === "mongodb") throw new Error("CMS configuration incomplete"); lastCheck = { at: Date.now(), healthy: true }; }
    catch { lastCheck = { at: Date.now(), healthy: false }; }
  }
  return Response.json({ status: lastCheck.healthy ? "ok" : "unavailable" }, { status: lastCheck.healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}

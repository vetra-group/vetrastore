import { withCmsIdentity, cmsErrorResponse } from "@/lib/cms/auth";
import { getCmsState } from "@/lib/cms/server";
import { launchReadiness } from "@/lib/launch-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { return await withCmsIdentity(request, false, async () => {
    const state = await getCmsState();
    return Response.json({ checks: launchReadiness(state.published), checkedAt: new Date().toISOString(), externalServicesVerified: false }, { headers: { "Cache-Control": "no-store" } });
  }, "admin"); } catch (error) { return cmsErrorResponse(error); }
}

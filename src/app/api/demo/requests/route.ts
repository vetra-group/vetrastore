import { assertOrigin, cmsErrorResponse, cmsMode, isLocalCmsRequest, readCmsJson } from "@/lib/cms/auth";
import { CmsError } from "@/lib/cms/validation";
import { isRateLimited } from "@/app/api/contact/validation";
import { submitSharedDemo } from "@/lib/operations/public-demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
function available(request: Request) {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true" && !process.env.VERCEL && process.env.CMS_STORAGE !== "mongodb" && cmsMode() !== "unavailable" && isLocalCmsRequest(request);
}
export async function GET(request: Request) { return Response.json({ available: available(request) }, { headers }); }
export async function POST(request: Request) {
  try {
    if (!available(request)) throw new CmsError("Shared demo submissions are available on this local preview only.", 403, "FORBIDDEN");
    assertOrigin(request);
    if (isRateLimited(request, "shared-demo")) throw new CmsError("Please wait before trying again.", 429, "RATE_LIMITED");
    return Response.json(await submitSharedDemo(await readCmsJson(request, 16000)), { status: 201, headers });
  } catch (error) { return cmsErrorResponse(error); }
}

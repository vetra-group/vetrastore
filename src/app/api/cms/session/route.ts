import { assertOrigin, cmsIdentity, cmsErrorResponse, cmsMode, expiredSessionCookie, isAllowedCmsRequest, readCmsJson, revokeSession, sessionCookie } from "@/lib/cms/auth";
import { CmsError } from "@/lib/cms/validation";
import { isRateLimited } from "@/app/api/contact/validation";
import { limitStaffLogin } from "@/lib/cms/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { const mode = isAllowedCmsRequest(request) ? cmsMode() : "unavailable"; const identity = await cmsIdentity(request); return Response.json({ authenticated: !!identity, identity, mode }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return cmsErrorResponse(error); }
}
export async function POST(request: Request) {
  try {
    if (!isAllowedCmsRequest(request)) throw new CmsError("CMS access is unavailable in this environment.", 503, "CMS_UNAVAILABLE");
    assertOrigin(request);
    if (isRateLimited(request, "cms-login")) throw new CmsError("Too many sign-in requests. Try again in a minute.", 429, "RATE_LIMITED");
    const body = await readCmsJson(request, 2000);
    if (body.action !== "login" || Object.keys(body).some((key) => !["action", "email", "password"].includes(key))) throw new CmsError("Choose CMS sign-in.");
    if (cmsMode() === "configured") await limitStaffLogin(body.email, request);
    return Response.json({ authenticated: true, mode: cmsMode() }, { headers: { "Set-Cookie": await sessionCookie(request, body), "Cache-Control": "no-store" } });
  } catch (error) { return cmsErrorResponse(error); }
}
export async function DELETE(request: Request) {
  try { assertOrigin(request); await revokeSession(request); return Response.json({ authenticated: false, mode: cmsMode() }, { headers: { "Set-Cookie": expiredSessionCookie(), "Cache-Control": "no-store" } }); }
  catch (error) { return cmsErrorResponse(error); }
}

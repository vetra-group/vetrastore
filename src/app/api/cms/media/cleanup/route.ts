import { cmsErrorResponse, readCmsJson, withCmsIdentity } from "@/lib/cms/auth";
import { cleanupCmsMedia } from "@/lib/cms/server";
import { CmsError } from "@/lib/cms/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try { return await withCmsIdentity(request, true, async () => {
    const body = await readCmsJson(request, 2000);
    if (Object.keys(body).length) throw new CmsError("Cleanup does not accept file paths or image identities.");
    return Response.json(await cleanupCmsMedia(), { headers: { "Cache-Control": "no-store" } });
  }, "admin"); } catch (error) { return cmsErrorResponse(error); }
}

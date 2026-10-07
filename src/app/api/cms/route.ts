import { revalidatePath } from "next/cache";
import { authorizeCms, cmsErrorResponse, readCmsJson, withCmsIdentity } from "@/lib/cms/auth";
import { getCmsState, updateCmsContent } from "@/lib/cms/server";
import { CmsError } from "@/lib/cms/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { await authorizeCms(request); return Response.json({ state: await getCmsState() }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return cmsErrorResponse(error); }
}
export async function PUT(request: Request) {
  try { return await withCmsIdentity(request, true, async () => {
    const body = await readCmsJson(request);
    if (Object.keys(body).some((key) => !["revision", "content", "action"].includes(key))) throw new CmsError("Unsupported CMS action field.");
    const state = await updateCmsContent(body.revision, body.content, body.action);
    if (body.action === "publish") { revalidatePath("/", "layout"); revalidatePath("/sitemap.xml"); }
    return Response.json({ state }, { headers: { "Cache-Control": "no-store" } });
  }); } catch (error) { return cmsErrorResponse(error); }
}

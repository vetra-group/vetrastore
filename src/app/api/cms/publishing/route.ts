import { revalidatePath } from "next/cache";
import { cmsErrorResponse, readCmsJson, withCmsIdentity } from "@/lib/cms/auth";
import { getCmsPublishingReview, publishCmsSelection, restoreCmsHistory } from "@/lib/cms/server";
import { CmsError } from "@/lib/cms/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(request: Request) {
  try { return await withCmsIdentity(request, false, async () => Response.json(await getCmsPublishingReview(new URL(request.url).searchParams.get("history") || undefined), { headers })); }
  catch (error) { return cmsErrorResponse(error); }
}
export async function POST(request: Request) {
  try {
    return await withCmsIdentity(request, true, async () => {
      const body = await readCmsJson(request);
      if (Object.keys(body).some((key) => !["action", "revision", "selection", "id"].includes(key))) throw new CmsError("Unsupported publication field.");
      if (body.action === "publish") {
        const state = await publishCmsSelection(body.revision, body.selection);
        revalidatePath("/", "layout"); revalidatePath("/sitemap.xml");
        return Response.json({ state }, { headers });
      }
      if (body.action === "restore-history") return Response.json({ state: await restoreCmsHistory(body.revision, body.id) }, { headers });
      throw new CmsError("Choose publish or restore-history.");
    }, "publish");
  } catch (error) { return cmsErrorResponse(error); }
}

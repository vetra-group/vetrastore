import { cmsErrorResponse, cmsRole, readCmsJson, withCmsIdentity } from "@/lib/cms/auth";
import { CmsError } from "@/lib/cms/validation";
import { normalizeOperationsQuery, operationsRepository } from "@/lib/operations/repository";
import { executeOperations, operationsDetail, syncOperationsSources } from "@/lib/operations/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
export async function GET(request: Request) {
  try { return await withCmsIdentity(request, false, async () => {
    const params = new URL(request.url).searchParams, id = params.get("id");
    if (id) return Response.json({ record: await operationsDetail(id), owner: cmsRole() === "owner" }, { headers });
    const settings = await operationsRepository.transaction(async (tx) => await tx.get("settings", "settings") || { id: "settings", revision: 0, shippingRules: [] });
    return Response.json({ ...await operationsRepository.list(normalizeOperationsQuery(params)), settings, owner: cmsRole() === "owner", mode: "simulation", storage: process.env.CMS_STORAGE === "mongodb" ? "mongodb" : "local" }, { headers });
  }); } catch (error) { return cmsErrorResponse(error); }
}
export async function POST(request: Request) {
  try { return await withCmsIdentity(request, true, async () => {
    const body = await readCmsJson(request, 32000);
    if (body.action === "sync") {
      if (Object.keys(body).some((key) => key !== "action")) throw new CmsError("Unsupported sync field.");
      return Response.json(await syncOperationsSources(), { headers });
    }
    return Response.json(await executeOperations(body), { headers });
  }); } catch (error) { return cmsErrorResponse(error); }
}

import { cmsErrorResponse, readCmsJson, withCmsIdentity } from "@/lib/cms/auth";
import { CMS_BACKUP_LIMIT_BYTES, createCmsBackup, inspectCmsBackup, restoreCmsBackup } from "@/lib/cms/server";
import { CmsError } from "@/lib/cms/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request) {
  try { return await withCmsIdentity(request, false, async () => new Response(JSON.stringify(await createCmsBackup()), { headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="vetra-complete-backup-${new Date().toISOString().slice(0, 10)}.json"` } }), "admin"); }
  catch (error) { return cmsErrorResponse(error); }
}
export async function POST(request: Request) {
  try {
    return await withCmsIdentity(request, true, async () => {
      const body = await readCmsJson(request, CMS_BACKUP_LIMIT_BYTES + 1024);
      if (Object.keys(body).some((key) => !["action", "backup", "revision", "planHash"].includes(key))) throw new CmsError("Unsupported backup field.");
      if (body.action === "inspect") return Response.json(await inspectCmsBackup(body.backup), { headers });
      if (body.action === "restore") return Response.json({ state: await restoreCmsBackup(body.revision, body.planHash, body.backup) }, { headers });
      throw new CmsError("Inspect the backup before restoring it.");
    }, "admin");
  } catch (error) { return cmsErrorResponse(error); }
}

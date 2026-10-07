import { authorizeCms, cmsErrorResponse } from "@/lib/cms/auth";
import { getCmsState } from "@/lib/cms/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { await authorizeCms(request); return new Response(JSON.stringify(await getCmsState(), null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="vetra-cms-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }); }
  catch (error) { return cmsErrorResponse(error); }
}

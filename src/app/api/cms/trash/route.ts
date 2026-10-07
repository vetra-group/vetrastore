import { cmsErrorResponse, readCmsJson, withCmsIdentity } from "@/lib/cms/auth";
import { getCmsState, moveCmsItemToTrash, restoreCmsTrashItem } from "@/lib/cms/server";
import { hydrateWorkspaceContent, workspaceIds } from "@/lib/cms/workspace";
import { CmsError } from "@/lib/cms/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try { return await withCmsIdentity(request, true, async () => {
    const body = await readCmsJson(request);
    if (Object.keys(body).some((key) => !["action", "revision", "kind", "key", "content", "id", "loadedArticleIds"].includes(key))) throw new CmsError("Unsupported trash action field.");
    let state;
    if (body.action === "move") {
      const content = body.loadedArticleIds === undefined ? body.content : hydrateWorkspaceContent((await getCmsState()).draft, body.content, workspaceIds(body.loadedArticleIds));
      state = await moveCmsItemToTrash(body.revision, body.kind, body.key, content);
    }
    else if (body.action === "restore") state = await restoreCmsTrashItem(body.revision, body.id);
    else throw new CmsError("Choose move or restore.");
    return Response.json({ state }, { headers: { "Cache-Control": "no-store" } });
  }); } catch (error) { return cmsErrorResponse(error); }
}

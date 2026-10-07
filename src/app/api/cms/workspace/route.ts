import { authorizeCms, cmsErrorResponse, readCmsJson, withCmsIdentity } from "@/lib/cms/auth";
import { getCmsState, updateCmsContent } from "@/lib/cms/server";
import { articleKey, hydrateWorkspaceContent, workspaceIds, workspaceState } from "@/lib/cms/workspace";
import { CmsError } from "@/lib/cms/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
export async function GET(request: Request) {
  try {
    await authorizeCms(request);
    const params = new URL(request.url).searchParams;
    if ([...params.keys()].some((key) => key !== "article") || params.getAll("article").length > 1) throw new CmsError("Choose one article.");
    const key = params.get("article");
    if (key !== null) workspaceIds([key]);
    const state = await getCmsState();
    if (key) {
      const article = state.draft.articles.find((entry) => articleKey(entry) === key);
      if (!article) throw new CmsError("This article is no longer in the draft.", 404, "NOT_FOUND");
      return Response.json({ revision: state.revision, article, published: state.published.articles.find((entry) => articleKey(entry) === key) ?? null }, { headers });
    }
    return Response.json({ state: workspaceState(state) }, { headers });
  } catch (error) { return cmsErrorResponse(error); }
}
export async function PUT(request: Request) {
  try { return await withCmsIdentity(request, true, async () => {
    const body = await readCmsJson(request);
    if (Object.keys(body).some((key) => !["revision", "content", "loadedArticleIds"].includes(key))) throw new CmsError("Unsupported workspace save field.");
    const loaded = workspaceIds(body.loadedArticleIds);
    const current = await getCmsState();
    const content = hydrateWorkspaceContent(current.draft, body.content, loaded);
    // The save service enforces the revision and recognizes a completed retry.
    // A precheck here would reject a successful save whose response was lost.
    const saved = await updateCmsContent(body.revision, content, "save");
    return Response.json({ state: workspaceState(saved, loaded) }, { headers });
  }); } catch (error) { return cmsErrorResponse(error); }
}

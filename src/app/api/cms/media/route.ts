import { boundedBody, cmsErrorResponse, cmsMediaOwner, readCmsJson, withCmsIdentity } from "@/lib/cms/auth";
import { abandonCmsMediaSubmission, commitCmsMedia, deleteCmsMedia, getCmsMediaSubmission, stageCmsMedia } from "@/lib/cms/server";
import { MAX_MEDIA_UPLOAD_BYTES } from "@/lib/cms/media-policy";
import { CmsError } from "@/lib/cms/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { return await withCmsIdentity(request, false, async (owner) => {
    const url = new URL(request.url);
    if ([...url.searchParams.keys()].some((key) => key !== "submissionId") || url.searchParams.getAll("submissionId").length !== 1) throw new CmsError("Choose one image submission.");
    return Response.json(await getCmsMediaSubmission(cmsMediaOwner(), url.searchParams.get("submissionId"), owner), { headers: { "Cache-Control": "no-store" } });
  }); } catch (error) { return cmsErrorResponse(error); }
}
export async function POST(request: Request) {
  try { return await withCmsIdentity(request, true, async (owner) => {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.startsWith("multipart/form-data;") || !contentType.includes("boundary=")) throw new CmsError("Send an image upload form.", 415, "CONTENT_TYPE");
    const bytes = await boundedBody(request, MAX_MEDIA_UPLOAD_BYTES + 50_000);
    let form: FormData;
    try { form = await new Request(request.url, { method: "POST", headers: { "content-type": contentType }, body: bytes.buffer as ArrayBuffer }).formData(); }
    catch { throw new CmsError("The image upload form is invalid."); }
    const fields = ["submissionId", "file"];
    if ([...form.keys()].some((key) => !fields.includes(key)) || fields.some((key) => form.getAll(key).length > 1)) throw new CmsError("Unsupported image upload field.");
    const file = form.get("file");
    if (!file || typeof file === "string") throw new CmsError("Select a prepared image.");
    if (file.size > MAX_MEDIA_UPLOAD_BYTES) throw new CmsError("Images must be smaller than 5 MB.", 413, "IMAGE_TOO_LARGE");
    const result = await stageCmsMedia(cmsMediaOwner(), form.get("submissionId"), new Uint8Array(await file.arrayBuffer()), file.type, file.name, owner);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  }); } catch (error) { return cmsErrorResponse(error); }
}
export async function PUT(request: Request) {
  try { return await withCmsIdentity(request, true, async (owner) => {
    const body = await readCmsJson(request, 32_000);
    if (Object.keys(body).some((key) => !["submissionId", "revision", "uploads"].includes(key))) throw new CmsError("Unsupported image save field.");
    return Response.json(await commitCmsMedia(cmsMediaOwner(), body.submissionId, body.revision, body.uploads, owner), { headers: { "Cache-Control": "no-store" } });
  }); } catch (error) { return cmsErrorResponse(error); }
}
export async function PATCH(request: Request) {
  try { return await withCmsIdentity(request, true, async (owner) => {
    const body = await readCmsJson(request, 2000);
    if (Object.keys(body).some((key) => key !== "submissionId")) throw new CmsError("Unsupported image cleanup field.");
    return Response.json(await abandonCmsMediaSubmission(cmsMediaOwner(), body.submissionId, owner), { headers: { "Cache-Control": "no-store" } });
  }); } catch (error) { return cmsErrorResponse(error); }
}
export async function DELETE(request: Request) {
  try { return await withCmsIdentity(request, true, async () => { const body = await readCmsJson(request, 2000); if (Object.keys(body).some((key) => !["revision", "id"].includes(key))) throw new CmsError("Unsupported media action field."); return Response.json({ state: await deleteCmsMedia(body.revision, body.id) }, { headers: { "Cache-Control": "no-store" } }); }); }
  catch (error) { return cmsErrorResponse(error); }
}

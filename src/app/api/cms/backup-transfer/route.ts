import { boundedBody, cmsErrorResponse, readCmsJson, withCmsIdentity } from "@/lib/cms/auth";
import { BACKUP_CHUNK_BYTES } from "@/lib/cms/backup-format";
import { commitBackupTransfer, deleteBackupTransfer, downloadBackupChunk, getBackupTransfer, inspectBackupTransfer, listBackupTransfers, startBackupExport, startBackupImport, uploadBackupChunk, verifyBackupFile } from "@/lib/cms/backup-transfers";
import { CmsError } from "@/lib/cms/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff" };
function index(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new CmsError("Choose a valid backup file or chunk.");
  return value;
}
function queryIndex(value: string | null) { if (value === null || !/^(0|[1-9]\d*)$/.test(value)) throw new CmsError("Choose a valid backup file or chunk."); return index(Number(value)); }
export async function GET(request: Request) {
  try { return await withCmsIdentity(request, false, async () => {
    const query = new URL(request.url).searchParams, id = query.get("id");
    if (!id) return Response.json({ transfers: await listBackupTransfers() }, { headers });
    if (query.has("file") && query.has("chunk")) {
      const result = await downloadBackupChunk(id, queryIndex(query.get("file")), queryIndex(query.get("chunk")));
      return new Response(new Uint8Array(result.bytes), { headers: { ...headers, "Content-Type": "application/octet-stream", "Content-Length": String(result.bytes.length), "X-Chunk-Sha256": result.sha256 } });
    }
    return Response.json(await getBackupTransfer(id), { headers });
  }, "admin"); } catch (error) { return cmsErrorResponse(error); }
}
export async function POST(request: Request) {
  try { return await withCmsIdentity(request, true, async () => {
    const body = await readCmsJson(request, 3 * 1024 * 1024);
    if (Object.keys(body).some((key) => !["action", "id", "manifest", "file", "revision", "planHash"].includes(key))) throw new CmsError("Unsupported backup transfer field.");
    let result;
    if (body.action === "export") result = await startBackupExport(body.id);
    else if (body.action === "import") result = await startBackupImport(body.id, body.manifest);
    else if (body.action === "verify") result = await verifyBackupFile(body.id, index(body.file));
    else if (body.action === "inspect") result = await inspectBackupTransfer(body.id);
    else if (body.action === "commit") result = await commitBackupTransfer(body.id, body.revision, body.planHash);
    else throw new CmsError("Choose a supported backup transfer action.");
    return Response.json(result, { headers });
  }, "admin"); } catch (error) { return cmsErrorResponse(error); }
}
export async function PUT(request: Request) {
  try { return await withCmsIdentity(request, true, async () => {
    if (!request.headers.get("content-type")?.startsWith("application/octet-stream")) throw new CmsError("Send a binary backup chunk.", 415, "CONTENT_TYPE");
    const query = new URL(request.url).searchParams;
    if (!query.has("file") || !query.has("chunk")) throw new CmsError("Choose a backup chunk.");
    const result = await uploadBackupChunk(query.get("id"), queryIndex(query.get("file")), queryIndex(query.get("chunk")), await boundedBody(request, BACKUP_CHUNK_BYTES));
    return Response.json(result, { headers });
  }, "admin"); } catch (error) { return cmsErrorResponse(error); }
}
export async function DELETE(request: Request) {
  try { return await withCmsIdentity(request, true, async () => {
    const body = await readCmsJson(request, 4096);
    if (Object.keys(body).some((key) => key !== "id")) throw new CmsError("Choose the transfer to remove.");
    return Response.json(await deleteBackupTransfer(body.id), { headers });
  }, "admin"); } catch (error) { return cmsErrorResponse(error); }
}

import { authorizeCms, cmsErrorResponse } from "@/lib/cms/auth";
import { readTrashedCmsMedia } from "@/lib/cms/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  try {
    await authorizeCms(request);
    const media = await readTrashedCmsMedia((await params).filename);
    if (!media) return new Response("Image not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
    return new Response(new Uint8Array(media.bytes), { headers: { "Content-Type": media.mime, "Content-Length": String(media.bytes.byteLength), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch (error) { return cmsErrorResponse(error); }
}

import { readCmsMedia } from "@/lib/cms/server";
import { preventIndexing } from "@/lib/site-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  try {
    const media = await readCmsMedia((await params).filename);
    if (!media) return new Response("Image not found", { status: 404, headers: { "Cache-Control": "no-store" } });
    return new Response(new Uint8Array(media.bytes), { headers: { "Content-Type": media.mime, "Content-Length": String(media.bytes.byteLength), "Cache-Control": "public, max-age=0, must-revalidate", ...(!media.published || preventIndexing ? { "X-Robots-Tag": "noindex, nofollow" } : {}), "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch { return new Response("Image unavailable", { status: 503, headers: { "Cache-Control": "no-store" } }); }
}

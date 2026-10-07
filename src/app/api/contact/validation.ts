import { createHash } from "node:crypto";

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const attempts = new Map<string, { count: number; reset: number }>();
export function isRateLimited(request: Request, scope: string) {
  const now = Date.now();
  if (attempts.size > 1000)
    for (const [key, value] of attempts)
      if (value.reset < now) attempts.delete(key);
  const address =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = createHash("sha256").update(`${scope}:${address}`).digest("hex");
  const existing = attempts.get(key);
  if (!existing || existing.reset < now) {
    attempts.set(key, { count: 1, reset: now + 60_000 });
    return false;
  }
  existing.count += 1;
  return existing.count > 10;
}
export async function readFormJson(
  request: Request,
): Promise<Record<string, unknown> | null> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    return null;
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const host = request.headers.get("host") || new URL(request.url).host;
      if (
        !["http:", "https:"].includes(originUrl.protocol) ||
        originUrl.host !== host
      )
        return null;
    } catch {
      return null;
    }
  }
  if (Number(request.headers.get("content-length") || 0) > 16_000) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 16_000) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    const parsed: unknown = JSON.parse(text);
    return parsed !== null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}
export function response(status: number, code: string) {
  return Response.json(
    { ok: status === 200, code },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

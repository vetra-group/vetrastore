import { createHash } from "node:crypto";
import { CmsError } from "./validation";

function config() {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME, key = process.env.CLOUDINARY_API_KEY, secret = process.env.CLOUDINARY_API_SECRET;
  const folder = process.env.CMS_CLOUDINARY_FOLDER || "vetra-cms";
  if (!cloud || !/^[\w-]+$/.test(cloud) || !key || !secret || !/^[\w-]+(?:\/[\w-]+)*$/.test(folder)) throw new CmsError("CMS media storage is not configured.", 503, "CMS_MEDIA_UNAVAILABLE");
  return { cloud, key, secret, folder };
}
function fields(values: Record<string, string>) {
  const { key, secret } = config();
  const params = { ...values, timestamp: String(Math.floor(Date.now() / 1000)) };
  const signature = createHash("sha256").update(Object.keys(params).sort().map((key) => `${key}=${params[key as keyof typeof params]}`).join("&") + secret).digest("hex");
  return { ...params, api_key: key, signature };
}
function publicId(filename: string) {
  if (!/^[a-f0-9]{64}\.(jpg|png|webp|gif)$/.test(filename)) throw new CmsError("Invalid CMS media identity.");
  return `${config().folder}/${filename.split(".")[0]}`;
}
function endpoint(action: string) { return `https://api.cloudinary.com/v1_1/${config().cloud}/image/${action}`; }
export async function downloadPrivateImage(filename: string): Promise<Buffer> {
  const query = new URLSearchParams(fields({ public_id: publicId(filename), format: filename.split(".")[1], type: "authenticated", expires_at: String(Math.floor(Date.now() / 1000) + 60), attachment: "false" }));
  const response = await fetch(`${endpoint("download")}?${query}`, { cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (response.status === 404) throw Object.assign(new Error("Image not found"), { code: "ENOENT" });
  if (!response.ok) throw new CmsError("The image provider could not return this image. Retry later.", 503, "CMS_MEDIA_UNAVAILABLE");
  const chunks: Uint8Array[] = []; let size = 0;
  const reader = response.body?.getReader();
  if (!reader) throw new CmsError("The image response was empty.", 503);
  try { while (true) { const next = await reader.read(); if (next.done) break; size += next.value.length; if (size > 5 * 1024 * 1024) { await reader.cancel(); throw new CmsError("Stored image exceeds the upload limit.", 503); } chunks.push(next.value); } } finally { reader.releaseLock(); }
  const bytes = Buffer.concat(chunks);
  if (createHash("sha256").update(bytes).digest("hex") !== filename.split(".")[0]) throw new CmsError("Stored image identity could not be verified. The image has been preserved.", 503, "MEDIA_STORAGE_INVALID");
  return bytes;
}
export async function uploadPrivateImage(filename: string, bytes: Uint8Array) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields({ public_id: publicId(filename), type: "authenticated", overwrite: "false", unique_filename: "false" }))) body.set(key, value);
  body.set("file", new Blob([new Uint8Array(bytes)]), filename);
  const response = await fetch(endpoint("upload"), { method: "POST", body, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new CmsError("Image upload could not be confirmed. Retry this upload; existing images are preserved.", 503, "UPLOAD_UNCERTAIN");
  const result = await response.json();
  if (result.existing !== true && (result.public_id !== publicId(filename) || result.type !== "authenticated")) throw new CmsError("The image provider returned an unexpected identity.", 503, "UPLOAD_UNCERTAIN");
  // A deterministic existing upload can be returned after a lost response.
  const saved = await downloadPrivateImage(filename);
  if (saved.length !== bytes.byteLength) throw new CmsError("Uploaded image bytes could not be verified.", 503, "UPLOAD_UNCERTAIN");
}
export async function deletePrivateImage(filename: string) {
  const response = await fetch(endpoint("destroy"), { method: "POST", body: new URLSearchParams(fields({ public_id: publicId(filename), type: "authenticated", invalidate: "true" })), signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new CmsError("Image deletion failed. Manual Cleanup can retry it.", 503);
  const result = await response.json();
  if (!["ok", "not found"].includes(result.result)) throw new CmsError("Image deletion could not be confirmed.", 503);
}

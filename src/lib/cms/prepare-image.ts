import { MAX_MEDIA_DIMENSION, MAX_MEDIA_SOURCE_BYTES, MAX_MEDIA_UPLOAD_BYTES } from "./media-policy";

export type PreparedCmsImage = { file: File; url: string; width: number; height: number };

type DecodedImage = { image: CanvasImageSource; width: number; height: number; close: () => void };
const formats = new Set(["image/jpeg", "image/png", "image/webp"]);

async function decodeImage(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch { /* Older browsers can decode with an image element instead. */ }
  }
  const url = URL.createObjectURL(blob);
  const image = new window.Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Image cannot be decoded"));
      image.src = url;
    });
    return { image, width: image.naturalWidth, height: image.naturalHeight, close: () => { image.src = ""; URL.revokeObjectURL(url); } };
  } catch (error) { URL.revokeObjectURL(url); throw error; }
}

function encode(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    try { canvas.toBlob((blob) => resolve(blob?.type === type ? blob : null), type, quality); }
    catch { resolve(null); }
  });
}

async function isAnimatedImage(file: File): Promise<boolean> {
  if (file.type !== "image/webp" && file.type !== "image/png") return false;
  const data = new DataView(await file.slice(0, 65536).arrayBuffer());
  if (file.type === "image/png") {
    for (let offset = 8; offset + 8 <= data.byteLength;) {
      const length = data.getUint32(offset);
      const chunk = String.fromCharCode(...new Uint8Array(data.buffer, offset + 4, 4));
      if (chunk === "acTL") return true;
      offset += 12 + length;
    }
    return false;
  }
  for (let offset = 12; offset + 8 <= data.byteLength;) {
    const chunk = String.fromCharCode(...new Uint8Array(data.buffer, offset, 4));
    if (chunk === "ANIM" || chunk === "ANMF") return true;
    const length = data.getUint32(offset + 4, true);
    // The VP8X animation flag is present even if later chunks exceed this sample.
    if (chunk === "VP8X" && length > 0 && offset + 8 < data.byteLength && (data.getUint8(offset + 8) & 2)) return true;
    offset += 8 + length + (length % 2);
  }
  return false;
}

function hasTransparency(context: CanvasRenderingContext2D, width: number, height: number): boolean {
  const pixels = context.getImageData(0, 0, width, height).data;
  for (let offset = 3; offset < pixels.length; offset += 4) if (pixels[offset] < 255) return true;
  return false;
}

async function preservesQuality(canvas: HTMLCanvasElement, candidate: Blob): Promise<boolean> {
  let decoded: DecodedImage | undefined;
  const comparison = document.createElement("canvas");
  try {
    decoded = await decodeImage(candidate);
    comparison.width = canvas.width;
    comparison.height = canvas.height;
    const original = canvas.getContext("2d", { willReadFrequently: true });
    const context = comparison.getContext("2d", { willReadFrequently: true });
    if (!original || !context) return false;
    context.drawImage(decoded.image, 0, 0, comparison.width, comparison.height);
    const before = original.getImageData(0, 0, canvas.width, canvas.height).data;
    const after = context.getImageData(0, 0, comparison.width, comparison.height).data;
    let error = 0;
    let samples = 0;
    // Bound the comparison work while checking pixels across the entire image.
    const step = Math.max(1, Math.floor(canvas.width * canvas.height / 250_000)) * 4;
    for (let offset = 0; offset < before.length; offset += step) {
      for (let channel = 0; channel < 3; channel++) {
        const difference = before[offset + channel] - after[offset + channel];
        error += difference * difference;
        samples += 1;
      }
      if (before[offset + 3] !== after[offset + 3]) return false;
    }
    // A conservative pixel-error threshold avoids converting artwork or photos
    // when browser encoding introduces meaningful visible changes.
    return samples > 0 && error / samples <= 6.5;
  } catch { return false; }
  finally { decoded?.close(); comparison.width = 0; comparison.height = 0; }
}

/** Prepare locally. The caller owns and must revoke the returned preview URL. */
export async function prepareCmsImage(file: File): Promise<PreparedCmsImage> {
  if (!formats.has(file.type) || file.size < 1 || file.size > MAX_MEDIA_SOURCE_BYTES) throw new Error("Unsupported image");
  const decoded = await decodeImage(file);
  const canvas = document.createElement("canvas");
  try {
    const { width: sourceWidth, height: sourceHeight } = decoded;
    if (sourceWidth < 1 || sourceHeight < 1 || sourceWidth > 20000 || sourceHeight > 20000 || sourceWidth * sourceHeight > 80_000_000) throw new Error("Invalid image dimensions");
    const ratio = Math.min(1, MAX_MEDIA_DIMENSION / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * ratio));
    const height = Math.max(1, Math.round(sourceHeight * ratio));
    const resized = ratio < 1;
    // Canvas conversion would remove animation, so retain animated sources.
    if (await isAnimatedImage(file)) {
      if (resized || file.size > MAX_MEDIA_UPLOAD_BYTES) throw new Error("Animated image cannot be resized safely");
      return { file, url: URL.createObjectURL(file), width: sourceWidth, height: sourceHeight };
    }
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      if (resized || file.size > MAX_MEDIA_UPLOAD_BYTES) throw new Error("Image preparation unavailable");
      return { file, url: URL.createObjectURL(file), width, height };
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(decoded.image, 0, 0, width, height);

    // Try WebP first, but do not assume unsupported encoders returned WebP.
    const webp = await encode(canvas, "image/webp", .94);
    const transparentPng = file.type === "image/png" && hasTransparency(context, width, height);
    let output: Blob = file;
    if (resized) {
      const originalFormat = await encode(canvas, file.type, file.type === "image/png" ? undefined : .96);
      if (!originalFormat) throw new Error("Original image format cannot be preserved");
      output = originalFormat;
    }
    // Transparent PNG remains lossless; all other conversions must save useful
    // space and pass a quality check before replacing the original format.
    if (!transparentPng && webp && webp.size < output.size * .9 && await preservesQuality(canvas, webp)) output = webp;
    if (output.size > MAX_MEDIA_UPLOAD_BYTES) throw new Error("Prepared image is too large");
    const extension = output.type === "image/webp" ? "webp" : output.type === "image/png" ? "png" : "jpg";
    const prepared = output === file ? file : new File([output], `${file.name.replace(/\.[^.]+$/, "")}.${extension}`, { type: output.type, lastModified: file.lastModified });
    return { file: prepared, url: URL.createObjectURL(prepared), width, height };
  } finally { decoded.close(); canvas.width = 0; canvas.height = 0; }
}

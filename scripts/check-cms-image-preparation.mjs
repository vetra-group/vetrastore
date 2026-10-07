import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);
const cache = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const record = { exports: {} }; cache.set(filename, record);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const require = (name) => name.startsWith(".") ? load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`))) : nativeRequire(name);
  new Function("require", "module", "exports", code)(require, record, record.exports);
  return record.exports;
}
const { prepareCmsImage } = load("src/lib/cms/prepare-image.ts");
const original = { document: globalThis.document, createImageBitmap: globalThis.createImageBitmap };
let scenario, encodes, canvases, closed, checks = 0;
globalThis.createImageBitmap = async (blob) => ({ width: blob.candidate ? 600 : scenario.width, height: blob.candidate ? 300 : scenario.height, candidate: !!blob.candidate, close() { closed++; } });
globalThis.document = {
  createElement(tag) {
    assert.equal(tag, "canvas");
    const canvas = { width: 0, height: 0, candidate: false,
      getContext() {
        return { drawImage(image) { canvas.candidate = !!image.candidate; }, getImageData() {
          const value = canvas.candidate ? scenario.pixelError || 0 : 0;
          return { data: new Uint8ClampedArray([value, value, value, scenario.transparent ? 0 : 255, value, value, value, 255]) };
        } };
      },
      toBlob(callback, type) {
        encodes.push({ type, width: canvas.width, height: canvas.height });
        const actualType = type === "image/webp" && scenario.unsupportedWebp ? "image/png" : type;
        const bytes = type === "image/webp" ? scenario.webpBytes || 100 : scenario.originalBytes || 400;
        const blob = new Blob([new Uint8Array(bytes)], { type: actualType }); blob.candidate = type === "image/webp";
        callback(blob);
      },
    };
    canvases.push(canvas); return canvas;
  },
};
async function check(name, options, assertResult, bytes = new Uint8Array(1000)) {
  scenario = { width: 600, height: 300, ...options }; encodes = []; canvases = []; closed = 0;
  const file = new File([bytes], `source.${scenario.type === "image/png" ? "png" : scenario.type === "image/webp" ? "webp" : "jpg"}`, { type: scenario.type || "image/jpeg" });
  const result = await prepareCmsImage(file);
  try { assertResult(result, file); assert.ok(closed > 0, "Decoded image resources are released"); assert.ok(canvases.every((canvas) => canvas.width === 0 && canvas.height === 0), "Canvas allocations are released"); }
  finally { URL.revokeObjectURL(result.url); }
  checks++; console.log(`PASS: ${name}`);
}
try {
  await check("Unsupported WebP encoding retains the original MIME and file", { unsupportedWebp: true }, (result, file) => { assert.equal(result.file, file); assert.equal(result.file.type, "image/jpeg"); });
  await check("A larger WebP candidate retains the original", { webpBytes: 2000 }, (result, file) => assert.equal(result.file, file));
  await check("Visible encoding changes retain the original", { pixelError: 20 }, (result, file) => assert.equal(result.file, file));
  await check("Smaller high quality WebP is chosen with a matching extension", {}, (result) => { assert.equal(result.file.type, "image/webp"); assert.ok(result.file.name.endsWith(".webp")); });
  await check("Transparent PNG remains PNG", { type: "image/png", transparent: true }, (result, file) => assert.equal(result.file, file));
  await check("Oversized transparent PNG keeps alpha and its aspect ratio", { type: "image/png", transparent: true, width: 4000, height: 2000 }, (result) => { assert.equal(result.width, 3000); assert.equal(result.height, 1500); assert.equal(result.file.type, "image/png"); assert.ok(encodes.every((item) => item.width === 3000 && item.height === 1500)); });
  await check("Oversized JPEG resizes proportionally with original format fallback", { unsupportedWebp: true, width: 2000, height: 4000 }, (result) => { assert.equal(result.width, 1500); assert.equal(result.height, 3000); assert.equal(result.file.type, "image/jpeg"); });
  const animated = Buffer.alloc(30); animated.write("RIFF"); animated.write("WEBP", 8); animated.write("VP8X", 12); animated.writeUInt32LE(10, 16); animated[20] = 2;
  await check("Animated WebP is retained without flattening", { type: "image/webp" }, (result, file) => { assert.equal(result.file, file); assert.equal(encodes.length, 0); }, animated);
  const animatedPng = Buffer.alloc(28); animatedPng.writeUInt32BE(8, 8); animatedPng.write("acTL", 12);
  await check("Animated PNG is retained without flattening", { type: "image/png" }, (result, file) => { assert.equal(result.file, file); assert.equal(encodes.length, 0); }, animatedPng);
  scenario = { width: 4000, height: 2000 }; encodes = []; canvases = []; closed = 0;
  await assert.rejects(prepareCmsImage(new File([animated], "animation.webp", { type: "image/webp" })), /cannot be resized safely/); checks++;
  await assert.rejects(prepareCmsImage(new File([new Uint8Array(20 * 1024 * 1024 + 1)], "large.jpg", { type: "image/jpeg" })), /Unsupported image/); checks++;
  await assert.rejects(prepareCmsImage(new File(["svg"], "unsafe.svg", { type: "image/svg+xml" })), /Unsupported image/); checks++;
  scenario = { width: 20001, height: 1 };
  await assert.rejects(prepareCmsImage(new File(["image"], "oversized.jpg", { type: "image/jpeg" })), /Invalid image dimensions/); checks++;
} finally {
  if (original.document === undefined) delete globalThis.document; else globalThis.document = original.document;
  if (original.createImageBitmap === undefined) delete globalThis.createImageBitmap; else globalThis.createImageBitmap = original.createImageBitmap;
}
console.log(`PASS: ${checks} browser image preparation policy checks.`);

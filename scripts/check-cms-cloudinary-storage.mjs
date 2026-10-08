import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const original = {
  fetch: globalThis.fetch,
  cloud: process.env.CLOUDINARY_CLOUD_NAME,
  key: process.env.CLOUDINARY_API_KEY,
  secret: process.env.CLOUDINARY_API_SECRET,
  folder: process.env.CMS_CLOUDINARY_FOLDER,
};
process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
process.env.CLOUDINARY_API_KEY = "test-key";
process.env.CLOUDINARY_API_SECRET = "test-secret";
process.env.CMS_CLOUDINARY_FOLDER = "vetra-cms";

class CmsError extends Error {
  constructor(message, status = 400, code) { super(message); this.status = status; this.code = code; }
}
const source = readFileSync(path.join(root, "src/lib/cms/cloudinary-storage.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const loaded = { exports: {} };
new Function("require", "module", "exports", compiled)((id) => id === "./validation" ? { CmsError } : requireNative(id), loaded, loaded.exports);
const { uploadPrivateImage, downloadPrivateImage, deletePrivateImage } = loaded.exports;

function requireNative(id) {
  if (id === "node:crypto") return { createHash };
  throw new Error(`Unexpected import: ${id}`);
}

const bytes = Buffer.from("A small deterministic image fixture for transport checks.");
const hash = createHash("sha256").update(bytes).digest("hex");
const filename = `${hash}.png`;
const publicId = `vetra-cms/${hash}`;
let checks = 0;

function signed(parameters) {
  const values = Object.fromEntries(parameters);
  const signature = values.signature;
  delete values.signature;
  delete values.api_key;
  delete values.file;
  const expected = createHash("sha256").update(Object.keys(values).sort().map((key) => `${key}=${values[key]}`).join("&") + "test-secret").digest("hex");
  assert.equal(signature, expected, "Cloudinary request fields are signed");
  assert.equal(parameters.get("api_key"), "test-key");
}

function mockProvider({ uploadStatus = 200, uploadBody, uploadThrows = false, downloaded = bytes, downloadStatus = 200, deletionBody = { result: "ok" }, deletionStatus = 200 } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const parsed = new URL(url);
    const action = parsed.pathname.split("/").at(-1);
    calls.push(action);
    assert.equal(parsed.hostname, "api.cloudinary.com");
    assert.ok(parsed.pathname.startsWith("/v1_1/test-cloud/image/"));
    if (action === "upload") {
      assert.equal(init.method, "POST");
      assert.equal(init.body.get("public_id"), publicId);
      assert.equal(init.body.get("type"), "authenticated");
      assert.equal(init.body.get("overwrite"), "false");
      assert.equal(init.body.get("file").type, "image/png");
      signed(init.body);
      if (uploadThrows) throw new TypeError("lost response after provider write");
      return Response.json(uploadBody ?? { public_id: publicId, type: "authenticated" }, { status: uploadStatus });
    }
    if (action === "download") {
      assert.equal(parsed.searchParams.get("public_id"), publicId);
      assert.equal(parsed.searchParams.get("format"), "png");
      assert.equal(parsed.searchParams.get("type"), "authenticated");
      signed(parsed.searchParams);
      return new Response(downloadStatus === 200 ? downloaded : "missing", { status: downloadStatus });
    }
    if (action === "destroy") {
      assert.equal(init.method, "POST");
      assert.equal(init.body.get("public_id"), publicId);
      assert.equal(init.body.get("type"), "authenticated");
      assert.equal(init.body.get("invalidate"), "true");
      signed(init.body);
      return Response.json(deletionBody, { status: deletionStatus });
    }
    throw new Error(`Unexpected provider action: ${action}`);
  };
  return calls;
}

try {
  let calls = mockProvider();
  await uploadPrivateImage(filename, bytes);
  assert.deepEqual(calls, ["upload", "download"]);
  checks++;

  calls = mockProvider({ uploadThrows: true });
  await uploadPrivateImage(filename, bytes);
  assert.deepEqual(calls, ["upload", "download"], "A lost upload response is resolved by exact byte readback");
  checks++;

  calls = mockProvider({ uploadStatus: 409, uploadBody: { error: "already exists" } });
  await uploadPrivateImage(filename, bytes);
  assert.deepEqual(calls, ["upload", "download"], "A conflicting retry is resolved by content identity");
  checks++;

  calls = mockProvider({ uploadBody: { public_id: publicId, type: "authenticated", overwritten: true } });
  await assert.rejects(uploadPrivateImage(filename, bytes), (error) => error.code === "UPLOAD_UNCERTAIN");
  assert.deepEqual(calls, ["upload"], "An unexpected overwrite is preserved for review");
  checks++;

  calls = mockProvider({ uploadThrows: true, downloaded: Buffer.alloc(bytes.length, 0) });
  await assert.rejects(uploadPrivateImage(filename, bytes), (error) => error.code === "UPLOAD_UNCERTAIN");
  assert.deepEqual(calls, ["upload", "download"], "A same-size collision is never accepted or deleted");
  checks++;

  calls = mockProvider({ downloadStatus: 404 });
  await assert.rejects(uploadPrivateImage(filename, bytes), (error) => error.code === "UPLOAD_UNCERTAIN");
  assert.deepEqual(calls, ["upload", "download"], "Missing provider media remains uncertain");
  checks++;

  calls = mockProvider();
  await assert.rejects(uploadPrivateImage(filename, Buffer.from("incorrect")), (error) => error.code === "MEDIA_STORAGE_INVALID");
  assert.deepEqual(calls, [], "Invalid local content identity never reaches the provider");
  checks++;

  calls = mockProvider({ downloaded: Buffer.alloc(bytes.length, 0) });
  await assert.rejects(downloadPrivateImage(filename), (error) => error.code === "MEDIA_STORAGE_INVALID");
  assert.deepEqual(calls, ["download"]);
  checks++;

  calls = mockProvider({ deletionBody: { result: "ok" } });
  await deletePrivateImage(filename);
  assert.deepEqual(calls, ["destroy"]);
  checks++;

  calls = mockProvider({ deletionBody: { result: "not found" } });
  await deletePrivateImage(filename);
  assert.deepEqual(calls, ["destroy"], "Already absent asset cleanup is idempotent");
  checks++;

  calls = mockProvider({ deletionBody: { result: "pending" } });
  await assert.rejects(deletePrivateImage(filename), /could not be confirmed/);
  assert.deepEqual(calls, ["destroy"], "An unconfirmed delete never reports success");
  checks++;

  calls = mockProvider({ deletionBody: { result: "ok", padding: "x".repeat(70 * 1024) } });
  await assert.rejects(deletePrivateImage(filename), (error) => error.code === "CMS_MEDIA_UNAVAILABLE");
  assert.deepEqual(calls, ["destroy"], "Provider JSON is bounded before parsing");
  checks++;
} finally {
  globalThis.fetch = original.fetch;
  for (const [key, value] of [["CLOUDINARY_CLOUD_NAME", original.cloud], ["CLOUDINARY_API_KEY", original.key], ["CLOUDINARY_API_SECRET", original.secret], ["CMS_CLOUDINARY_FOLDER", original.folder]]) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
console.log(`PASS: ${checks} credential-free Cloudinary storage transport checks.`);

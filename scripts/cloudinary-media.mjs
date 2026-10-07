#!/usr/bin/env node
import { createHash, timingSafeEqual } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import {
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const filenames = [
  "hero-eshan-1.webp",
  "hero-eshan-2.webp",
  "hero-eshan-3.webp",
  "hero-eshan-4.webp",
  "hero-coffee-landscape.webp",
  "hero-honey-ritual.webp",
  "honey-product.png",
  "nature-story.webp",
  "coffee-beans.webp",
  "coffee-ritual.webp",
  "honey-front.jpg",
  "honey-back.jpg",
];
const mimeTypes = { webp: "image/webp", png: "image/png", jpg: "image/jpeg" };
const attempts = 3;
const timeoutMs = 20_000;

class MediaError extends Error {}
class RetryableError extends Error {}

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const publicAsset = ({ filename, publicId, bytes, sha256 }) => ({
  file: `public/images/${filename}`,
  publicId,
  bytes,
  sha256,
});

async function localAssets() {
  const imageDirectory = await realpath(resolve(root, "public/images"));
  return Promise.all(
    filenames.map(async (filename) => {
      const path = await realpath(resolve(imageDirectory, filename));
      const relativePath = relative(imageDirectory, path);
      if (
        relativePath.startsWith(`..${sep}`) ||
        relativePath === ".." ||
        isAbsolute(relativePath)
      ) {
        throw new MediaError(
          `Source must stay inside public/images: ${filename}`,
        );
      }
      const fileStat = await stat(path);
      if (
        !fileStat.isFile() ||
        fileStat.size < 1 ||
        fileStat.size > 10 * 1024 * 1024
      ) {
        throw new MediaError(
          `Expected a non-empty image under 10 MB: ${filename}`,
        );
      }
      const data = await readFile(path);
      const format = extname(filename).slice(1);
      const valid =
        format === "png"
          ? data
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : format === "jpg"
            ? data[0] === 255 && data[1] === 216 && data[2] === 255
            : data.toString("ascii", 0, 4) === "RIFF" &&
              data.toString("ascii", 8, 12) === "WEBP";
      if (!valid)
        throw new MediaError(
          `Image file signature does not match its extension: ${filename}`,
        );
      return {
        filename,
        publicId: `vetra/${filename.slice(0, -extname(filename).length)}`,
        format,
        data,
        bytes: data.length,
        sha256: hash(data),
      };
    }),
  );
}

function credentials(env) {
  const names = [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ];
  const missing = names.filter((name) => !env[name]?.trim());
  if (missing.length)
    throw new MediaError(
      `Missing environment variables: ${missing.join(", ")}. No network requests were made.`,
    );
  const cloud = env.CLOUDINARY_CLOUD_NAME;
  if (!/^[a-z0-9_-]{1,128}$/.test(cloud))
    throw new MediaError(
      "CLOUDINARY_CLOUD_NAME must be a valid cloud name, not a URL. No network requests were made.",
    );
  return {
    cloud,
    key: env.CLOUDINARY_API_KEY,
    secret: env.CLOUDINARY_API_SECRET,
  };
}

function sign(parameters, secret, algorithm = "sha256") {
  const serialized = Object.keys(parameters)
    .sort()
    .map((key) => `${key}=${parameters[key]}`)
    .join("&");
  return createHash(algorithm)
    .update(serialized + secret)
    .digest("hex");
}

async function readBounded(response, maxBytes) {
  if (!response.body)
    throw new MediaError("The provider returned an empty response body.");
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > maxBytes)
      throw new MediaError("The provider response exceeded the expected size.");
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// A fresh request body and timeout are created for each bounded retry.
async function request(fetchImpl, url, init, consume, label) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        ...init(),
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (
        response.status === 408 ||
        response.status === 429 ||
        response.status >= 500
      ) {
        await response.body?.cancel();
        throw new RetryableError();
      }
      return await consume(response);
    } catch (error) {
      if (error instanceof MediaError) throw error;
      const retryable =
        error instanceof RetryableError ||
        error instanceof TypeError ||
        ["AbortError", "TimeoutError"].includes(error?.name);
      if (!retryable || attempt === attempts) {
        throw new MediaError(
          `${label} could not be confirmed after ${attempt} attempt(s). Keep Cloudinary media disabled and rerun to verify the deterministic IDs. No assets were deleted.`,
        );
      }
      console.error(
        `${label}: temporary failure; retry ${attempt + 1}/${attempts}.`,
      );
      await delay(attempt * 750);
    }
  }
}

async function jsonBody(response) {
  try {
    return JSON.parse(
      (await readBounded(response, 128 * 1024)).toString("utf8"),
    );
  } catch (error) {
    if (
      error instanceof MediaError ||
      ["AbortError", "TimeoutError"].includes(error?.name)
    )
      throw error;
    throw new MediaError(
      "The provider returned an invalid JSON response. No assets were deleted.",
    );
  }
}

function deliveryUrl(asset, config) {
  return `https://res.cloudinary.com/${config.cloud}/image/upload/${asset.publicId}.${asset.format}`;
}

function verifyIdentity(resource, asset, config) {
  if (
    !resource ||
    resource.public_id !== asset.publicId ||
    resource.resource_type !== "image" ||
    resource.type !== "upload" ||
    typeof resource.asset_id !== "string" ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(resource.asset_id) ||
    !Number.isSafeInteger(resource.version) ||
    resource.version < 1 ||
    resource.format !== asset.format ||
    !Number.isSafeInteger(resource.width) ||
    resource.width < 1 ||
    !Number.isSafeInteger(resource.height) ||
    resource.height < 1 ||
    resource.bytes !== asset.bytes
  ) {
    throw new MediaError(
      `Provider identity, format or byte count did not match ${asset.publicId}. Existing assets will not be overwritten.`,
    );
  }
  let url;
  try {
    url = new URL(resource.secure_url);
  } catch {
    throw new MediaError(`Invalid provider URL for ${asset.publicId}.`);
  }
  const path = `/${config.cloud}/image/upload/v${resource.version}/${asset.publicId}.${asset.format}`;
  if (
    url.protocol !== "https:" ||
    url.hostname !== "res.cloudinary.com" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== path
  ) {
    throw new MediaError(
      `Unexpected provider delivery URL for ${asset.publicId}.`,
    );
  }
}

function verifyUploadSignature(resource, config) {
  const signature = resource.signature;
  if (
    typeof signature !== "string" ||
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(signature)
  ) {
    throw new MediaError(
      "The upload response is missing a valid provider signature. No assets were deleted.",
    );
  }
  const expected = sign(
    { public_id: resource.public_id, version: resource.version },
    config.secret,
    signature.length === 64 ? "sha256" : "sha1",
  );
  if (
    !timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex"),
    )
  ) {
    throw new MediaError(
      "The upload response signature could not be verified. No assets were deleted.",
    );
  }
}

async function findAsset(asset, config, fetchImpl) {
  const url = `https://api.cloudinary.com/v1_1/${config.cloud}/resources/image/upload/${encodeURIComponent(asset.publicId)}`;
  return request(
    fetchImpl,
    url,
    () => ({
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.key}:${config.secret}`).toString("base64")}`,
      },
    }),
    async (response) => {
      if (response.status === 404) {
        await response.body?.cancel();
        return null;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new MediaError(
          `Provider lookup failed for ${asset.publicId} (HTTP ${response.status}). Check credentials and Admin API read permissions.`,
        );
      }
      const resource = await jsonBody(response);
      verifyIdentity(resource, asset, config);
      return resource;
    },
    `Lookup ${asset.publicId}`,
  );
}

async function verifyDelivery(asset, resource, config, fetchImpl) {
  verifyIdentity(resource, asset, config);
  // Verify the exact unversioned URL used by the application's rewrites.
  const url = deliveryUrl(asset, config);
  await request(
    fetchImpl,
    url,
    () => ({}),
    async (response) => {
      if (response.status === 404) {
        await response.body?.cancel();
        throw new RetryableError();
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new MediaError(
          `Delivery check failed for ${asset.publicId} (HTTP ${response.status}).`,
        );
      }
      const type = response.headers.get("content-type")?.split(";")[0];
      if (type !== mimeTypes[asset.format]) {
        await response.body?.cancel();
        throw new MediaError(
          `Unexpected delivery content type for ${asset.publicId}.`,
        );
      }
      const bytes = await readBounded(response, asset.bytes);
      if (bytes.length !== asset.bytes || hash(bytes) !== asset.sha256) {
        throw new MediaError(
          `Delivered bytes do not match ${asset.publicId}. Resolve the collision or account-level transformation before enabling media; nothing was overwritten.`,
        );
      }
    },
    `Verify ${asset.publicId}`,
  );
  return {
    ...publicAsset(asset),
    assetId: resource.asset_id,
    secureUrl: resource.secure_url,
    deliveryUrl: url,
  };
}

async function upload(asset, config, fetchImpl) {
  const url = `https://api.cloudinary.com/v1_1/${config.cloud}/image/upload`;
  const resource = await request(
    fetchImpl,
    url,
    () => {
      const parameters = {
        overwrite: "false",
        public_id: asset.publicId,
        timestamp: String(Math.floor(Date.now() / 1000)),
        unique_filename: "false",
      };
      const body = new FormData();
      for (const [key, value] of Object.entries(parameters))
        body.set(key, value);
      body.set("api_key", config.key);
      body.set("signature", sign(parameters, config.secret));
      body.set(
        "file",
        new Blob([asset.data], { type: mimeTypes[asset.format] }),
        asset.filename,
      );
      return { method: "POST", body };
    },
    async (response) => {
      if (!response.ok) {
        await response.body?.cancel();
        throw new MediaError(
          `Upload failed for ${asset.publicId} (HTTP ${response.status}). No overwrite or deletion was requested.`,
        );
      }
      const result = await jsonBody(response);
      if (result.overwritten === true)
        throw new MediaError(
          `Provider reported an unexpected overwrite for ${asset.publicId}; stopped for review.`,
        );
      // A retry after an uncertain write may return only { existing: true }.
      if (result.existing === true) return null;
      verifyIdentity(result, asset, config);
      verifyUploadSignature(result, config);
      return result;
    },
    `Upload ${asset.publicId}`,
  );
  const confirmed = resource ?? (await findAsset(asset, config, fetchImpl));
  if (!confirmed)
    throw new MediaError(
      `Upload outcome is uncertain for ${asset.publicId}. Keep media disabled and rerun; no cleanup or deletion was attempted.`,
    );
  return verifyDelivery(asset, confirmed, config, fetchImpl);
}

// fetchImpl permits offline verification of the upload/retry contract without credentials or network writes.
export async function run({
  args = process.argv.slice(2),
  env = process.env,
  fetchImpl = fetch,
} = {}) {
  if (
    args.length > 1 ||
    (args.length === 1 &&
      !["--dry-run", "--apply", "--verify", "--help"].includes(args[0]))
  ) {
    throw new MediaError(
      "Use no flag or --dry-run for a local preview, --verify for read-only provider checks, or --apply to upload. Flags cannot be combined.",
    );
  }
  if (args[0] === "--help") {
    console.log(
      "node scripts/cloudinary-media.mjs [--dry-run | --verify | --apply]\nDefault: local dry-run; no credentials, file writes, or network requests.\n--verify: read-only provider and image checks.\n--apply: upload missing images with overwrite=false, then verify delivery.",
    );
    return;
  }
  const mode = args[0]?.slice(2) ?? "dry-run";
  const assets = await localAssets();
  if (mode === "dry-run") {
    console.log(
      JSON.stringify(
        {
          mode,
          networkRequests: 0,
          overwrite: false,
          assets: assets.map(publicAsset),
        },
        null,
        2,
      ),
    );
    return;
  }
  const config = credentials(env);
  const verified = [];
  const missing = [];
  // Inspect all existing IDs before creating anything, so known collisions abort early.
  for (const asset of assets) {
    const existing = await findAsset(asset, config, fetchImpl);
    if (existing) {
      verified.push({
        ...(await verifyDelivery(asset, existing, config, fetchImpl)),
        status: "already-present-and-verified",
      });
      console.error(`Verified existing ${asset.publicId}.`);
    } else missing.push(asset);
  }
  if (mode === "verify" && missing.length) {
    throw new MediaError(
      `Missing Cloudinary assets: ${missing.map((asset) => asset.publicId).join(", ")}. Keep CLOUDINARY_MEDIA_ENABLED=false. No uploads were made.`,
    );
  }
  for (const asset of missing) {
    verified.push({
      ...(await upload(asset, config, fetchImpl)),
      status: "uploaded-and-verified",
    });
    console.error(`Uploaded and verified ${asset.publicId}.`);
  }
  console.log(
    JSON.stringify(
      {
        mode,
        verified: verified.length,
        total: assets.length,
        overwrite: false,
        assets: verified,
      },
      null,
      2,
    ),
  );
  console.error(
    "All nine delivery URLs match the bundled originals. Review the receipt before enabling CLOUDINARY_MEDIA_ENABLED=true and rebuilding.",
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  run().catch((error) => {
    // Do not print provider response bodies, credentials, signatures or raw fetch errors.
    console.error(
      error instanceof MediaError
        ? error.message
        : "Media setup failed while reading or validating local assets. Check all nine public/images files.",
    );
    process.exitCode = 1;
  });
}

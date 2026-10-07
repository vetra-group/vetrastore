# Cloudinary media setup

The nine storefront images stay bundled in `public/images` and work without a Cloudinary account. Cloudinary delivery is optional until its assets have been uploaded and verified. This setup script is for the curated storefront images; it is not a CMS upload interface.

## Preview the exact assets

Use Node.js 20.9 or later from the repository root:

```powershell
node scripts/cloudinary-media.mjs
```

The default and `--dry-run` modes read local files only. They validate the file signatures and print filenames, byte counts, SHA-256 hashes, and deterministic public IDs. They make no network request, change no file, and need no credentials.

| Local filename | Cloudinary public ID |
| --- | --- |
| `hero-eshan-1.webp` | `vetra/hero-eshan-1` |
| `hero-eshan-2.webp` | `vetra/hero-eshan-2` |
| `hero-eshan-3.webp` | `vetra/hero-eshan-3` |
| `honey-product.png` | `vetra/honey-product` |
| `nature-story.webp` | `vetra/nature-story` |
| `coffee-beans.webp` | `vetra/coffee-beans` |
| `coffee-ritual.webp` | `vetra/coffee-ritual` |
| `honey-front.jpg` | `vetra/honey-front` |
| `honey-back.jpg` | `vetra/honey-back` |

Public IDs omit the image extension. The fixed namespace is `vetra`; delivery URLs retain the original extensions. Review image provenance in [MEDIA_ASSETS.md](MEDIA_ASSETS.md).

## Configure the operator environment

Set the following in an uncommitted `.env.local` or the operator's secure environment:

```dotenv
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_MEDIA_ENABLED=false
```

Use credentials for the intended Cloudinary product environment with upload and Admin API asset-read permission. Keep the API secret server-side; do not add a `NEXT_PUBLIC_` prefix or commit credentials. The script does not automatically load Next.js environment files, so use Node's `--env-file` option when relying on `.env.local`.

## Upload only when ready

After reviewing the dry-run manifest, explicitly run:

```powershell
node --env-file=.env.local scripts/cloudinary-media.mjs --apply
```

This is the only mode that writes to Cloudinary. It first checks all nine IDs, then uploads missing assets in order. Existing assets are accepted only when their metadata and delivered bytes match the local originals. Each upload uses `overwrite=false`, a deterministic public ID, and a signed request. Cloudinary documents this combination for avoiding duplicate uploads. [Upload guide](https://cloudinary.com/documentation/upload_images#avoiding_duplicate_uploads)

The script checks provider identity, format, byte count, HTTPS URL, upload-response signature, and the SHA-256 digest of the exact unversioned delivery URL used by the storefront. Signatures use native Node crypto according to the provider's [authentication](https://cloudinary.com/documentation/authentication_signatures) and [response signature](https://cloudinary.com/documentation/response_signatures) documentation. Every request has a 20-second timeout and at most three attempts for temporary failures.

The JSON receipt on standard output contains only non-secret asset identifiers, URLs, and hashes. Progress goes to standard error. Save the receipt with your deployment records if desired. The script never prints credentials, request signatures, authorization headers, or provider error bodies.

If interrupted, keep Cloudinary delivery disabled and rerun the same command. Deterministic IDs let the script rediscover successful writes, including an upload whose response was lost. It never overwrites, renames, or deletes an asset. A collision, transformation, signature failure, or uncertain outcome stops the run; previously uploaded assets remain available for verification. Resolve a conflicting asset deliberately in the intended Cloudinary environment before retrying; there is no force-overwrite flag.

## Verify before switching delivery

This mode performs provider lookups and delivery reads only; it never uploads:

```powershell
node --env-file=.env.local scripts/cloudinary-media.mjs --verify
```

Only after all nine assets verify successfully, set `CLOUDINARY_MEDIA_ENABLED=true` for the deployment and rebuild/restart Next.js. The exact `/images/<filename>` routes are then served through configured rewrites to:

```text
https://res.cloudinary.com/<cloud_name>/image/upload/vetra/<filename>
```

Do not enable the flag before those URLs are present and verified. Do not apply incoming transformations or default upload-preset modifications: this workflow verifies that original bytes are preserved. An active rewrite does not automatically fall back to a bundled image on provider failure. To return to bundled delivery, set the flag to `false` and rebuild/restart; local images remain in the repository.

No upload, provider verification, or production activation is performed merely by adding these files or building the website. Live integration remains unverified until an operator explicitly runs the commands with the intended credentials.

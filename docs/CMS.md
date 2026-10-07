# Content management

Open `/cms` (English), `/ar/cms` (Arabic) or `/th/cms` (Thai). Use the hamburger button to open the left navigation drawer at any layout width. In the local preview, **Enter local workspace** starts an eight-hour session. Configured staff mode instead uses email/password sign-in.

Password-free access is enabled only with `NEXT_PUBLIC_DEMO_MODE=true`, local storage, loopback URLs such as `http://127.0.0.1:3100`, and outside Vercel. Signed HttpOnly sessions protect CMS reads and writes; mutations also require the same origin. Configured staff authentication, MongoDB content storage, and private Cloudinary media adapters are implemented. They require the account settings and staging rehearsal in [production setup](PRODUCTION_SETUP.md); the local preview does not connect outside services.

Configured staff accounts have **owner** or **editor** roles. Editors prepare content and images. Owners publish, approve business settings, recover revisions, manage complete backups, and run Cleanup. Audit entries include the staff identity; sign-out revokes the session, and removing an account or changing its session version revokes its existing sessions. Remote deployments never allow password-free CMS access.

Keep the preview server bound to loopback: `npm.cmd run dev -- --hostname 127.0.0.1 --port 3100`, or after building, `npm.cmd run start -- --hostname 127.0.0.1 --port 3100`.

## Editing and publishing

- Products: edit all three languages, names, routes, descriptions, prices, stock, images, card details, category and publication status. Manage gallery order, multilingual image descriptions and captions, including label images. The existing honey ID and route remain stable; archive it to hide it. New products have their own product routes.
- Slides: add, remove, reorder, enable, edit links and image descriptions in all three languages.
- Content: edit shared English, Arabic and Thai storefront text using named copy paths. Unknown paths are rejected. Missing Arabic translations are shown in the content editor and must be completed before publishing changed text.
- Blog: edit multilingual sections, lists, links, inline images, captions, tables, related products, categories and the featured article. Optional SEO titles/descriptions, social images, author, dates and references are supported. Use real authorship and dates. Published articles appear at `/blog/<slug>`, `/ar/blog/<slug>` and `/th/blog/<slug>`; `/journal` links redirect to matching blog URLs. The CMS keeps its internal `journal` key for compatibility. The case-study starter creates a review-required draft with internal editorial notes; it does not invent product-selection evidence.
- Media: choose and preview a JPEG, PNG or WebP image and add descriptions in all three languages. Preparation finishes in the browser before **Save image**; selection alone never uploads. The browser preserves aspect ratios, resizes oversized images and tries WebP with a quality-preserving fallback. Transparent PNGs stay PNG when required. Source images are limited to 20 MB, 20,000 pixels per side and 80 megapixels; prepared uploads are limited to 5 MB and 3,000 pixels on their longest side. The server verifies their actual signature and dimensions. Identical files share one stable SHA-256 identity. Delete is refused while draft or published content references the image.
- Settings: edit store identity, contact details and multilingual stock, batch, shipping, returns and wholesale information. An owner must confirm business details before they replace pending public information. Editing a confirmed term clears that confirmation. THB stays the currency.
- Commerce: orders, enquiries, customers and notifications use browser-local demo records, with assignment, notes, order stages, tracking and activity. They simulate operations; they do not confirm real payments, shipping or email delivery. Configuring CMS storage does not migrate these browser records.

1. **Save draft** persists edits without changing the storefront.
2. Open the saved article or product **Preview**. It requires CMS authentication, renders draft content, and is excluded from indexing. Save unsaved edits first.
3. **Publish** opens **Review before publishing**. Any pending editor changes are saved as a draft before the review opens; the website has not changed yet.
4. Compare changed fields and their before/after values. Choose all saved changes or selected articles/products, then **Publish reviewed changes**.

Selected publication leaves unrelated edits in draft and retains required media. Each record's status still controls public visibility. An article marked for factual review cannot be published with public status until that review is complete. Internal editorial notes are excluded from public content.

Article identity is separate from its editable slug. Renaming a saved article or supported product keeps earlier URLs as redirects to the current published route. Routes belonging to another saved or trashed record remain reserved; the protected honey route remains fixed. See [publishing and recovery](CMS_PUBLISHING.md) for route history, limits and API details.

**Restore published content** resets the draft to the last published snapshot. Unsaved form edits are kept on errors and across CMS content sections. Revision conflicts offer a merge with the latest draft or a confirmed reload; conflicting fields require an explicit choice before another save.

## Image submission and retries

Image submissions have two separate stages: upload prepared files into private staging, then save descriptions and image URLs together in one CMS revision. Success appears only after both stages finish. Staged images are bound to the signed session and submission ID; they cannot be used through the public media endpoint before the save succeeds. Selecting existing saved images in product, slide or blog editors does not create another upload.

- An upload failure stops before saving. Keep the prepared images and descriptions, then explicitly retry the failed upload. Successful uploads in the same submission are retained.
- A save failure retains uploaded URLs and form input. Retry the save without uploading again. A stale revision requires refreshing or resolving the current CMS edits first.
- A small, configurable retry allowance bounds each stage: one initial attempt and two user-triggered retries by default. Adjust `MAX_MEDIA_RETRIES` and the shared preparation, upload and batch limits in `src/lib/cms/media-policy.ts`. After save retries are exhausted, the server checks the stored submission outcome before removing only newly uploaded, unreferenced assets. If saving cannot be verified, it keeps the images. A later attempt uploads again if cleanup removed that submission's files.
- Retrying after a lost upload or save response is idempotent. Submission status checks resolve whether the save already completed; they do not create a second media record.

The owner **Cleanup** action removes confirmed, unreferenced leftover uploads and retries failed deletions. It protects saved media, live or published references, retained revisions, Trash restoration media, and current submissions with an active lease. This includes product galleries, article inline images and social images. Leftover-upload cleanup runs only when requested; the separate 30-day Trash expiry remains automatic. Keep unresolved submissions until their save outcomes can be checked safely.

## Trash and recovery

- Deleted products, slides, articles and uploaded images move to **Trash**. Orders and enquiries, including their notification previews, also move to Trash in this browser.
- Every item retains its original data, deletion date and automatic deletion date for 30 days. Select **Restore** before that deadline. No early permanent-delete button is provided.
- Moving CMS content to Trash saves the current draft after confirmation. Content remains on the published storefront until you publish the change. Restoring content returns it to the draft; publish when ready. Forms that were never saved can be discarded without changing stored records.
- An identity or URL conflict blocks restoration and preserves the trash item. Save your current content edits before restoring a CMS item.
- Uploaded bytes remain in local or configured media storage during recovery. Images needed by active content, retained revisions or unexpired Trash cannot be removed. Expired files are removed only after verifying that no retained content references them.
- Expired items are checked when stored data is accessed; the active local preview also checks periodically. When the application is inactive, expiry processing resumes on the next access. CMS Trash belongs to server storage; mock store activity and its Trash belong to this browser.

**Activity → Content revision history** compares and restores up to 30 snapshots from the previous 30 days. Recovery changes the draft and preserves current live content. Review and publish separately. Revision history protects its referenced images but does not replace an independent backup.

## Storage and backup

New prepared-image submissions belong to the stable staff account and can be
reconciled after signing in again. Existing receipts tied to an older session
migrate only while that original session is still authenticated. A new session
cannot claim an expired legacy receipt by knowing its ID. Preserve the prepared
files and resolve the saved outcome first. Owners can use manual **Cleanup** for
expired legacy leftovers that are confirmed unreferenced; saved originals,
Trash/history references and uncertain saves remain protected.

Local CMS content persists in `.local/cms/state.json`, independent of browser storage. Media, upload tracking, history and authentication files live under `.local/cms/`. These private paths are ignored by Git. Configured storage uses MongoDB for content/history/upload tracking and authenticated Cloudinary assets for uploaded images. See [production setup](PRODUCTION_SETUP.md) for the required configuration and migration rehearsal.

**Settings → Complete backup** downloads draft and published content, uploaded image bytes and checksums, upload tracking, history, audit and Trash. **Inspect backup to restore** validates the archive and displays changes. **Restore as draft** requires the inspected plan and current revision, restores missing images and editable content, and preserves current live content and retained Trash. Review and publish afterward.

Complete backups exclude credentials, sessions, secrets and bundled `public/images` assets; keep an application/source backup too. Treat archives as private administrative data. The single JSON archive is limited to 128 MiB before any stricter hosting limit. **Resumable folder backup** transfers larger backups in verified 512 KiB parts, with a 2 GiB total limit and 24-hour transfer window. Choose the same folder to resume; preparing a restore transfers files, then a separate reviewed confirmation restores the draft. Supported browsers use a folder picker; the documented CLI uses the same format. **Manage transfers** removes temporary parts in bounded batches. Active/uncertain transfers protect their images from Cleanup. See [complete backup details](CMS_PUBLISHING.md#complete-backups) and [production recovery preparation](PRODUCTION_SETUP.md#move-the-local-store-safely).

The legacy `/api/cms/export` endpoint still returns a content-only JSON snapshot. It contains no uploaded bytes or upload ledger and cannot replace a complete backup. The complete-backup restore control expects the new archive format, not this older snapshot.

Local mutations use a serialized queue, an exclusive file lock and atomic replacement. Configured writes use transaction-fenced leases; JSON documents are limited to 12 MiB and images to 5 MiB. Invalid snapshots are preserved and reported. The local preview may fall back to source content with a diagnostic. Configured remote read failures produce an error instead of silently substituting source prices or publication state. Preserve damaged data before recovering from a known backup.

Uploaded images are served from `/api/cms-media/<sha256>.<extension>` only when they exist in the media library. Trash-only images have an authenticated preview in the CMS and are unavailable through the public media endpoint. Files are never served by arbitrary filesystem paths, and SVG uploads are rejected. An uncertain save is read back before cleanup; uncertain images are retained for safe retries. Retrying the same image or a just-completed save does not create duplicate records.

## Verification

### Existing local blog content

The expanded blog defaults do not replace saved CMS edits automatically. For an
existing local snapshot, run `node scripts/migrate-blog-content.mjs` to review a
dry-run, then apply only that exact plan with
`node scripts/migrate-blog-content.mjs --apply --expected-plan <planHash>`.
The migration expands unchanged original articles and adds the new guides while
preserving custom edits, publication statuses, draft/published differences, and
Trash. It creates private before/after backups and a completion receipt in the
CMS directory. Run the dry-run again to confirm completion. A completed migration
never re-adds articles subsequently removed in the CMS. New installations already
use the expanded defaults and do not need this migration.

Run `node scripts/check-blog-migration.mjs` for isolated migration checks.

Run `npm run test:cms` for validation, authorization, staged media ownership, failed-save retention, uncertain-outcome protection, idempotent commits, failed-deletion recovery, reference protection and Trash retention. It uses isolated temporary local storage and no outside services. Run `npm run test:cms:images` for browser preparation policy checks covering aspect ratios, transparency, WebP fallback, conversion size, unsupported encoding and animated PNG/WebP preservation.

Run `npm run test:publishing` for isolated draft-preview authorization, selective publication, route history, revision recovery, nested-media references and complete backup integrity/restoration. Run `npm run test:platform` for staff permissions, business settings, search and mocked durable-storage checks. `npm run check:launch` gives a read-only configuration summary; it does not verify live providers.

Run `npm run test:backups` for chunk resume, folder-client integrity, protected media, bounded manual transfer removal and lost restore acknowledgements. Run `npm run test:published` for the published-only read model and outage behavior. These tests use isolated data/mocked services; native folder picker and live provider limits still need staging verification.

After building, run `npm run test:cms:live` for actual HTTP publication, private staging, atomic media saves, retries, Cleanup, Trash, draft previews, selected publication, route changes, history and backup recovery in a disposable preview. It creates and cleans its own data without modifying your CMS. Also run typecheck, lint, commerce/demo/image checks and localized route smoke checks. Review the drawer, dialogs and storefront at narrow/wide widths, with keyboard and zoom, in all three languages. See [QA results](QA.md) for actual checks and limitations.

Use the same runner with `--release --expected-site-url=<build-time public origin>` to also check public health, metadata domains, staging indexing, anonymous CMS denial and three-language storefront routes before the mutation tests. It disables external adapters and credentials in its child environment, even when the application has a local provider configuration. CI runs this complete rehearsal; see [repeatable local release checks](PRODUCTION_SETUP.md#repeatable-local-release-checks) for commands and limits.

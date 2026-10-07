# CMS publishing and recovery

## Editing and review

Save changes as a draft, open the authenticated preview, then open **Review
before publishing**. The review compares the saved draft with the current
published snapshot and shows the changed fields with before/after values.
Unsaved browser edits must be saved first.

The CMS edits English, Arabic and Thai in that order. Existing bilingual files
are upgraded in memory: exact unchanged seed text receives its reviewed Arabic
translation; customized text remains untouched and is marked for translation.
Missing translations block publication of changed records. They do not overwrite
stored content, history hashes, Trash, or old backup files.

Incomplete Arabic records are excluded from Arabic listings, search, sitemap
and alternate-language metadata. The language menu identifies unavailable
translations. Existing cart/saved items remain available with an explicit
notice and a link to their translated English or Thai details. Completing the
Arabic fields and publishing makes the Arabic route available.

Owners can publish all saved changes or selected articles/products. A selected
publication also retains the images those records need; unrelated drafts stay
unpublished. A record's `status` continues to control its public visibility.
Selecting a new featured article replaces the previous public feature.

Articles marked as requiring a facts review cannot be published with public
status until that review is completed. Editorial notes remain internal.
The case-study starter is an editable draft, not a claim that an inspection or
test has already taken place.

## Stable routes

Article identities are distinct from their editable slugs. Legacy articles
receive a deterministic identity on read without modifying the saved file.
Renaming a saved article or supported product retains its earlier routes;
old public URLs redirect directly to the current published route.

Routes reserved by another saved or trashed record cannot be reused. An item
may retain up to 50 previous routes. The protected honey product's established
identity and route remain fixed.

## Revisions

Each successful content mutation first preserves the previous draft and
published snapshots. Up to **30 snapshots**, each no older than **30 days**,
remain available. Restoring a revision changes the draft, keeps current live
content, and retains removed records through the normal Trash workflow.
Review and publish the restored draft when ready.

Images referenced by retained snapshots are protected from manual media
cleanup. Once no current, published, Trash, history, or active upload reference
remains, the existing authorized Cleanup action can remove them. History does
not introduce a background orphan-media cleanup job.

## Complete backups

The complete backup downloads JSON containing:

- Current draft, published content, audit records, and Trash.
- Retained revision snapshots.
- Uploaded image bytes and SHA-256 checksums.
- Upload tracking needed for safe retry and cleanup behavior.

It excludes login credentials and session secrets. Static application images
under `public/images` belong to the deployed project and are not duplicated in
the CMS archive. Keep the application/source backup alongside the CMS backup.
Treat the downloaded archive as private administrative data.

There are two transfer formats. The original single JSON archive remains
available for small stores, bounded to **128 MiB** before any stricter hosting
request limit. The **Resumable folder backup** handles larger stores without
putting every image into one request or building one large browser Blob.

Restore first validates the exact archive, image checksums, and required files.
The inspection produces a plan hash and current revision. The restore accepts
only that hash and revision, restores editable draft content and missing image
bytes, retains current live content and unexpired Trash, and preserves upload
tracking. Repeating a confirmed restore does not create duplicate records.
An interrupted file transfer can be retried with the same archive. Existing
files with conflicting contents are preserved and cause the restore to stop.

Recovery deliberately does **not** immediately replace the live website.
Review and publish the restored draft after verifying its images and details.

### Resumable folder workflow

In **Settings → Complete backup → Resumable folder backup**, choose **Export /
resume** and select an empty private folder. The CMS captures content, history
and upload tracking at one revision, then downloads immutable images outside
the content mutation lock. Files are divided into **512 KiB** parts. The
manifest and each complete file have SHA-256 integrity checks; downloaded parts
also have checksums. A changed or missing local part is downloaded again.

Pause or close the page, sign in again, and select the same folder to resume.
Transfers belong to the stable authenticated staff identity, so changing a
display name or session does not change ownership. Each request rechecks owner
permission. The transfer expires after **24 hours**; an export that expires
before completion must be started in a new folder. A completed folder can be
restored later using a new restore transfer.

To restore, **Choose restore folder** reads the manifest locally. It does not
upload anything. **Prepare restore / resume** uploads missing parts, verifies
complete files, and opens the draft comparison. Only **Restore as draft**
applies the reviewed revision and plan. A lost response resumes from confirmed
server receipts. An uncertain commit is reconciled against its audit marker
before another save or transfer removal; its images stay protected.

Keep `manifest.json` and every file in `chunks` together. The two progress JSON
files contain IDs and checksums, never credentials. The browser folder workflow
requires the File System Access picker (normally desktop Chrome/Edge). The CMS
shows a CLI alternative when it is unavailable; it does not claim that a
regular file input supports resumable folder writing.

**Manage transfers** removes temporary parts in bounded batches with visible
progress. A paused removal can be resumed. It never deletes saved content or
image files; use authorized **Cleanup** for confirmed unreferenced images.
Active transfer media are pinned against Cleanup and Trash deletion. Expired,
settled transfers release those pins; uncertain commits retain them until
resolved. Transfer metadata/parts are removed only through this manual action,
with no background media cleanup job.

Limits are centralized in `backup-format.ts`: **2 GiB** total original bytes,
**128 MiB** aggregate JSON metadata, **32 MiB** per metadata file, **5 MiB** per
image, **30** history files and **10,000** media files. At most **8** transfer
sessions may exist. Remove completed/expired sessions before starting more.
MongoDB's existing **12 MiB per saved JSON document** limit still applies to
the restored content. Parts are base64 encoded in private storage, so temporary
storage needs additional capacity. Provider quotas, request durations and
hosted transfer performance require staging verification.

### CLI alternative

Run from the project with Node 22.18 or newer:

```powershell
node scripts/cms-backup.mjs export --url=http://127.0.0.1:3100 --directory=./private-backup
node scripts/cms-backup.mjs restore --url=http://127.0.0.1:3100 --directory=./private-backup
node scripts/cms-backup.mjs status --url=http://127.0.0.1:3100 --directory=./private-backup
node scripts/cms-backup.mjs remove --url=http://127.0.0.1:3100 --directory=./private-backup --id=<transfer-id>
```

Use HTTPS for a remote store. Configured mode prompts for owner email and a
hidden password; credentials are held in memory and the session is signed out
when the command finishes. Never put passwords in command arguments. Repeating
the same command/folder resumes intact parts. There are no automatic retries.
The restore prints its change review and exact plan, then asks for `RESTORE`.
For a noninteractive local rehearsal, pass `--confirm-plan=<reviewed-plan>`;
a changed CMS revision requires a new review. `--new=true` starts a new restore
transfer after an old one expires. Resolve uncertain commits before discarding
an old transfer. Browser and CLI folders use the same format.

## API and checks

`/api/cms/publishing` provides saved-draft review, selective publication, and
revision comparison/restoration. `/api/cms/backup` provides complete download,
inspection, and restoration. `/api/cms/backup-transfer` handles authorized
manifest sessions, bounded chunk reads/writes, verification, inspection,
commit reconciliation and manual removal. All require CMS authentication; publication and
recovery writes require owner permission in configured staff mode.

Run `node scripts/check-cms-publishing.mjs` for isolated publication, slug,
history, nested-media, backup integrity, and fresh-storage recovery checks.
The script uses temporary directories under `output` and never changes the
working store's `.local/cms` data.

`npm run test:backups` checks interrupted downloads/uploads, integrity failures,
owner and origin authorization, cleanup pins, bounded removal and uncertain
restore outcomes. Its folder-client checks use in-memory handles and mocked
transport; they do not substitute for a real native folder-picker or hosted
provider rehearsal.

The disposable `npm run test:cms:live` runner also executes the actual backup CLI
over authenticated HTTP: export/resume, prepared review, draft-only recovery,
idempotent acknowledgement and manual transfer removal.

# Production setup and staging rehearsal

The storefront and CMS continue to use the existing local preview by default.
No payment, email, shipping, hosting or storage account was connected during
this implementation. Configuration checks never claim that a provider was tested.

## Production search origin

The owner-confirmed public origin is `https://vetrastore.asia`. In Vercel Project
Settings, set `NEXT_PUBLIC_SITE_URL=https://vetrastore.asia` for **Production**,
disable `NEXT_PUBLIC_DEMO_MODE`, and use `SITE_NOINDEX=false` only when the public
indexing launch is approved. Keep preview/staging values separate. A Vercel
production build now fails if the origin differs or demo mode is enabled. Changes
to deployment environment variables require a new deployment.

Configure `www.vetrastore.asia` to redirect to the apex host in Vercel Domains.
After the approved deployment, run
`node scripts/check-seo.mjs https://vetrastore.asia --expected-site-url=https://vetrastore.asia`
and inspect the live robots file and a page in each language. As of 7 October
2026, production still served `noindex`, `Disallow: /` and localhost canonical and
sitemap URLs; the local source changes do not change that deployed output.

## CMS accounts

The configured CMS uses server-side password verification, eight-hour signed
HttpOnly sessions, session records, same-origin mutations and owner/editor roles.
Editors can prepare content and images. Owners can publish, change store settings,
recover revisions, restore complete backups and run manual cleanup. Audit events
include the staff name and ID. Removing an account or increasing its
`sessionVersion` invalidates its sessions; logout revokes the current session.

1. Run `node scripts/hash-staff-password.mjs` locally. The prompt hides input and
   prints only a salted scrypt hash. Use a unique password of at least 16 characters.
2. Set `CMS_AUTH_MODE=password`, a random `CMS_SESSION_SECRET` of at least 64
   characters, and `CMS_STAFF_ACCOUNTS` as a JSON array in protected server settings.
   Each account needs `id`, `email`, `name`, `role` (`owner` or `editor`),
   `passwordHash` and integer `sessionVersion: 1`. At least one owner is required.
   Never put credentials in `NEXT_PUBLIC_*` variables or commit them.
3. For a local authentication rehearsal, keep demo mode enabled and storage local.
   For a deployment, configure the durable storage below and the correct HTTPS
   `NEXT_PUBLIC_SITE_URL`. Password-free access is limited to local demo mode.

## Durable content and media

Set `CMS_STORAGE=mongodb`, `MONGODB_URI`, `MONGODB_DB` and the existing Cloudinary
cloud name/key/secret. MongoDB must support transactions (a replica set, including
Atlas). Use distinct databases and `CMS_CLOUDINARY_FOLDER` values for staging and
production. Do not point a rehearsal at production data.

- CMS JSON snapshots, history and upload tracking use `cms_files` in MongoDB.
  Writes use transaction-fenced leases in `cms_locks`; expired workers cannot
  commit after another worker takes ownership. Individual JSON documents are
  limited to 12 MiB, with a clear error preserving existing data.
- CMS images use deterministic SHA-256 names and authenticated Cloudinary assets.
  Downloads remain behind the existing reference-checked media routes. Private
  provider URLs and credentials never reach the browser. Images are limited to
  5 MiB. Uploads do not overwrite existing files; every returned file is checked
  against its original hash.
- A durable intent is saved before uploading. Lost responses can be retried;
  unconfirmed saves retain their images. Cleanup only removes confirmed
  unreferenced assets, protecting active submissions, published/draft references,
  Trash and retained revisions. Media cleanup remains manual.
- Staff sessions use `cms_sessions`, and distributed login attempt counters use
  `cms_login_limits`. Provision TTL indexes on their `expiresAt` fields with
  `expireAfterSeconds: 0`. Do **not** apply a blanket TTL to content, media,
  upload tracking or locks. Session expiry is enforced during authorization even
  before an expired record is physically removed.
- Remote content read failures produce a recoverable page error and server log;
  the app does not silently substitute source prices when the database is down.

## Move the local store safely

Export a **complete backup** from the owner CMS, retain an independent copy, then
inspect and restore it in the separate configured staging CMS. Existing live
content remains unchanged: restore prepares a draft for review and publication.
Verify galleries, inline images, previous URL redirects, all three languages and Trash.
The backup includes uploaded bytes, upload tracking and retained content history;
it excludes login sessions, secrets and bundled application images.

The original single-file archive has a 128 MiB limit and may exceed a hosting
request/response limit. Use the **resumable folder backup** or compatible
`scripts/cms-backup.mjs` CLI for large transfers: 512 KiB binary parts, verified
manifest/file hashes, a 2 GiB total bound and a 24-hour session. The initial
snapshot copies bounded metadata; media download requests do not hold the
content write lock. Each chunk requires owner authentication. Manual transfer
removal runs in bounded batches; unresolved commits protect their media until
reconciled. See [the workflow and exact limits](CMS_PUBLISHING.md#resumable-folder-workflow).

Test transfer interruption, re-login, resume, restore and provider quotas on the
actual hosting setup before launch. Local and mocked tests do not verify host
durations, provider throughput or native picker support. Keep provider-native database
backups and an independent media backup, and rehearse restoration into a separate
environment. Retained CMS revisions are not a disaster-recovery backup.

The existing `scripts/cloudinary-media.mjs` is for bundled storefront assets.
It is separate from staged CMS uploads; follow `MEDIA_SETUP.md` for that migration.

## Business and commerce

Use CMS Settings to enter real contact details and approve stock/batch information,
delivery, returns and wholesale terms in all three languages. Editing a confirmed term
clears its confirmation until an owner reviews it. No shipping fee, stock count,
supplier claim or legal policy is invented by the application.

The current live commerce path is a **non-binding order enquiry**. Server prices,
quantity limits and request idempotency remain authoritative. Request outbox
records are stored with the enquiry; their provider is disabled. Mock order stages,
tracking, payment outcomes, cancellation and refund views are available locally.

Before enabling actual payment or delivery, choose the providers and implement and
verify their signed server callbacks, retry handling, stock reservations/releases,
shipping quote rules and refund reconciliation. A staff simulation must never be
treated as proof of payment or actual shipment. These integrations remain pending.

## Verification and release

- Run `npm run check:launch` for a read-only configuration summary and use CMS
  Settings → Launch preparation for published business information.
- Keep staging `SITE_NOINDEX=true`. Configure the final domain, verify canonical
  URLs, language alternatives, sitemap and redirects, then allow indexing only
  for the approved public release. Internal search and CMS previews remain noindex.
- Run typecheck, lint, commerce/demo/CMS/image/publishing/platform tests, build,
  isolated live HTTP tests, localized smoke tests, and a browser pass in both
  languages. `.github/workflows/verify.yml` provides the automated checks when
  this project is placed in GitHub; it does not deploy.
- Rehearse draft → preview → publish, renamed URLs, image retries, backup recovery,
  wholesale enquiries and the complete customer/staff journey using staging data.
- `/api/health` reports only `ok` or `unavailable`, with a 30-second check window.
  Connect uptime/error monitoring after hosting is selected; alert on failed
  requests and CMS storage diagnostics. Keep personal form details out of logs.
- Retain the previous deploy and an independent content/media backup. Roll back
  application code independently; restore CMS content to a draft and review it
  before publishing. Confirm backwards compatibility before every data migration.
- Connect Search Console and privacy-appropriate analytics after the production
  domain is ready. Track useful journeys such as product → enquiry and guide →
  product; never include customer messages or contact details in analytics events.

### Repeatable local release checks

After creating a demo build, run:

```sh
node scripts/check-cms-live.mjs --release --expected-site-url=http://127.0.0.1:3100
```

Replace the expected URL with the `NEXT_PUBLIC_SITE_URL` used for that build. It
checks the intended domain in canonical URLs, language alternatives, the sitemap
and robots without making requests to that domain. A mismatch fails the rehearsal
rather than silently accepting incorrect SEO URLs. The demo build must have been
created with `NEXT_PUBLIC_DEMO_MODE=true`; changing this public setting requires
rebuilding. Do not rebuild while another preview is using the same build files.

The runner owns a loopback server on port 3310. Add `--port=3312`, or another free
port, to keep an existing preview running. It does not attach to or terminate an
existing server. It explicitly clears CMS account, database and media credentials
in child processes and overrides local environment files with disabled provider
settings. Only a temporary `output/cms-live-*` directory is used for CMS data, and
it is removed after the owned server exits.

The checks run in this order:

1. Minimal public health response, anonymous administrative access denial,
   private preview headers, staging/private noindex and metadata domains.
2. Thai and English public routes, published articles, shared navigation/footer,
   headings, structured data, sitemap and legacy redirects.
3. Actual HTTP CMS edits, image submission/retry/cleanup, Trash, draft preview,
   selected publication, stable URL redirects, revision recovery and complete
   backup integrity/restoration. Recovery preserves the currently published
   content until a separate publication.

The GitHub verification workflow builds a demo with the expected domain
`http://127.0.0.1:3310` and runs this same command after the isolated unit and mocked
platform checks. Those platform checks also cover missing remote configuration,
deployed password-free access rejection and indexing configuration. CI does not
deploy, use real provider accounts or confirm provider availability.

Repeat this local rehearsal for application changes. A real staging release still
needs owner-approved facts, browser checks, configured provider availability,
hosting limits, monitoring, and restoration from independent provider backups.
The CMS archive tests exercise compatible content recovery; they cannot prove a
hosting rollback or compatibility with an untested future schema migration.

## Remaining owner inputs

Approved selling terms and contacts; actual ESHAN selection evidence/photos and
author details; production domain and provider accounts; acceptance of the staging
rehearsal. The selection case study is a review-required draft until those facts
are supplied. No deployment is performed automatically.

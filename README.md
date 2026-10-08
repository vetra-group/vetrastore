# VETRA STORE

A responsive English/Arabic/Thai storefront built with Next.js App Router, TypeScript, and CSS Modules. The source catalog starts with ESHAN coffee blossom honey, 380 g at **฿480**; published CMS content controls the active product details and price. Coffee collections are marked as coming soon.

## Run locally

```sh
npm install
npm run dev
```

Open `http://localhost:3000` for English (the default). Arabic is at `/ar`, with right-to-left layouts; Thai is at `/th`. The selector is ordered English → العربية → ไทย. Older `/en` links permanently redirect to the equivalent unprefixed English URL, preserving query strings.

On this workstation, use the working Windows launcher:

```powershell
npm.cmd run dev
```

## Included

- Homepage, filterable product collection, and dedicated honey page with product photographs, quantity selection, an editable gallery, and accessible FAQs.
- Localized site search across published products and articles, with result types and useful empty states.
- Persistent cart and favourites, quantity limits, server-owned pricing, and equivalent language navigation.
- Demo checkout with local enquiries and simulated successful/declined payments. Outside demo mode, optional non-binding enquiries require MongoDB.
- Dedicated wholesale enquiry fields for product, quantity, business, destination and required date, alongside general contact requests.
- Demo staff operations with enquiries, assignment, follow-up notes, order stages, tracking, activity, notification previews and a launch checklist. Demo records stay in this browser; simulated payment or shipping states are not real confirmations.
- English/Arabic/Thai `/cms` with a hamburger drawer, product/slide/copy editors, product galleries, rich article sections, SEO fields and owner-reviewed business settings. See [CMS usage](docs/CMS.md).
- Authenticated draft previews, before/after publication review, selected article/product publication, stable identities and previous-slug redirects, revision recovery, complete image/content backups, and 30-day Trash. See [publishing and recovery](docs/CMS_PUBLISHING.md).
- Optional configured staff accounts with owner/editor roles and revocable sessions, plus durable MongoDB/Cloudinary CMS adapters. Local preview remains available; external accounts require configuration and a staging rehearsal.
- About VETRA, an English/Arabic/Thai blog with practical product-selection guides, contact/wholesale form, newsletter signup, and help information. The public destinations are `/about` and `/blog`; older `/our-story` and `/journal` links permanently redirect, including existing article URLs.
- Localized metadata, canonical and alternate-language links, sitemap, Product/Blog/BlogPosting/BreadcrumbList/WebSite structured data, and private-page noindex settings.
- Bounded form validation, idempotent enquiry persistence and outbox records, retryable failures, and input preservation. Notification delivery remains disabled until a provider is connected.

## Configuration and launch boundaries

See [local demo behavior](docs/LOCAL_DEMO_AND_LAUNCH.md) for browser-local customer/staff flows, [production setup and staging rehearsal](docs/PRODUCTION_SETUP.md) for staff authentication and release preparation, and the [data management handoff](docs/DATA_MANAGEMENT_HANDOFF.md) for MongoDB/Cloudinary backups and recovery boundaries. Provider configuration does not constitute a successful provider test.

Copy `.env.example` to `.env.local` and set the required values locally. Never commit credentials.

- `NEXT_PUBLIC_SITE_URL`: real public domain used for SEO URLs before deployment.
- `NEXT_PUBLIC_DEMO_MODE=true`: enables local mock flows and `/staff`. It also permits password-free CMS access only with local storage, a loopback origin and no Vercel deployment. Keep false for real deployments; rebuild after changing it.
- `SITE_NOINDEX=true`: blocks indexing for staging. Demo builds also block indexing automatically.
- `MONGODB_URI` and `MONGODB_DB`: needed to persist contact messages, newsletter signups, and order enquiries. Without them, forms return 503 and do not show false success.
- `ORDER_ENQUIRIES_ENABLED=true`: enables **order enquiries only**, not paid checkout. Prices are recalculated on the server. Saving an enquiry/outbox record does not send an email; the delivery provider remains disabled.
- `CMS_AUTH_MODE=password`, `CMS_SESSION_SECRET`, `CMS_STAFF_ACCOUNTS`: configure identified owner/editor sign-in. Generate password hashes with `node scripts/hash-staff-password.mjs`; follow [staff account setup](docs/PRODUCTION_SETUP.md#cms-accounts).
- `CMS_STORAGE=mongodb`, MongoDB connection settings, Cloudinary credentials and `CMS_CLOUDINARY_FOLDER`: enable durable CMS content and authenticated uploaded media. MongoDB must support transactions. Keep staging and production stores separate.
- `CLOUDINARY_MEDIA_ENABLED` controls delivery of bundled storefront images separately from CMS uploads. Follow [media setup](docs/MEDIA_SETUP.md) before enabling it; local bundled media works by default.

Payment collection, provider email delivery, shipping integrations, and customer sign-in/order history remain unconnected. Enter and approve real contact, stock/batch, shipping, returns and wholesale information in CMS Settings; the application does not invent these terms. Configure and verify payment callbacks, inventory handling and refunds before taking paid orders. The account destination currently provides favourites and the guest bag in this browser, without a registered customer account.

The original sample's expiry date is not treated as current inventory. Verify sale stock independently. No reviews, certifications, stock levels, discount prices, delivery guarantees, or business contacts were invented.

Public form throttling is per server process; configure platform-wide abuse controls before exposing forms at scale. Configured CMS login also has distributed attempt limits when using MongoDB. Production form data can persist in MongoDB; email distribution and the operational handling of customer data require launch configuration. The browser-local operations dashboard does not automatically become a production order-management system when CMS storage is enabled.

Complete CMS backups include uploaded bytes, content, upload tracking, retained history and Trash. They exclude secrets, sessions and bundled application images. Restore prepares a draft for review and publication. Local browser transfers are bounded to 128 MiB; verify the hosting platform's lower limits and provider-native backups before launch. Retained revisions are not an independent disaster-recovery backup.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run test:demo
npm run test:cms
npm run test:cms:images
npm run test:publishing
npm run test:platform
npm run test:search
npm run check:launch
npm run build
npm run test:cms:live
node scripts/smoke.mjs http://127.0.0.1:3000
```

The smoke check expects a running server. It verifies all three languages, route responses, headings, metadata, legacy English/honey/about/blog redirects, published article discovery, sitemap, robots, and demo dashboard gating. Publishing checks use isolated temporary storage; platform checks mock external transport. `check:launch` reports configuration, not successful live-provider operation. See [verification results](docs/QA.md) for completed browser checks and actual limits.

After building, `npm run test:cms:live` starts a disposable loopback preview and verifies actual CMS APIs, private uploads, image retries, Cleanup, Trash, draft previews, selected publication, renamed routes, history and complete backup recovery. It cleans up its own data and leaves your CMS unchanged. The included GitHub verification workflow runs automated checks when this project is placed in GitHub; it does not deploy.

For the complete local release rehearsal, use `node scripts/check-cms-live.mjs --release --expected-site-url=http://127.0.0.1:3100` after a demo build. Set the expected URL to the `NEXT_PUBLIC_SITE_URL` used for that build; it is checked in metadata without requesting that domain. The runner starts on port 3310 (`--port=3312` chooses another available port), checks health, private-route authorization, staging indexing and domain consistency, runs three-language storefront smoke checks, then exercises the CMS and recovery workflows. Its child processes explicitly disable external storage and credentials and use disposable data. This verifies the local application; actual hosting, provider access and disaster recovery still require a separate staging rehearsal. See [repeatable release checks](docs/PRODUCTION_SETUP.md#repeatable-local-release-checks).

## Project structure

See [all 21 tasks and their status](docs/TASK_STATUS.md) for the original plan,
and [local browser quality checks](docs/LOCAL_QA.md) for optional performance and
larger-text diagnostics with their actual-browser verification limits.

Language configuration is in `src/lib/i18n.ts`. Source copy is in `src/content` and localized form dictionaries; `src/lib/catalog.ts` defines the initial catalog. CMS drafts and publication, media, recovery, authentication and storage live in `src/lib/cms`. Styled components use colocated CSS Modules and shared tokens from `src/app/globals.css`.

Original design/source images remain unchanged. Generated editorial assets, exact prompts, and source-photo provenance are documented in [media assets](docs/MEDIA_ASSETS.md). Deployment has not been performed.

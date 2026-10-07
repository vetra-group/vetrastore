# Task status

## English default, Arabic second, Thai third — 5 October 2026

**Implemented and checked locally.** English `/`, Arabic `/ar`, Thai `/th`;
ordered selector; complete public Arabic copy and nine articles; Arabic CMS,
forms and mock customer/staff workflows; RTL, self-hosted Arabic fonts, SEO,
search normalization, preserved carts and safe multilingual CMS migration.

Build, lint, TypeScript, 57 public route checks, isolated CMS/media/recovery
HTTP checks and three-language browser journeys passed. Existing CMS files
were preserved byte-for-byte. See the latest section in `QA.md` for evidence,
counts and limitations. New customized CMS text requires its own translations
before publication; native editorial sign-off is a separate human review.

## Eight storefront polish tasks — 5 October 2026

All eight tasks from the latest visual/interaction recommendation are
implemented and checked locally. They are separate from the earlier coding
tasks and the original 21-task list below.

| # | Improvement | Result |
| --- | --- | --- |
| 1 | Visual refinement | Shared type/line-height, spacing, shadows and status tokens; refined home/catalog cards, Thai headings, image framing and product section rhythm. Existing copy, colors and card direction retained. |
| 2 | Smoother galleries | Decode-before-switch, bounded thumbnail rail, active thumbnail visibility, touch swipes that preserve vertical scrolling and normal link taps, loading/error/retry states and accessible zoom. |
| 3 | Mini-cart | Shared modal drawer with quantities, current subtotal, next actions and Undo; stock bounds, reload persistence, focus return and short-height scrolling. |
| 4 | Live search | Published-only product/article suggestions, thumbnails, prices, real totals, bounded results, localized destinations, keyboard navigation and retry/empty states. |
| 5 | Customer forms | Localized inline errors and focused summaries; grouped fields; opt-in 24-hour recovery without consent/payment data; retained input and opaque retry identity. |
| 6 | First-load delivery | Existing font families self-hosted as licensed variable subsets, no external font requests; existing priority image behavior retained; before/after throttled samples recorded with comparability limits. |
| 7 | Consistent interactions | Shared motion/status tokens, modal lifecycle and quiet loading feedback; true-hover rules, visible keyboard focus and reduced-motion support. |
| 8 | Repeatable usability checks | Thai/English customer journeys, exact root scale through 7680 CSS px, actual 200%/400% browser zoom, real 32px browser font preference and CI screenshot/report artifacts. |

See `QA.md` and `LOCAL_QA.md` for results and commands. Physical devices,
operating-system scaling and other browser engines remain separate acceptance
checks. External services remain mocked/unconfigured; no deployment occurred.

## Eight coding improvements — 5 October 2026

All eight follow-up coding tasks are implemented. They extend the original
21-task work below. Local and mocked verification is recorded in `QA.md`;
external-service and owner-evidence requirements still apply.

| # | Improvement | Implementation |
| --- | --- | --- |
| 1 | Shared staff inbox | Server-persisted requests, search/filter/pagination, assignment, notes, customer history and reversible archive. Local public contact/wholesale and checkout enquiries can be reviewed from another staff browser. |
| 2 | Recover unfinished editing | Account/tab-scoped browser checkpoints for text and prepared images, explicit recovery/discard, field-by-field conflict choices and safe submission reconciliation. |
| 3 | Efficient public reads | Separate published-only read model, metadata-based cache refresh, atomic publication and private draft/editorial-note exclusion. Failed authoritative reads do not reuse stale prices. |
| 4 | Lighter CMS | Deferred editors/tools, compact article summaries, individual full-article fetch on edit, paginated libraries and reference-aware dirty comparison. The server restores omitted article bodies before validation/save/Trash. |
| 5 | Atomic simulated operations | Transactional request/inventory/outbox changes, immutable price/shipping snapshots, revision checks, idempotent commands, bounded retries and durable mock delivery receipts. |
| 6 | URL-based discovery | Blog/search query, category/type and pagination survive reload, browser history and language changes; totals include all matches and pagination stays bounded. |
| 7 | Resumable backups | Browser folder and CLI workflows, bounded 512 KiB chunks, manifest/file integrity checks, pause/resume, explicit reviewed draft restoration and manual transfer removal. |
| 8 | Repeatable browser regression | Disposable browser profiles and server data exercise editing/recovery, image submission, publication, drawers, search/blog navigation and shared staff workflows. CI runs these checks and retains screenshots. |

Payment, carrier and email actions remain simulations. MongoDB/Cloudinary
adapters require connected staging verification. CMS backups cover content,
media, revisions and Trash; the separate private operations store requires its
own backup and retention policy. See `SHARED_OPERATIONS.md` and
`CMS_PUBLISHING.md` for the exact boundaries.

## Original 21-task status

Status as of **5 October 2026**, after the local verification pass. The numbers
below preserve the original task list. “Locally checked” means implementation and
recorded local/isolated checks exist; it does not mean live services or every
possible browser condition have been verified. External services remain mocked
or disabled. No deployment has been performed.

| # | Original task | Current status and evidence | Remaining work or verification |
| --- | --- | --- | --- |
| 1 | Authenticated draft preview, excluded from indexing | **Locally checked.** Article/product preview, session checks, private cache/indexing headers and disabled purchase controls; publishing and HTTP workflow tests. | Recheck access and caching on the configured staging host. |
| 2 | Review changes and selectively publish | **Locally checked.** Before/after review and selected article/product publication; Publish opens review. Backend validates permissions and facts-review status. | Owner reviews real content before publishing it. |
| 3 | Rich article editing | **Locally checked.** Lists, links, images/captions, tables, related products, section ordering, categories and featured article in `CmsArticleEditor.tsx`; validation and rendering checks. | Editorial review of newly entered content in both languages. |
| 4 | SEO fields, author, dates, references and translation flags | **Implemented and checked locally.** Metadata fields, public attribution/references and core-field completeness flags for Thai/English. | Supply genuine authors/dates/sources; completeness flags do not certify translation accuracy. |
| 5 | Stable identities and slug history | **Locally checked.** Stable record IDs, reserved previous routes and redirects; rename, conflict and recovery tests in `check-cms-publishing.mjs`. | Verify redirects on the final domain after migration. |
| 6 | Editable product gallery | **Locally checked.** Image selection, ordering and bilingual descriptions/captions; saved gallery and purchase-disabled preview exercised. | Owner supplies any additional genuine product/label photographs. |
| 7 | Revision comparison, recovery and complete media backups | **Locally checked.** Retained history, field comparison, draft/image recovery, resumable folder/CLI transfers, archive checksums, media/tracking/Trash preservation and idempotent restore tests. Actual CLI HTTP recovery passed. | Native folder-picker permissions, independent provider backups, hosting transfer limits and recovery on real staging storage remain unverified. |
| 8 | Shared confirmed contacts, delivery, returns, wholesale and stock facts | **Mechanism ready; owner input pending.** CMS settings require confirmation before shared public terms change. | Approve actual contact details, stock/batches, delivery, returns and wholesale terms. |
| 9 | Structured wholesale enquiry and reference | **Locally checked.** Product, quantity, business, destination, requested date and saved reference; input validation, prefill and staff context. | Real database/email round trip and staff response process require staging verification. |
| 10 | Mock order stages, tracking, cancellation, notifications and activity | **Mock workflow checked.** 33 demo checks plus browser payment retry, quote persistence, refund and stock-release journey. | Real carrier/payment events are not connected. |
| 11 | Unified staff requests with search, filters, assignment and follow-up | **Shared server workflow checked locally.** CMS inbox, notes, assignment, filters, paginated requests and customer history. Actual public contact and a second browser share the same saved enquiry. Browser demos remain separate. | Connected database import and real staff procedures require staging acceptance; order/delivery controls remain simulations. |
| 12 | Genuine ESHAN “Why VETRA selected it” case study | **Incomplete: evidence required.** Saved draft updated at revision 19 with supplied front/back photographs, bilingual alt, references and sample limitations. Private and review-required. | Owner must provide actual selection process, observations, evidence and approved photographs. A draft is not a completed factual case study. |
| 13 | Product/article search, suggestions and useful empty states | **Locally checked.** Published-content search, filters, spelling/shorter-query suggestions and recovery links; six search/editorial checks and responsive browser checks. | Monitor real search needs after launch; only published content is suggested. |
| 14 | Accessibility: zoom, keyboard, contrast, reduced motion and larger fonts | **Verified locally in Chromium.** The newer storefront suite checks actual 200%/400% browser zoom, a real 32px browser font preference, keyboard dialogs, reduced motion and the exact rem scale; 90 accessibility/layout views. Earlier contrast and narrow-layout evidence remains in QA.md. | Physical devices, OS scaling/reduced-motion settings, native assistive technology and other browser engines still need acceptance. CSS 7680px coverage is not physical 8K hardware verification. |
| 15 | Measure performance: images, slider, fonts, CLS, interactions and slow connections | **Local measurements completed.** Opt-in PerformanceObserver report and constrained proxy; desktop LCP sample 2.99s before → 2.59s after deferring slider neighbours, Thai mobile 0.92s; low measured CLS. Raw reports and limits in `QA.md`. | Local samples, cached/unthrottled external fonts and no CPU throttle; field Core Web Vitals and real slow devices still require measurement. |
| 16 | Repeatable critical customer/staff journeys | **Current suites passed.** 191 release checks, 38 route checks, 159 isolated CMS/media/workflow/workspace HTTP checks, actual backup CLI recovery, 20 browser checks, 56 responsive views and other regression groups; evidence in `QA.md`. | Repeat these gates for subsequent changes and run connected staging acceptance before launch. |
| 17 | Durable MongoDB/Cloudinary CMS preserving the media workflow | **Adapters implemented; mocked checks passed.** Private media, verified hashes, staged retries, fenced writes and missing-configuration failure checks in `check-platform.mjs`. | No real MongoDB/Cloudinary round trip, provider outage rehearsal or hosting-scale restore has been verified. Not live-ready. |
| 18 | Staff roles, sessions and audit identities | **Implemented; local/mocked checks passed.** Owner/editor boundaries, password verification, signed sessions, logout/account revocation and attributed CMS mutations. | Configure real accounts/secrets, deploy session/attempt TTL indexes and verify permissions on staging. Demo operations are not a production authenticated order system. |
| 19 | Enquiry storage, reliable notifications, status and retries | **Local/mock implementation available.** Idempotent enquiry/outbox persistence contract and bounded, explicit notification simulations. | Real database delivery, email provider/worker, retry reconciliation and operational alerts remain unconnected and unverified. Not live-ready. |
| 20 | Checkout shipping, inventory, payment confirmation, cancellation and refunds | **Mock implementation and checks complete.** Configurable shipping rules, immutable quotes, reservations/expiry, commitments and return-aware release; 33 demo groups and actual browser retry/refund/quote journey passed. | Real inventory authority, shipping quotes, signed payment callbacks and refund reconciliation remain disabled. Not live-ready. |
| 21 | Launch rehearsal: domain, indexing, backups, monitoring, rollback and journeys | **Repeatable local rehearsal passed.** `test:release` and CI check health/privacy, metadata domains, staging indexing, localized routes and isolated recovery workflows. | Real domain/deployment, monitoring, provider recovery, code rollback and connected customer/staff acceptance remain unverified. Not live-ready. |

## Evidence and next updates

- [QA record](QA.md) contains actual completed checks and their limitations.
- [CMS publishing and recovery](CMS_PUBLISHING.md) documents preview, review,
  route history, revisions and backup contracts.
- [Production setup](PRODUCTION_SETUP.md#repeatable-local-release-checks)
  documents the repeatable local rehearsal and the separate live staging gates.
- [Media workflow](MEDIA.md) remains the required upload/save/cleanup contract.

Rows **8 and 12** still require genuine owner inputs. Keep the accessibility and
live-service limits explicit until those checks have actually been completed.
See [local browser QA](LOCAL_QA.md) for repeatable diagnostics and manual browser
acceptance steps.

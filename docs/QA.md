# Verification record

## English default and Arabic localization — 5 October 2026

- English is canonical at `/`, Arabic at `/ar` and Thai at `/th`; language
  navigation is ordered English, العربية, ไทย. Legacy `/en` paths redirect
  with query strings preserved. Canonicals, hreflang, sitemap, structured data,
  private CMS headers and equivalent-page switching cover all three languages.
- Arabic includes the storefront, product story/gallery, all nine published
  articles (51 sections), customer forms, mock commerce/staff flows and CMS UI.
  Translation review aligned singular visitor address and product/cart terms.
  Noto Sans Arabic and Noto Naskh Arabic are licensed, local assets. RTL uses
  logical spacing, directional keys/swipes, mirrored navigation icons and LTR
  technical inputs, while original product photographs remain unchanged.
- Production build, TypeScript and full ESLint passed. Language/migration,
  saved-product, search, gallery, commerce, customer forms, demo, operations,
  CMS, publishing, platform, recovery, backup and read-model checks passed.
  Existing custom translations remain intact; untranslated records cannot be
  published as complete Arabic. Saved cart items survive language switches.
- Final isolated release rehearsal passed 1,581 HTTP assertions and 57 route
  checks, followed by 61 CMS, 54 media, 33 workflow and 46 workspace checks plus
  actual backup CLI export/restore. The normal preview also passed all 57 route
  checks with its existing content. No external provider or deployment ran.
- Final Chromium reports contain 25 CMS/browser checks (84 layout views),
  23 storefront checks, 24 customer-form checks and 6 accessibility groups
  covering 180 views. These include actual 100%/200%/400% browser zoom across
  18 localized routes, a 32px browser default font, widths through 7680 CSS px,
  keyboard/focus, reduced motion, Arabic touch swipes, form recovery and
  Arabic-Indic phone/postcode input. No uncaught browser exceptions occurred.
- Arabic CMS edit → save → RTL preview → selected publication → public article
  was exercised while English/Thai content stayed intact. Missing shared-copy
  translation warnings and publication refusal were tested. Technical paths
  retained their leading slash and LTR direction.
- Visual evidence: `output/qa/storefront-polish/arabic-home-390.png`,
  `arabic-collection-1440.png`, Arabic gallery/cart/search/form screenshots,
  and `output/qa/browser-regression/cms-arabic-editor.png`. Full reports are in
  those two folders. All six original CMS JSON files still match their
  pre-change SHA-256 hashes; the backup manifest is in
  `output/language-migration-backup/manifest.json`.
- This is automated/local editorial review, not certification by a human
  native-language editor. Physical devices, other browser engines, OS scaling
  and native assistive technology remain outside the verified scope.

## Eight storefront polish tasks — 5 October 2026

- Completed all eight tasks in the latest visual/interaction list in
  `TASK_STATUS.md`: shared visual refinement, galleries, mini-cart, live search,
  customer forms, local font delivery/measurement, interaction states and
  expanded browser regression. Existing CMS records were preserved.
- Production build, TypeScript and full ESLint passed. Focused regression
  groups passed: 14 search/editorial/API, 9 gallery, 10 customer-form, and the
  commerce suite including stock-aware add/Undo and stable cart row ordering.
- New installed Edge browser suites passed 36 checks: 15 storefront journey
  checks (10 layout views), 15 form checks (12 views), and 6 accessibility
  groups (90 views). Thai/English verification covered cart quantities and
  totals, Undo, reload persistence, keyboard search, empty results, delayed
  image decoding, touch swipes, thumbnail visibility, gallery zoom, focused
  error summaries, opt-in recovery and confirmed isolated contact success.
  No uncaught browser exceptions occurred in these journeys.
- Actual browser preferences were set only in disposable profiles: 100%,
  200% and 400% zoom across 12 localized routes each, plus 32px browser default
  fonts across 24 route/width combinations. Assertions verify viewport/pixel
  ratio changes for zoom and the computed root font for text preferences.
  Short-height large-text mini-cart controls remain reachable. Another 27
  responsive views confirm the exact requested root curve through 7680 CSS px.
  These checks do not verify physical hardware, OS scaling, other browser
  engines or native assistive technology.
- The existing CMS/browser suite still passed 20 checks and 56 responsive
  views after the shared modal refactor. The final release rehearsal passed
  191 release checks, 38 localized routes, 159 CMS/media/workflow/workspace
  HTTP checks and actual CLI backup export/resume/reviewed draft recovery.
  All mutations used disposable server data with real providers disabled.
- Browser review found and fixed native search-input Escape behavior,
  reverse-Tab wrapping after Undo, short drawer scrolling, duplicate dialog
  footer landmarks, and a stable-scrollbar rule that shifted the prescribed
  rem interpolation by a fraction of a pixel. Pointer tests now wait for
  finite drawer movement before clicking its controls.
- Visually reviewed the homepage/card treatment on desktop and mobile, plus
  mini-cart, search, gallery and customer form screenshots. The final local
  production preview was restarted at `http://127.0.0.1:3100/`.

### Font delivery and constrained first-load samples

DM Sans, Noto Sans Thai and Noto Serif Thai are now local variable subsets,
with OFL licenses and source hashes retained in `src/app/fonts/`. The browser
loaded the local WOFF2 files and made no external font requests. Gallery images
retain their responsive sources and only replace the current view after
decoding; existing hero priority behavior is preserved.

One sample per route/width, fresh profile, HTTP cache disabled, 150ms latency,
400KB/s download, no CPU throttle, reduced motion to stabilize the hero:

| Route / CSS width | Earlier LCP | Final LCP | Final accumulated layout shift |
| --- | --- | --- | --- |
| Thai home / 390 | 820ms | 924ms | 0.00657 |
| English honey / 390 | 604ms | 628ms | 0.00152 |
| Thai home / 1440 | 1580ms | 2056ms | 0.00176 |
| English honey / 1440 | 1104ms | 972ms | 0.00588 |

The earlier run recorded the external Google stylesheet but no downloaded font
files. The final run loaded the actual local fonts. These are not equivalent
font-loading conditions, so these numbers **do not establish an overall speed
improvement**. They are local samples, not field Core Web Vitals or a slow-phone
benchmark; the shift value is accumulated during observation, not the complete
CLS session-window calculation. No long tasks were observed in these captures.

Evidence: `output/qa/storefront-polish/report.json`, `forms-report.json`,
`accessibility-report.json`, `performance-before.json`, `performance-after.json`
and PNG screenshots in that folder. Commands are documented in `LOCAL_QA.md`
and the new interaction suites run in CI. External payment, email, carrier,
MongoDB/Cloudinary and deployment verification remains outside these local
checks; existing simulations/configuration gates are retained.

## Eight coding improvements — 5 October 2026

- Implemented the eight follow-up tasks listed in `TASK_STATUS.md`: shared
  server enquiries, browser editing/image recovery, published-only reads,
  compact/deferred CMS editing, atomic simulated operations, URL pagination,
  resumable backups and automated browser regression. Existing working CMS
  content was not changed by the isolated mutation tests.
- Production build, full TypeScript and full ESLint passed. Regression checks
  passed: commerce, 33 demo, 15 CMS, 13 image-policy, 8 publishing, 8 migration,
  11 platform, 10 search/editorial, 12 recovery, 7 public-read-model and
  14 operations groups. Backup checks passed 8 server and 4 folder-client
  groups; folder handles and provider transports in those tests are mocked.
- The rebuilt isolated release preview passed 191 metadata/authentication/
  indexing/health checks, 38 localized route checks, and 159 CMS/media/workflow/
  workspace HTTP checks. Missing blog articles return 404; legacy aliases
  retain real redirects. The blog listing loading boundary was moved into a
  route group so it cannot prematurely stream an article's 404 as HTTP 200.
- The actual CLI exported and resumed a backup, prepared a restore for review,
  restored only the draft, confirmed the same result across a later sign-in,
  and removed temporary transfer files. The live runner gives the CLI its own
  owned server lifecycle so earlier auth tests cannot exhaust its sign-in
  allowance; production authentication throttling is unchanged. The complete
  `test:release` run passed, with logs in `output/qa/cms-release-server.log`.
- Actual headless Edge journeys passed 20 checks: mobile navigation, drawer
  focus containment/restoration, blog pagination/search/history/language
  switching, text recovery, field-level conflict choice, reviewed publication,
  deferred article opening, prepared image recovery before Submit, public
  contact to a second staff browser, saved staff notes, and a durable simulated
  delivery receipt. No uncaught browser exceptions were observed.
- Responsive geometry passed 56 Thai/English public/CMS route views at
  320/768/1440/2560/7680 CSS px (CMS at 320/1440). The headless browser reported
  an actual 7680 CSS px viewport; this is not physical 8K hardware, OS scaling,
  real browser zoom or changed default-font verification. Additional focused
  mobile dialog, backup and desktop media/notification views also fit without
  document overflow. Visual review confirmed readable controls and spacing.
- Evidence: `output/qa/browser-regression/report.json`, `server.log`,
  `cms-shared-enquiry-mobile.png`, `cms-notifications-desktop.png`,
  `cms-backup-mobile.png`, `cms-settings-mobile.png`,
  `cms-media-desktop.png` and `blog-mobile-filter.png`.
- One earlier concurrent-preview run returned a homepage server error. It did
  not recur in two sequential isolated browser runs; server logging was added,
  and the final rebuilt run's server log contains startup only. The earlier
  failure is not asserted to have a confirmed application-level cause.
- MongoDB/Cloudinary, real payments, carrier and email delivery remain
  unconnected. Native folder-picker permission prompts remain unverified;
  they are separate from folder-client and CLI coverage. Operations storage
  has a separate backup/retention boundary documented in
  `SHARED_OPERATIONS.md`. No deployment was performed.

## Remaining-task completion pass — 5 October 2026

- Reconciled the original 21 tasks in `TASK_STATUS.md`. Work extends beyond
  tasks 1–7. Local/mock implementation is complete except for owner evidence;
  actual browser-setting and live-service verification limits remain explicit.
- Added published-content search suggestions, spelling/shorter-query recovery,
  filter recovery and useful empty states. Six search/editorial checks passed.
- Added configurable browser-only shipping rules, immutable order quotes,
  stock reservations/expiry, paid commitments and return-aware release.
  All 33 demo checks passed. A disposable browser journey verified a 480 THB
  subtotal + 45 THB test fee, declined→successful retry under the same reference,
  stock commitment, pre-shipment refund/release, and preservation of the saved
  45 THB quote after changing the rule to 60 THB. No payment or message was sent.
  Evidence: `output/qa/mock-checkout-browser-2026-10-05.json`.
- Fixed narrow enlarged-text overflow in navigation, product filters, cards,
  search, forms, purchase controls, account and CMS. Mobile menu Escape returns
  focus to its trigger. Its scrollable height follows available viewport space;
  anchor and sticky offsets follow the measured header height.
- Checked 24 Thai/English route views at 320 CSS px with a simulated 32px rem
  baseline, plus populated checkout and expanded shipping settings. No document
  overflow remained. Also checked 48 ordinary route/width views at 320/1440px.
  This is a CSS text-baseline stress test, **not actual browser zoom or changed
  browser font preferences**. Evidence: `large-text-2026-10-05.json` and
  `final-responsive-2026-10-05.json` under `output/qa`.
- Root-scale browser samples matched the intended curve through 3840px
  (16/18/24/28/34px, with subpixel viewport rounding). The in-app viewport caps
  around 4096 CSS px, so requests for 4800/7680 were not actual 4800/7680 tests.
  Actual browser zoom, font preferences, OS motion preferences and hardware
  scaling remain manual checks documented in `LOCAL_QA.md`.
- Six shared foreground/background pairs calculated from global tokens ranged
  from 4.77:1 (muted on surface) to 17.76:1 (button text). This is not a claim
  that every custom colour, image overlay or focus state was contrast-certified.
- Measured local browser performance using opt-in PerformanceObserver diagnostics
  and a GET-only loopback proxy: 150ms/request, 200,000 bytes/sec shared for local
  resources. The first slider image now loads before neighbouring slides.
  Desktop English LCP samples: 2,988ms before and 2,592ms after; CLS 0.00187.
  Thai mobile sample: LCP 924ms, CLS 0.00685. Longest observed interaction 16ms,
  no observed long-task time in these samples. Fonts reported loaded.
  External fonts were cached/unthrottled and CPU was unthrottled. These are
  individual lab samples, not field Core Web Vitals, full INP or slow-phone
  guarantees. Raw `performance-slow-*-2026-10-05.json` reports are in `output/qa`.
- Added a repeatable release/CI gate and protected its disposable runner from
  inherited provider credentials. Missing remote CMS configuration now fails
  closed. Nine mocked platform groups passed. Release rehearsal passed 191
  checks, 38 localized routes and 115 isolated CMS/media/workflow HTTP checks.
  Full ESLint, TypeScript/production build, commerce validation, 15 CMS,
  13 image-policy, 8 publishing and 8 migration groups also passed.
- Safely merged unchanged supplied front/back photos, bilingual alternatives,
  references and sample limitations into the existing case-study draft at
  revision 18→19. Exact original-template comparison and API readback passed;
  published content, Trash, unrelated drafts and confirmed facts were unchanged.
  The article remains private and review-required pending genuine selection
  evidence. See `case-study-photo-merge-2026-10-05.json` under `output/qa`.
- Local audit controls are opt-in and disabled on the normal preview. The
  constrained proxy and disposable test servers were stopped. No deployment or
  actual provider connection was performed; production readiness is not claimed.
- Final visual review covered desktop search recovery and Thai mobile search.
  Clicking the suggested `honey` search produced six actual matches. The reviewed
  browser log contained no console errors. Screenshots:
  `output/qa/search-recovery-desktop-2026-10-05.png` and
  `output/qa/search-mobile-final-2026-10-05.png`. The normal production preview is
  running at `http://127.0.0.1:3100` without audit controls; viewport overrides were
  reset and the agent's QA tab closed. Rapid navigation during the route matrix
  aborted unfinished server streams, as in the preceding verification pass.

## Publishing, operations, and launch preparation — 5 October 2026

- Added authenticated article/product previews, reviewed selective publication,
  stable article identities and old-URL redirects, rich bilingual article
  sections, SEO fields, product galleries, retained revisions, and complete
  content/media backups. Publication and recovery were exercised over actual
  HTTP against disposable data, including uncertain saves and image references.
- Added confirmed business settings, product/article search, wholesale form
  details, the unified mock request inbox, order/tracking history, bounded mock
  notification retries, staff authentication and durable storage adapters.
  Provider transport tests use mocks; no external service was connected.
- TypeScript, full ESLint and the production build passed. Automated checks
  passed: commerce/API validation, 26 demo checks, 15 CMS checks, 13 browser-image
  policy checks, 8 blog-migration checks, 8 publishing/recovery groups, and 8
  platform groups. The final isolated HTTP run passed 33 CMS, 55 media and 27
  publishing/workflow checks (115 total). The localized smoke run passed 38
  routes, with nine publicly published articles per language.
- Browser QA checked 48 route/width combinations across 320, 768, 1440 and
  2560 CSS-pixel widths, without document overflow or duplicate main headings.
  The measured root size was 16px at the first three widths and 24px at 2560px.
  Evidence: `output/qa/workflows-responsive-2026-10-05.json`. Desktop search and
  mobile articles, wholesale forms, CMS editing, request details and publication
  dialogs were visually inspected. This was not an 8K, hardware, browser-zoom or
  field Core Web Vitals measurement.
- Browser interactions verified search filters and locale query preservation;
  a synthetic wholesale submission, assignment and notes; failed/successful
  payment simulation under the same reference; preparing/shipping updates and
  customer tracking; failed/successful notification delivery retries; gallery
  reordering in a purchase-disabled preview; publication review and individual
  article publication; revision comparison/restoration; Thai CMS navigation;
  and Escape dismissal with focus returned to the drawer button.
- Browser findings fixed during verification: the Publish button now opens
  review; history comparison receives its full authorized snapshot; narrow
  request details use full-width values; locale links expose query parameters;
  singular search results use correct copy; payment retry/refund outcomes stay
  consistent with progress while retaining their original submission identity;
  and launch indexing stays pending for demo/local environments. Session loading
  also keeps the loading view until saved content is ready.
- Created `eshan-selection-notes` as a bilingual, review-required CMS draft
  (revision 18). Verified that existing draft content, published content and
  Trash were preserved. Real selection evidence and approved business facts
  remain owner inputs; no factual claims were invented or auto-published.
- Test server files were disposable; synthetic browser requests were moved to
  their own Trash and the test bag was cleared. Existing browser records were
  retained. Public preview remains at `http://127.0.0.1:3100`.
- Screenshot: `output/qa/search-desktop-2026-10-05.png`. No browser console errors
  were observed in the reviewed flows. Fast navigation can abort server response
  streams; this is not a claim that all possible runtime failures are excluded.
- Production deployment, real database/media round trips, email delivery,
  payment callbacks, shipping services, actual inventory and hosting-scale
  backup recovery remain unverified and disabled. See `PRODUCTION_SETUP.md` for
  configuration, staging rehearsal and release requirements.

## Blog rebuild — 4 October 2026

- Replaced the public journal routes with `/blog` and `/en/blog`, including
  article pages. Navigation now reads บทความ / Blog. Old journal index/article
  URLs permanently redirect with locale, query strings, and trailing slashes
  handled. Stable internal CMS keys remain compatible with saved content.
- Added six substantive bilingual selection guides and expanded three original
  honey articles: nine articles, four categories, and 51 sections per language.
  The index has a featured guide, category/search controls, selection principles,
  and practical FAQs. Articles have readable prose, contents links, related
  articles, organization attribution, and the shared store footer.
- Metadata, canonical/hreflang links, article Open Graph images, sitemap entries,
  Blog/BlogPosting and BreadcrumbList schemas match the published routes.
  No dates or business credentials were invented. Demo preview indexing stays
  disabled by the existing launch configuration.
- Applied the reviewed local content migration at revision 16 → 17. It updated
  only unchanged original articles and added six new guides to the independent
  draft/published snapshots. A private exact backup and completion receipt were
  created. A second dry-run reports complete with no changes. Migration tests
  cover custom edits, Trash, statuses, stale plans, interrupted outcomes, locks,
  and permanent idempotence.
- Public client data now excludes article bodies, media records, disabled
  slides, and unpublished products. Authenticated CMS editing retains its full
  state. Unit and live HTTP tests verify draft/archived article privacy and 404s.
- Production build, TypeScript, ESLint, mocked commerce, 15 CMS test groups,
  eight migration checks, 33 live CMS checks, 55 live media checks, and the
  38-route localized smoke test passed. Live mutation checks used disposable
  CMS storage, separate from the user's content.
- Browser checks verified combined category/search results, empty/reset states,
  focus returning to search after clearing, keyboard FAQ and contents controls,
  section anchors, related links, and equivalent locale switching with hashes.
  Desktop/mobile visuals were reviewed in both languages. The final blog tab
  reported no console errors or warnings.
- Geometry checks covered home, catalog, honey, contact, blog, and a full article
  in both languages at 320, 768, 1441, and 2560 CSS pixels (48 combinations),
  with one h1, no horizontal document overflow, and no broken completed images.
  Further blog/article checks passed at 1040, 3840, and 4097 CSS pixels. The
  browser caps the requested 7680px viewport at approximately 4096px, so an
  actual 8K viewport was not visually verified. Temporary viewport overrides
  were reset after QA.
- Evidence: `output/qa/blog-th-desktop.png`,
  `output/qa/blog-article-th-mobile.png`, and
  `output/qa/blog-responsive-checks.json`. Final local preview:
  `http://127.0.0.1:3100/blog`. No deployment or outside service was added.

## CMS navigation polish — 4 October 2026

- Drawer header and footer no longer shrink in short windows. The menu owns its vertical scrolling, with stable scrollbar space, clearer labels, an inset keyboard focus outline and a compact footer. The desktop close-button hover now keeps a dark background and visible icon.
- Added a 280 ms entrance and 200 ms exit using transform and backdrop opacity. Timing is shared in `globals.css`. The native dialog remains modal until closing finishes, supports repeated cycles, restores focus without scrolling, and cancels pending dismissal if reopened. Reduced-motion handling is implemented in CSS and the dialog lifecycle; an OS preference change was not performed during QA.
- Browser geometry passed at 320 × 568, 391 × 844, 768 × 600, 1441 × 900 and 2560 × 1356 CSS pixels. Header/footer remained fixed within the drawer, the outer dialog did not scroll, and the page had no horizontal overflow. Menu scrolling reached all system entries on the 320 px layout.
- Checked Thai and English layouts, Escape, backdrop dismissal, three repeated open/close cycles, body-style cleanup, navigation heading focus, and cancelling the existing restore confirmation. On a 320 px page, the workspace measured 305 px both before and during opening; scrollbar compensation prevented a sideways jump. No CMS content was saved or published.
- TypeScript, ESLint, production build, mocked commerce checks and the 26-route localized smoke checks passed. Screenshots: `output/qa/cms-navigation-refined-desktop.png` and `output/qa/cms-navigation-refined-mobile.png`. The local preview was restarted with the final build.

## CMS drawer and Trash — 4 October 2026

- Replaced the persistent sidebar with one hamburger-operated left drawer at every layout width. Checked Escape, backdrop dismissal, focus return, navigation, and keeping the drawer open while resizing from narrow to wide.
- CMS products, slides, articles and uploaded images now use recoverable Trash. Browser-local store records retain their notification previews. Every entry has an exact 30-day window; restoration rejects identity conflicts and deadlines crossed during asynchronous validation. Expiry preserves images referenced by active content or recoverable Trash.
- TypeScript, ESLint, production build, mocked commerce checks, 21 demo checks and all 10 CMS test groups pass. Exact expiry boundaries, restore conflicts, uncertain saves and reference-safe image cleanup use deterministic isolated fixtures rather than waiting 30 days.
- The final production build passed 18 live CMS HTTP checks and 16 media HTTP checks using `npm run test:cms:live`. This launcher creates and removes its own disposable data directory and preview server. The user's original CMS snapshot remains revision 16, with its products, published content and media unchanged.
- Browser tests on a disposable localhost preview verified article deletion, cancellation and restoration, enquiry recovery with saved notes and both notification previews, authenticated Trash image thumbnails, search, category filters and language switching. No document overflow or broken completed images at actual widths 320, 391, 768, 1441 and 2560 CSS pixels. The drawer and Trash were visually inspected on desktop and mobile.
- The restarted main preview at `http://127.0.0.1:3100` displays the new drawer and empty Trash correctly. All 26 localized public routes and the CMS entry routes passed smoke checks. Screenshots: `output/qa/cms-drawer-main.png`, `cms-drawer-mobile.png`, `cms-trash-desktop.png` and `cms-trash-mobile.png`.
- Cleanup runs while the local server/browser is active and resumes on the next access after shutdown. CMS data is still local server storage; mock store activity is still browser-local. No outside service or deployment was added.

## CMS workspace — 4 October 2026

- Added `/cms` and `/en/cms`, a collapsible left sidebar and narrow-layout drawer, bilingual content/media editors, draft publishing, backups, activity, and browser-local store operations.
- Final TypeScript, ESLint, production build, commerce checks and 13 demo test groups pass. Seven CMS test groups cover content validation, authorization, revision conflicts, persistence, uploads, retries, corruption preservation and production configuration gates.
- Live HTTP tests pass for 12 CMS access/save/publish/export/product-route checks. A separate live media workflow verified multipart upload, SHA identity, public image delivery, Next image optimization, publication, reference-protected deletion and cleanup. Original content was restored; no test media remains.
- Final browser geometry checks covered six English CMS modules and four Thai modules at 320 and 1440 CSS pixels (20 combinations), without document-level horizontal overflow. Overview geometry also passed at 768, 2560 and 3840 pixels. An attempted 7680-pixel viewport was limited by the browser tool to approximately 4097 pixels; it is not an 8K browser verification.
- Actual browser sign-in, product editing and draft save worked before an earlier native Publish confirmation blocked further browser clicks. Native confirmations were replaced with accessible CMS dialogs. Final drawer interaction, discard confirmation and file-selection interaction remain unverified in the browser because of that blocked prompt; API and rendered layout checks succeeded.
- Evidence: `output/qa/cms-layout-audit.json`, `output/qa/cms-desktop.png`, and `output/qa/cms-mobile.png`. Current production preview is bound to loopback at `http://127.0.0.1:3100`.
- External authentication, durable hosted storage, payment processing and email delivery remain unconfigured mock boundaries. No deployment was performed. CMS content/media are private local files; store operations use the current browser's demo storage. See `docs/CMS.md` for usage and backups.

## Local demo and complete storefront journey — 4 October 2026

- Implemented browser-local contact, wholesale, newsletter and checkout records,
  simulated successful/declined payments, notification previews and a staff
  dashboard with follow-up notes, statuses, filters and launch checklist.
  Demo storage uses `vetra-demo-v1`, separate from the bag and favourites.
- TypeScript, whole-project ESLint, mocked commerce tests, 11 pure demo checks,
  and the final production build passed. No new dependencies were installed.
- Production smoke passed for 26 localized public/private routes, both demo
  staff routes, 4 missing routes, 7 permanent redirects preserving queries,
  Product schema, metadata, robots and the 20-entry public sitemap.
- A separate demo-disabled build passed the same route checks: both staff URLs
  returned 404. Browser checks confirmed mock controls and the demo notice were
  absent. The final local preview restores demo mode at `http://127.0.0.1:3100`.
- Checked nine routes in both languages at requested widths 320, 390, 834,
  1440 and 2560 px (90 combinations). Then checked final cart, checkout and
  staff layouts in both languages at those widths plus 3840 px (36 checks).
  No document-level horizontal overflow was observed. The browser rounds
  some requests to 391/1441 CSS pixels. Root size was 24px at 2560 and 34px
  at 3840, preserving the requested scale.
- Browser journeys verified wholesale subject changes without losing other
  drafts; Thai/English contact and checkout saves; newsletter save; quantity
  totals; failed payment retaining inputs and bag; repeat-safe failed retry;
  a new successful payment attempt; dashboard filtering; saved notes/status
  after reload; checklist persistence; and expanded notification previews.
- Verified focus restoration after closing request details, removing the final
  cart item, and cancelling demo reset; successful checkout focuses its
  confirmation heading. Reset confirmation was opened and cancelled; existing
  demo records were not deleted. Temporary test bag selections were removed.
- Reviewed mobile and desktop supporting pages, dashboard and checkout.
  Summary stays sticky in a wide, tall layout and becomes static in a short
  viewport; its measured fit guard accounts for scaled text and content height.
  Captured browser logs showed no errors or warnings during the checked flows.
- Reduced unused font weights, added font preconnects, and improved search
  control hit areas. This is not a measured Lighthouse/Core Web Vitals score.
  Actual 8K rendering, OS scaling and browser zoom remain unverified; narrow
  reflow and large CSS layout spaces were checked.
- Evidence: `output/qa/demo-staff-desktop.jpg`,
  `output/qa/demo-staff-mobile.jpg`, `output/qa/demo-responsive-audit.json`,
  and `output/qa/demo-final-commerce-audit.json`.
- No real payment, delivered email, staff authentication, database connection,
  shipping service or deployment was enabled or tested. Stock, current batch,
  delivery charges, returns, wholesale terms and real business contacts still
  require confirmation. See [local demo and launch guide](LOCAL_DEMO_AND_LAUNCH.md).

## Earlier verification — September/October 2026

## Fluid visual system and keyed content — 1 October 2026

- Added shared type, spacing, color, field, and media tokens; page and section
  shells now use a full-width gutter instead of a container width cap. Prose,
  dialogs, and source images retain local bounds for readability and clarity.
- Navigation, homepage collections, hero slides, and journal links now use
  stable keyed records. The shared product registry owns product facts and
  rejects duplicate IDs or slugs. A product is listed only when its distinct
  detail page and order flow are ready.
- TypeScript, ESLint, mocked commerce checks, and the 26-route localized smoke
  test passed against the active development server.
- Browser checks passed for six Thai/English routes at eight actual CSS widths:
  320, 391, 768, 1024, 1441, 2560, 3840, and 4097 px. All 48 combinations
  had localized language metadata, a main heading, no broken completed images,
  and no document-level horizontal overflow. The browser capped an attempted 7680 px
  viewport at 4097 px; actual 8K rendering remains unverified.
- Visually reviewed the homepage, catalog, product detail, and empty checkout
  at mobile/desktop sizes, plus the full-width 4K shell and catalog sizing.
  Captures: `output/qa/visual-system-th-mobile.png`,
  `output/qa/visual-system-th-desktop.png`, and 4K left/right viewport crops.
  Detailed results: `output/qa/visual-system-responsive-audit.json`. The
  browser console showed no errors. A production build was not run while the
  active development server was using this checkout.

## Midnight blue and champagne gold refinement — 1 October 2026

- Deepened the shared blue to `#07162f` with a `#030c1f` dark shade, including matching overlays, controls, shadows, and the favicon. The light backgrounds and existing media remain in place.
- Reworked gold into a readable bronze `#785422` for text on warm surfaces and a brighter champagne `#e6c67f` for dark sections. The primary light button now has a restrained gold gradient. Bronze text has a 5.59:1 contrast ratio on the shared warm surface.
- TypeScript, ESLint, mocked commerce checks, and the 26-route localized smoke test passed against `http://localhost:3000`.
- Visually reviewed the Thai homepage at desktop and 390 px mobile widths, plus the English product page and footer at 390 px. No document-level horizontal overflow or browser console error was observed in those views.
- Captures: `output/qa/midnight-gold-th-desktop.png`, `output/qa/midnight-gold-th-mobile.png`, and `output/qa/midnight-gold-en-product-footer-mobile.png`. The preview query `?theme=midnight-gold` bypasses the in-app browser's cached root redirect.

## Deeper blue refinement — 1 October 2026

- Deepened the shared navy from `#162c46` to `#0b213c` and the dark navy from `#0e1e32` to `#06172c`. Matched hard-coded editorial overlays, slider controls, shadows, and the favicon to the new palette. Light gold and warm brown surfaces remain as before.
- TypeScript, ESLint, commerce checks, and the 26-route localized smoke test passed against the active development server at `http://localhost:3000`.
- Reviewed Thai desktop and mobile layouts and the English mobile product page. The Thai homepage has no document-level horizontal overflow at 390 px, the slider advances to its second image, and the production media remains visible.
- Review captures: `output/qa/deep-blue-th-desktop.png` and `output/qa/deep-blue-th-mobile.png`. The open preview uses `http://localhost:3000/?theme=deepnavy` to avoid an older browser-cached redirect for the root URL.
- The development console reported an LCP image advisory for the first hero slide even though its `Image` uses `loading="eager"`; no runtime error was observed. A production build was not run while another Next development server was using the checkout.

## Default-language URLs

- Thai pages serve at `/`, `/products`, and the matching unprefixed paths; English continues at `/en`.
- Existing `/th` URLs return permanent redirects to the equivalent Thai paths, preserving query strings.
- Production smoke checks passed for 26 localized routes, canonicals, language alternates, active navigation, missing routes, redirects, and the sitemap. Robots exclusions use the new paths.
- Browser checks confirmed navigation from the Thai homepage to `/products`, switching between `/products?category=coffee` and `/en/products?category=coffee`, and a 390 px layout without page overflow.
- The local in-app browser retained an earlier permanent `/` → `/th` redirect in its cache. A fresh query URL loaded the new homepage; direct HTTP checks and the production smoke test confirmed `/` now responds with Thai content.

## Modern luxury theme verification

- Applied shared deep navy, champagne gold, warm brown, and ivory tokens to the homepage, navigation, footer, commerce pages, editorial pages, forms, and status pages. Existing product photography and localized copy are retained.
- Redesigned the homepage hero as a navy introduction beside a warm product display. Refined spacing, typography, image frames, and touch controls throughout.
- Final production build passed with 33 static entries. TypeScript, ESLint, and the existing commerce test suite passed; commerce database calls are mocked.
- Production smoke checks passed for 26 localized routes, canonicals, hreflang, headings, missing routes, Thai redirects, and sitemap.
- Browser layout checks passed for 11 representative Thai/English routes at 320, 390, 768, 1024, and 1440 px (55 combinations), with no document-level horizontal overflow. Evidence: `output/qa/luxury-responsive-audit.json`.
- Visually reviewed desktop/mobile homepage, product details, cart, contact, story, and footer. Verified mobile menu, search, product gallery, product tabs, favourites, wholesale subject selection, and language switching. Cart totals were correct at two jars (฿960) and three jars (฿1,440), including after switching to Thai. Temporary browser test selections were removed afterward.
- Small gold text uses `#84622e` and muted text uses `#716356`; both exceed 4.5:1 against the shared warm surface. Reduced-motion support remains active.
- No browser errors or warnings were observed in the production preview. The existing checkout availability gate remains visible; this theme work does not enable payments or live order processing.
- Final preview: `http://localhost:3001`. Start with `node node_modules/next/dist/bin/next start --hostname localhost --port 3001`. Match the localhost startup host to Next's normalized rewrite origin to avoid a local redirect loop. Restart the preview after a new build.
- Screenshots: `output/qa/luxury-home-en-desktop.png`, `output/qa/luxury-home-th-desktop.png`, `output/qa/luxury-home-th-mobile.png`, and `output/qa/luxury-product-desktop.png`.

## Passed

- Next.js production build: 33 generated static entries; dynamic catalog/contact/API routes compile successfully.
- TypeScript: `node node_modules/typescript/bin/tsc --noEmit`.
- ESLint: `node node_modules/eslint/bin/eslint.js .`.
- `node scripts/smoke.mjs`: 26 Thai/English pages, one main landmark and page heading, document language, self-referencing canonicals, alternate languages, four missing-route responses, legacy `/th` redirects, and 20 public sitemap URLs.
- `node scripts/check-commerce.mjs`: stored-cart schema validation, quantity bounds, bilingual baht formatting, disabled checkout gate, input/origin/body validation, server-calculated prices, idempotent retries, conflicting submissions, uncertain saves, concurrent upserts, database failures, and rate limits. **Database calls in this test are mocked.**
- Contact/newsletter API checks: malformed JSON, oversized body, invalid email, invalid consent, honeypot, cross-origin requests, and unavailable database. Valid requests with no MongoDB configuration return 503 without false success.
- Cloudinary default dry-run: seven local images validated, zero provider requests/uploads. Uploader retry/collision/idempotency paths were checked with mocked responses.

## Browser verification

- Inspected both homepage languages and responsive layouts.
- No document overflow at 320, 390, 768, 1024, and 1440 px on sampled key pages. Product-tab and help-topic rows intentionally scroll horizontally inside their containers.
- Honey quantity 2 produced ฿960; increasing to 3 produced ฿1,440. Quantity persisted across page reloads and Thai/English navigation.
- Mobile menu opens/closes and exposes favourites. Saving the honey adds it to the guest favourites page.
- Search opens a named dialog with focus on its field, submits to the localized catalog, and returns the matching product.
- Language switching retains the equivalent route and query string, including `category=coffee`.
- Wholesale link preselects the contact subject.
- Tested a synthetic contact form against the unconfigured database: readable error appears, submit control recovers, and input remains intact.
- Production homepage/browser route checks showed no console errors or warnings. Expected failed contact requests are represented by the form's error state.
- Screenshots saved in `output/qa/home-th-desktop.png` and `output/qa/home-th-mobile.png`.

## Not verified / not enabled

No real MongoDB connection or Cloudinary account was configured. No real payment, shipping service, email delivery, inventory workflow, customer sign-in, or deployment was performed. Checkout is clearly gated. The optional order-enquiry path never collects payment. Actual sale stock and lot/expiry dates must be verified separately from the supplied sample photographs.

The current local production preview is served on `http://localhost:3001`; rebuilding requires restarting `next start` to serve the latest build.

## Homepage slider — 1 October 2026

- Three new generated 3:1 WebP banners replaced `hero-honey.webp`. The old local file and all source references were removed. The media dry-run validates nine bundled images with no network requests.
- The banner remains 3:1 on desktop, crops inward at intermediate widths, and reaches 16:9 on phones. Visually checked all three slides at desktop and phone widths, including the 320 px layout, with no document overflow.
- Verified Thai and English control labels, previous/next buttons, direct slide selection, and ArrowRight keyboard navigation. The product gallery's replacement lifestyle image also changed successfully in a fresh browser tab.
- ESLint, TypeScript, commerce tests, production build, and the 26-route production smoke test passed. The updated local preview is `http://127.0.0.1:3100/`.
- The slides were revised using the supplied ESHAN front product photograph and its prepared cutout as references, replacing the generic jars. The original front and back photographs remain on the product page for accurate packaging details. No Cloudinary upload or remote asset deletion was performed.

## Dedicated coffee blossom honey page — 2 October 2026

- Added static `/coffee-blossom-honey` and `/en/coffee-blossom-honey` experiences with the same VETRA navigation as every store page, a product-specific ESHAN footer, botanical product presentation, origin story, serving ideas, bag controls, original labels, and FAQ disclosures. Existing product details remain available.
- Homepage honey links and catalog cards lead to the new experience. Page-specific metadata, canonical/hreflang links, catalog-backed Product structured data, and both sitemap entries are included.
- TypeScript, ESLint, commerce checks (mocked database), and the production build passed. Both new routes are statically generated; the build generates 35 static entries.
- Live smoke checks against the existing development server at `http://localhost:3000` passed for 28 localized pages, shared store navigation, single landmarks, Product schema, discovery links, legacy Thai redirects, and 22 sitemap URLs.
- Browser geometry checks covered home, catalog, existing product details, the new experience, and contact in both languages at 390, 834, 1440, and 2560 px: 40 combinations, each with one main landmark/heading and no horizontal document overflow. Results: `output/qa/honey-layout-checks.json`.
- Visually inspected the new page on phone, tablet, desktop, and wide screens. Verified language switching preserves query/hash, original-label images load, FAQ disclosure opens, favourites persist, quantity 2 adds two jars, repeated additions update status, and the 20-jar limit disables further additions. The cart showed 20 jars at ฿9,600 after reloading; test bag/favourite selections were restored to their initial empty state.
- The honey page's product panel uses the shared header-height token for its sticky offset. Repeated-add live announcements include the current bag count. Hero loading is eager/high-priority, and the layout includes the framework's smooth-scroll marker.
- After switching to the shared header, browser checks on both honey routes at 390, 834, 1440, and 2560 px found one header/main, the shared search dialog, and no horizontal overflow. The mobile menu and equivalent English page switch were verified in-browser.
- Preview evidence: `output/qa/honey-th-desktop.png` and `output/qa/honey-en-mobile.png`. No deployment or real payment/order submission was performed; existing checkout configuration requirements remain unchanged.

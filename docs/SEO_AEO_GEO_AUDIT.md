# VETRA STORE: SEO, AEO and GEO audit

Audit date: **7 October 2026**, Asia/Bangkok. Scope: the current repository, published content inspected locally, and official search-engine guidance. This document records the implementation and the work needed before marketing expands. No production URL or search-account access was established in this run.

SEO concerns search discovery, indexing and useful search results. AEO concerns clear answers to customer questions. GEO here means visibility and accurate citation in generative search answers; geographic marketing follows the separate country and city plan below.

Good implementation can improve eligibility, clarity and usability. It cannot guarantee indexing, a rich result, rankings, AI citations, traffic or sales. The goal is a factual, testable website with measurable marketing results.

## 1. Required language and market plan

| Page family | Priority | Market | Scope |
| --- | --- | --- | --- |
| Arabic `/ar/...` | 1 | United Arab Emirates | **Dubai only**; no campaign expansion to the rest of the UAE |
| Arabic `/ar/...` | 2 | Saudi Arabia | Country targeting |
| Arabic `/ar/...` | 3 | Kuwait | Country targeting |
| Arabic `/ar/...` | 4 | Qatar | Country targeting |
| Arabic `/ar/...` | 5 | Malaysia | Arabic-language audience hypothesis to validate |
| Thai `/th/...` | 1 | Thailand | **Thailand only** |
| English `/...` | 1 | Singapore | Country targeting |
| English `/...` | 2 | Canada | Country targeting |
| English `/...` | 3 | Australia | Country targeting |
| English `/...` | 4 | United Kingdom | Country targeting |
| English `/...` | 5 | Ireland | Country targeting |
| English `/...` | 6 | United States | Country targeting |

English is served at `/`; `/en/...` is a permanent legacy redirect. Language display order remains English, Arabic, Thai. Arabic pages use Modern Standard Arabic and RTL; Thai pages use Thai content and fonts.

These are **marketing priorities**, not confirmed shipping destinations or physical business locations. An accessible Arabic page can still be discovered outside the listed markets. Organic search cannot be restricted to a city through a metadata setting.

Keep generic `en`, `ar`, `th` hreflang and the appropriate equivalent URLs. Hreflang describes language/region variants; it does not encode country priority, Dubai-only targeting, or a marketing budget. Add country variants only if real, maintainable regional content or commercial terms justify distinct URLs. Never create `ar-Dubai`, city hreflang values or many cloned country pages. [Google localized-version guidance](https://developers.google.com/search/docs/specialty/international/localized-versions).

Control paid geography in campaign settings. Use Dubai as the Arabic UAE location target and Thailand as the Thai location target. Review the platform's location-presence option and location reports, because interest-based targeting can include people elsewhere. Keep countries separate when budgets and measurement need to follow the priority order. [Google Ads location options](https://support.google.com/google-ads/answer/1722038).

Visible language, relevant content and genuine regional evidence matter. Do not add fake Dubai/Saudi offices, local phone numbers, addresses, delivery promises, `areaServed` coverage or local business profiles. Google ignores geographic meta tags such as `geo.position`; maintain crawlable language URLs and manual language switching. [Google multilingual and regional guidance](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites).

## 2. Findings and implementation status

“Implemented” below means the current source has been changed. It does not establish that those changes have reached a production domain. Record the actual build, HTTP and browser checks in section 9.

| Finding | Change implemented in this audit | Main evidence |
| --- | --- | --- |
| Incorrect or unsafe site origin can spread into canonicals, schema and sitemap | Normalize one HTTP(S) origin; reject paths, credentials, queries and fragments; public indexing requires a non-local HTTPS origin | `src/lib/site-origin.ts`, `src/lib/metadata.ts` |
| Business markup lacked a shared identity and supplied logo | Locale layout emits shared Organization/WebSite identities; Home/About/articles/products connect to those IDs and use only existing public business facts | `src/lib/structured-data.ts`, locale layout and public schema components |
| Page metadata can override a staging/demo indexing restriction | Shared page metadata carries the indexing guard, and filtered pages preserve it | `src/lib/metadata.ts`, catalog/blog/search metadata |
| Search/filter variants create duplicate or thin index candidates | Catalog search/category variants receive noindex while keeping the main collection canonical; existing internal search and filtered blog remain noindex | `src/app/[locale]/products/page.tsx` |
| Blocking private page paths also prevents crawlers reading their noindex | Public robots rules allow crawl access to noindex pages; authentication protects administrative data; private APIs stay excluded | `src/app/robots.ts`, existing CMS authentication/headers |
| Blanket `/api/` can hide published CMS images | Public image originals are crawlable; draft-only/unreferenced originals and staging images carry noindex. Optimized CMS variants also carry noindex because the optimizer drops upstream robots headers | `src/app/robots.ts`, CMS-media route/server, `next.config.ts` |
| Demo/enquiry/USD reference prices were described as purchasable offers | Shared Product schema emits an Offer only for eligible Thai THB payment with known stock; enquiry/demo/international reference prices do not advertise a live offer | `src/lib/structured-data.ts`, product routes |
| Honey schema contained a hardcoded label photograph | Product images now follow the product's current primary/gallery data | `src/lib/structured-data.ts` |
| Product identity and breadcrumb connections were incomplete | Stable Product/WebPage/BreadcrumbList IDs and product breadcrumb markup have been added | Product routes, `src/components/honey/HoneyExperience.tsx` |
| Social cards could retain a generic fallback after a page image changed | Shared metadata includes Twitter cards and a helper keeps route-specific Open Graph/Twitter images aligned | `src/lib/metadata.ts`, product/blog metadata |
| English/Arabic international enquiries used Thai province assumptions | Destination fields and copy distinguish country/city from Thai delivery fields; the enquiry path remains separate from Thai payment eligibility | Checkout, enquiry validation, localized copy and tests |
| Homepage stock/certification copy was stronger than the evidence | Stock wording now invites quantity enquiries; the halal mark is attributed to a supplied sample label with current certification to be verified | `src/content/site.ts` |
| Product answers were limited to storage and ordering | Six localized visible FAQs explain floral source, label facts, storage, current-batch/certification verification, international enquiry and ordering | `src/content/honey.ts` |
| USD displays could be confused with other dollar currencies | English USD displays include the ISO currency code; prices and THB charge rules remain unchanged | `src/lib/catalog.ts` |
| Paginated hreflang could point to unavailable translated page numbers | Alternatives omit languages whose actual published listing has fewer pages | Blog listing metadata, `scripts/check-seo.mjs` |
| Homepage carousel had no persistent rotation control | Localized Pause/Play, pause on any focus/manual selection, explicit restart and reduced-motion suppression | `HeroSlider.tsx`, `HeroSlider.module.css` |
| Performance sampler used a legacy English URL and omitted Arabic/Thai | Canonical home/honey routes are sampled in all three languages at phone and desktop widths | `scripts/check-storefront-performance.mjs` |

Existing strengths include page-specific localized titles/descriptions, self-referencing canonicals, language alternatives, a publication-aware sitemap, permanent legacy redirects, missing-route handling, private-route noindex, server-rendered story/article content, crawlable pagination and links, and relevant structured data.

The local published snapshot contains one product and nine articles. Current translations are complete after the application's supported in-memory seed upgrade; the audit did not modify that snapshot. The local environment is a demo with a loopback canonical origin and correctly blocks indexing.

Saved CMS image originals were already anonymously readable. A robots directive does not make them private. Optimized copies can remain cached for at least four hours under Next's optimizer; their noindex is independent of that cached content. Sensitive unpublished media needs an authenticated preview workflow if that privacy requirement is introduced.

Client components also render initial HTML through Next.js. A `use client` declaration is not evidence that product/catalog content is inaccessible to crawlers. Verify the actual response HTML as well as the hydrated browser.

## 3. Owner facts needed for trustworthy marketing

| Priority | Missing or uncertain information | Required owner action |
| --- | --- | --- |
| Before public campaigns | Published contact email, phone and localized address are currently blank | Supply real public details and confirm who handles enquiries |
| Before a purchase claim | Current stock quantity and dispatch batch are unknown | Confirm physical stock, batch, current best-before details and order availability |
| Before using label photographs as sales evidence | The supplied back-label sample shows an expiry of **3 October 2026**, already past on this audit date | Photograph the current sellable batch; explain sample photographs accurately until replaced |
| Before international conversion campaigns | Countries/cities served, charges, times, duties and import responsibility are unconfirmed | Confirm destination-specific terms; enquiries must not imply delivery acceptance |
| Before Thai sales marketing | Free shipping within Thailand is an existing supplied fact; dispatch timing and operational conditions remain incomplete | Preserve confirmed free shipping and publish accurate dispatch/operational terms |
| Before wholesale promises | MOQ, pack/carton quantities, pricing, lead times and fulfilment terms are unconfirmed | Approve exact business terms and translate them consistently |
| Before certification/quality claims | Selection evidence, supplier documentation, tests or certifications are not established by the code | Supply evidence for each claim; do not infer organic, halal, lab-tested or medical benefits |
| Before authoritative editorial promotion | Real author/reviewer information, publication/update dates and external references are missing from existing articles | Assign real responsibility, record genuine dates and add relevant primary references |
| Before business-profile/schema expansion | Legal/trading identity, registration details and verified social profiles need owner confirmation | Publish only real identifiers and links for this business |
| Before live money | Payment/inventory launch gates remain separate requirements | Complete the existing payment, stock reservation and operational checks in `docs/PAYMENTS.md` |

The sample photograph date is not proof that current stock is expired; it is also not evidence of a fresh batch. Current dispatch facts must come from the owner and the actual merchandise.

Organization markup should use the supplied logo/store name and genuine public details. Omit absent facts. Use a consistent Organization identity across publisher/seller references, and add verified `sameAs`, legal identity or contact details when supplied. An Organization schema does not require inventing a LocalBusiness location. [Google Organization documentation](https://developers.google.com/search/docs/appearance/structured-data/organization).

Product markup must match what customers can see and actually order. Do not invent GTINs, SKUs, reviews, ratings, stock, delivery or refund policies. Unsupported Offers are omitted; the current products may therefore lack product rich-result eligibility until a real supported offer exists. [Google Product documentation](https://developers.google.com/search/docs/appearance/structured-data/product).

## 4. AEO and GEO content priorities

Useful answers should be easy to find in ordinary page text. Google says its AI search features use established SEO practices, without a special AI schema or required AI text file. Keep structured data consistent with visible content. [Google AI search guidance](https://developers.google.com/search/docs/appearance/ai-features).

Prioritize these topics before producing more general lifestyle articles:

1. **What the product is:** exact ESHAN identity, coffee blossom honey, pack size, ingredients as supported by the actual label, and the distinction between source facts and marketing description.
2. **How to use it:** practical serving suggestions with clear quantities/examples where verified; avoid unsupported health promises.
3. **Label and batch interpretation:** genuine current photos, ingredient/weight transcription, storage instructions, lot and best-before explanation, and what can change between batches.
4. **Buying from VETRA:** stock-confirmation process, THB charge currency, approximate international display prices, payment availability and the difference between an enquiry and a confirmed order.
5. **International enquiries:** the destination details needed, what the team can confirm, and which fees/requirements remain unknown until quoted.
6. **Wholesale enquiries:** exact product/quantity requirements and owner-approved MOQ/packing/lead-time facts.
7. **VETRA's selection process:** original supplier/selection evidence, genuine photographs and real author/reviewer responsibility; keep an unsupported case study in draft.

Use a direct answer near each relevant heading, followed by supporting detail. Use short paragraphs, labeled lists, comparison tables when factual, descriptive internal links and real references. Native FAQ disclosures are already present in the response HTML; concise useful answers matter more than adding schema to every question.

Avoid repeatedly publishing the same generic advice under different slugs. Improve existing articles where they cover the same intent. Do not generate a separate near-identical page for every target country or pad headings with country lists.

For each article, record a real author/editor, genuine original publication date, meaningful update date and sources that directly support claims. Never fabricate credentials, review dates or supplier endorsements. Translate the full article and its references/labels, not just navigation.

Use localized informative image descriptions. Empty alt is suitable for decoration or redundant linked imagery; it is unsuitable when a product label or editorial image conveys information absent from surrounding text. Maintain readable mixed-script product names and numbers on Arabic pages.

Arabic Malaysia marketing remains a hypothesis about an Arabic-reading audience in Malaysia. Do not present Arabic content as Malay localization, or infer that this audience has confirmed demand. The English markets likewise share the present English version; regional purchase terms must be real before regional landing pages are introduced.

## 5. Initial query hypotheses and landing pages

These are **query themes to investigate**, not measured search volume, proven demand or validated advertising keywords. No country-by-country keyword-volume research, paid-search auction analysis or competitor account research has been completed.

| Language/markets | Hypothesis examples | Appropriate existing destination |
| --- | --- | --- |
| Arabic: Dubai first, then Saudi Arabia/Kuwait/Qatar/Malaysia | `عسل أزهار القهوة`, `عسل ESHAN`, `عسل تايلاندي`, coffee blossom honey serving questions | `/ar/coffee-blossom-honey` and relevant Arabic guides |
| Arabic wholesale audience in the same priority order | `عسل أزهار القهوة بالجملة`, ESHAN quantity/pack-size enquiries | Arabic product plus `/ar/contact` enquiry |
| Arabic Dubai enquiry | Dubai-specific honey/delivery enquiry intent, where actual search data supports it | Arabic product/contact; wording must remain an enquiry until coverage is confirmed |
| Thai: Thailand only | `น้ำผึ้งดอกกาแฟ`, `น้ำผึ้ง ESHAN 380 กรัม`, honey serving/storage questions | `/th/coffee-blossom-honey`, relevant Thai guides |
| Thai business audience | `น้ำผึ้งดอกกาแฟ ขายส่ง`, pack-size/quantity enquiry | Thai product/contact with approved wholesale facts |
| English: Singapore, Canada, Australia, UK, Ireland, US | `coffee blossom honey`, `ESHAN honey 380g`, `Thai coffee blossom honey`, serving/storage questions | `/coffee-blossom-honey` and relevant English guides |
| English business audience in the same priority order | `coffee blossom honey wholesale`, ESHAN quantity enquiries | English product/contact with accurate delivery qualification |

Before spending, review actual local search results and keyword tools by market/language. Distinguish informational, brand, retail and wholesale intent. Exclude unsupported claim themes rather than rewriting the website to promise them.

Coffee and instant-coffee cards are coming-soon previews. They are not ready products or marketing landing pages. Promote only products with complete detail pages and a genuine order/enquiry path. Create substantive category pages once a real assortment exists.

## 6. Technical acceptance and performance

| Area | Acceptance condition |
| --- | --- |
| Origin | One final HTTPS production origin in canonicals, alternatives, sitemap and schema; HTTP/alternate host redirects resolve consistently |
| Language alternatives | Reciprocal, absolute equivalents, self entry, correct x-default and omission of unavailable translations |
| Indexing | Public approved pages indexable; staging/demo/local environments blocked; search/filter/private pages receive readable noindex |
| Robots | Public HTML, CSS/JS and published images accessible; private APIs excluded; administrative access protected by authentication |
| Routes | Existing redirects preserve intended paths/queries; renamed pages resolve; missing products/articles return actual 404 status |
| Sitemap | Only current canonical published URLs; no private/search/legacy routes; truthful last-modification dates |
| Schema | Parseable JSON-LD with matching visible facts, consistent entity IDs and eligible offers; no invented reviews or coverage |
| Social | Page-specific image, title and description consistent across Open Graph and Twitter cards; real preview tested after deployment |
| Discovery | Every published product/article reachable from crawlable navigation/listing/related links; no reliance on search alone |
| Accessibility | One main/h1, meaningful headings/labels/alt, keyboard access, visible focus, RTL behavior, reduced motion and persistent carousel pause |
| Responsiveness | Phone/tablet/desktop/wide views remain usable in all three languages, including zoom and enlarged fonts |
| Reliability | Storage failure produces recoverable truthful UI; CMS mutations and publication do not break metadata or media references |

The storefront deliberately renders dynamically and probes the published source before using its cache. This protects current prices during storage outages. Measure time to first byte on the deployment before changing caching; do not substitute stale prices merely to improve a benchmark.

The self-hosted fonts avoid external font requests. Arabic body/heading files together are approximately 260 KB; measure first rendering and layout shifts before changing preload or fallback behavior. Image dimensions/aspect ratios reserve space, with responsive sizes and prioritized main images already in use.

The updated performance sampler covers canonical home/product pages for all three languages at 390/1440 CSS pixels. Its LCP, accumulated layout shifts and long-task totals are **local lab observations**. It does not establish field INP, all Core Web Vitals, real phone performance, deployed CDN behavior or target-country latency.

Measure the actual deployed site in the first-priority markets, then expand. Use repeated lab runs plus field data when enough traffic exists. Good Core Web Vitals targets are LCP at most 2.5 seconds, INP at most 200 milliseconds and CLS at most 0.1 at the 75th percentile; evaluate mobile and desktop separately. [Web Vitals guidance](https://web.dev/articles/vitals).

Large original label images should remain available as evidence, but inspect delivered optimized bytes and gallery enlargement behavior. Review Arabic font/layout behavior and slow-network product discovery. As the catalog grows, measure duplicated client product/copy payloads rather than assuming today's small dataset scales indefinitely.

## 7. Deployment and account verification still required

| Work | Where it must be verified | Status in this audit |
| --- | --- | --- |
| Final domain, SSL, preferred host and redirect chain | Production deployment | Owner/domain confirmation and deployed audit required |
| Correct robots/meta/header behavior | Actual CDN and production responses | Local code checks do not establish deployed headers |
| Bot access and challenges | Hosting/WAF logs plus live fetches | No live WAF/CDN verification |
| Google indexing/canonicals/hreflang | Search Console property and URL Inspection | No verified account inspection |
| Google rich results | Rich Results Test and Search Console | Eligibility/output requires deployed validation |
| Bing indexing and AI citation reporting | Bing Webmaster Tools | Property/account verification required |
| Real traffic/CWV/conversions | Analytics, CrUX/PSI, operational enquiry records | No field performance or conversion evidence |
| Current business/batch/delivery facts | Owner-approved CMS publication | Requires the factual inputs in section 3 |
| Training crawler preference | Owner decision plus production robots | Search access and training permission are independent decisions |
| Advertiser geography/language/budget | Actual campaign account before activation | No campaigns created or budgets changed |

Public robots access alone does not prove that Googlebot, Bingbot or OAI-SearchBot can pass a host challenge. Verify the actual responses and relevant verified crawler/IP behavior. OpenAI distinguishes **OAI-SearchBot** for search from **GPTBot** for potential model training, and these controls are independent. The current general public allowance is not a guarantee of an AI citation. [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots).

Google must be able to crawl a URL to see its noindex directive. Do not reintroduce robots disallow rules for public noindex pages as an indexing-removal mechanism. Staging still remains protected by its environment-wide indexing block; private content needs authentication. [Google noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

## 8. Practical marketing sequence and measurement

1. **Complete the factual foundation:** publish real business contact information, current product/batch photos, availability and approved enquiry/delivery/wholesale terms. Resolve the product/payment launch gates appropriate to the intended conversion.
2. **Verify the released implementation:** complete section 9, deploy only through the separately authorized release process, inspect the actual final host, and connect search/analytics properties.
3. **Strengthen the product and supporting answers:** improve the existing honey/label/serving/ordering guides in all three languages, with evidence, real dates and responsible authors.
4. **Start three separate language tracks:** Arabic Dubai, English Singapore and Thai Thailand. Keep landing-page language aligned with the requested track and use conversion goals appropriate to real operational readiness.
5. **Expand in the requested order:** Arabic Saudi Arabia → Kuwait → Qatar → Malaysia; English Canada → Australia → UK → Ireland → US. Use separate results and sufficient evidence before increasing a market's spend. No budget percentages or demand estimates are assumed here.
6. **Review results regularly:** assess actual qualified enquiries, operational acceptance and profitability alongside search/citation visibility; improve weak factual answers and broken journeys before adding more pages.

Define a qualified enquiry as a real request with identifiable product, quantity, destination and contact details that staff can assess. Record whether staff accepted the destination, quoted it, fulfilled it or rejected it. An enquiry, a bag click or an AI citation must not be counted as a paid order.

| Reporting view | Dimensions | Useful measures |
| --- | --- | --- |
| Google organic | Landing-page locale/path, country, query and device | Impressions, clicks, CTR, position and qualified enquiries |
| Dubai scope | Campaign location/city plus reported location and destination qualification | Dubai traffic/enquiries, out-of-scope spend, accepted destinations; UAE country totals alone are insufficient |
| Paid markets | Campaign, language, country/city, keyword theme and landing page | Cost, qualified enquiry rate/cost, quote acceptance and fulfilled revenue when available |
| AI referrals | Referrer/source, landing locale/path and privacy-appropriate campaign data | Referred sessions and qualified enquiries; missing referrers mean this is incomplete |
| Bing AI Performance | Cited URL, available intent/topic/query and time period | Citation activity and cited pages; treat citation share as observational, not traffic or rankings |
| Product operations | Locale, product, quantity and destination qualification | Response time, quote/fulfilment acceptance and reasons an enquiry could not proceed |
| Page experience | Route group, locale, device and available region | Field LCP/INP/CLS and error rates; separate from local lab results |

Search Console's Web search reporting includes traffic from Google's AI search features; do not label all of that traffic as independently measured AI traffic. Use the measurements the account actually provides. [Google AI reporting guidance](https://developers.google.com/search/docs/appearance/ai-features).

Bing introduced AI Performance reporting for citations across supported experiences and expanded the preview with intents, topics, citation share and time comparisons in June 2026. These reports do not measure every AI assistant or prove a conversion. Verify which features/data are present in the account. [Bing AI Performance](https://blogs.bing.com/webmaster/2026/2/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview/), [Bing June 2026 expansion](https://blogs.bing.com/search/2026/6/New-AI-Visibility-Insights-in-Bing-Webmaster-Tools-Intents-Topics-Citation-Share-Compare/).

Keep customer names, emails, phone numbers, addresses and messages out of general analytics events and URLs. Attribute qualified outcomes in a privacy-appropriate reporting workflow. Optional periodic reports or monitoring require a separately requested setup; this audit creates no recurring task.

## 9. Validation record for this implementation

These results were obtained on **7 October 2026** from the final local production build. The owned read-only preview was `http://127.0.0.1:3203`; the build's configured metadata origin remained the existing demo origin `http://127.0.0.1:3100`. Canonical consistency was checked explicitly against that configuration. Neither address establishes the future production domain.

| Check | Actual result/evidence from this run |
| --- | --- |
| TypeScript and lint | `npm.cmd run typecheck`, `npm.cmd run lint` and `git diff --check` passed |
| Commerce/enquiry regression | `npm.cmd test`, 12 form checks and 15 isolated operations checks passed; database calls mocked or disposable. The forms browser runner passed 24 journeys twice consecutively, including a Dubai enquiry with no postcode, recovery, focus and unchanged Thai requirements |
| Language and CMS publication checks | `node scripts/check-languages.mjs --current` passed 6 checks and verified current published translations without a storage write. CMS tests passed 15 groups, including media publication/reference regression and draft separation, using disposable files |
| Structured data/metadata/robots/media regression | `npm.cmd run test:seo` passed origin, crawl-rule, catalog filter, pagination, entity/social/schema and original media noindex tests. Isolated `--media-only --port=3204` runner passed 59 live media checks including successful optimized CMS response headers and bundled-image exclusion |
| Production build | `npm.cmd run build` passed after the source fixes, including TypeScript compilation |
| Localized raw-HTML HTTP crawl/smoke | SEO crawl passed **48 sitemap pages plus 18 query/private pages**: explicit canonical origin, reciprocal hreflang, headings, social parity, identity and noindex. Existing smoke passed **57 localized routes**, discovery/schema, missing routes and legacy redirects |
| English/Arabic/Thai focused carousel browser regression | `--carousel-only` passed pointer Pause, persistent focus pause, native Enter restart and reduced-motion behavior in all three languages; no uncaught browser errors |
| Representative responsive visual review | Accessibility script passed **81 responsive views**, 18 localized routes at actual 100/200/400% browser zoom, 36 route/width views with a real 32px font preference, Arabic local fonts, search focus and reduced motion. Fresh home, honey/breadcrumb and expanded FAQ screenshots reviewed at 390/1440px in en/ar/th; form screenshots also reviewed at 320/1440px |
| Local performance samples | **12 samples**, home+honey × en/ar/th × 390/1440px. Observed LCP **628–1,992 ms**, accumulated CLS **0.00011–0.00626**, no measured long tasks or overflow. Single samples per route/width, disabled HTTP cache, 150ms network latency, 400KB/s download, no CPU throttle; no field INP or deployed-region measurements |
| Launch configuration | `npm.cmd run check:launch` correctly reports PENDING for public HTTPS domain, demo disablement, production storage/media and staff configuration; indexing remains blocked. This expected demo result is a launch blocker, not a successful production-readiness check |
| Live domain/search accounts/field data | Not established by repository checks; complete section 7 separately |

Main reusable checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:languages`, `npm run test:seo`, `npm run build`, `npm run test:smoke` and the isolated storefront/release runners. For a runtime SEO crawl use `node scripts/check-seo.mjs <preview-origin> --expected-site-url=<configured-origin>`. The focused carousel journey is `node scripts/check-storefront-browser.mjs <loopback-origin> --isolated --carousel-only`; it belongs to the normal storefront suite as well. Media HTTP verification is `node scripts/check-cms-live.mjs --media-only --port=<unused-port>`.

Generated local evidence is under `output/qa/seo/` (crawl and fresh screenshots), `output/qa/storefront-polish/` (forms, accessibility and performance reports), and `output/qa/cms-media-server.log`. These are local generated artifacts. The owned previews and disposable browser/CMS data are stopped or cleaned after verification; the user's published CMS data was not changed.

Review the actual deployed product and representative article in Google's tools after the code is released. A successful local schema parse does not prove rich-result eligibility, and a successful smoke test does not prove indexing. Preserve the evidence and owner approvals needed to explain every visible commercial claim.

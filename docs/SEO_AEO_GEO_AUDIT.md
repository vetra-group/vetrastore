# VETRA STORE: SEO, AEO and GEO audit

Audit date: **7 October 2026**, Asia/Bangkok. Scope: the current repository, published content inspected locally, direct HTTP checks of the owner-confirmed production URL `https://vetrastore.asia/`, and official search-engine guidance. This document records the implementation and the work needed before marketing expands. Search-account access was not established.

SEO concerns search discovery, indexing and useful search results. AEO concerns clear answers to customer questions. GEO here means visibility and accurate citation in generative search answers; geographic marketing follows the separate country and city plan below.

**Store scope, confirmed 8 October 2026:** VETRA STORE is the retailer for a growing assortment of products and brands. ESHAN is one current product brand. The homepage, catalog, header, general help and retailer entities describe VETRA; individual product pages and campaigns describe the relevant product and brand. Adding or featuring a product must not replace the store's homepage identity.

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
| Search/filter variants create duplicate or thin index candidates | Catalog search/category variants receive noindex while keeping the main collection canonical; existing internal search and filtered blog remain noindex | `src/app/[locale]/products/(listing)/page.tsx` |
| Blocking private page paths also prevents crawlers reading their noindex | Public robots rules allow crawl access to noindex pages; authentication protects administrative data; private APIs stay excluded | `src/app/robots.ts`, existing CMS authentication/headers |
| Blanket `/api/` can hide published CMS images | Public image originals are crawlable; draft-only/unreferenced originals and staging images carry noindex. Optimized CMS variants also carry noindex because the optimizer drops upstream robots headers | `src/app/robots.ts`, CMS-media route/server, `next.config.ts` |
| Demo/enquiry/USD reference prices were described as purchasable offers | Shared Product schema emits an Offer only for eligible Thai THB payment with known stock; enquiry/demo/international reference prices do not advertise a live offer | `src/lib/structured-data.ts`, product routes |
| Honey schema contained a hardcoded label photograph | Product images now follow the product's current primary/gallery data | `src/lib/structured-data.ts` |
| Product identity and breadcrumb connections were incomplete | Stable Product/WebPage/BreadcrumbList IDs and product breadcrumb markup have been added | Product routes, `src/components/honey/HoneyExperience.tsx` |
| Social cards used generic or raw page photos without a consistent share format | Branded 1200 × 630 PNG cards render for every public English, Arabic and Thai route, using the supplied logo, localized text and relevant page imagery. OG/Twitter metadata share one URL; CMS article social-image overrides remain available | `src/app/og/[locale]/[...path]/route.tsx`, `src/lib/social-image.ts`, public page metadata |
| English/Arabic international enquiries used Thai province assumptions | Destination fields and copy distinguish country/city from Thai delivery fields; the enquiry path remains separate from Thai payment eligibility | Checkout, enquiry validation, localized copy and tests |
| Homepage stock/certification copy was stronger than the evidence | Stock wording now invites quantity enquiries; the halal mark is attributed to a supplied sample label with current certification to be verified | `src/content/site.ts` |
| Homepage SEO and social title inherited the first featured product, making the retailer appear to be ESHAN-only | Home metadata now uses the localized store copy independently of featured products. Home/catalog share cards use VETRA artwork, while individual product cards retain their own brands | Home route, `src/lib/metadata.ts`, OG route |
| Shared catalog/help copy assumed a first honey product | Evergreen product/brand search, care, origin and price guidance; general Help links to the whole catalog; existing CMS overrides remain editable | Shared commerce/pages copy, `Editorial.tsx` |
| Shop navigation was inactive on product detail pages | Shared desktop/mobile Shop state includes generic product descendants and the existing honey detail route | `src/components/Header.tsx` |
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

Start with a clear store answer: VETRA STORE selects products and brands for retail and wholesale enquiries. Explain its selection process using genuine evidence. Apply the following product-answer checklist separately to each real, published product; ESHAN honey is the current pilot, rather than the identity or limit of the store:

1. **What the product is:** exact product and brand identity, variant and pack size, ingredients or materials as supported by its label or documentation, and the distinction between supplied facts and marketing description. For ESHAN, this currently means coffee blossom honey and its documented jar details.
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

Keep store discovery queries such as `VETRA STORE` and localized retail/wholesale product selection separate from product-brand campaigns. The honey themes below are the current ESHAN pilot. As other brands/products are published, research their actual categories, customer questions and brand terms in the same language/market priority order, linking each campaign to its own complete product page. Do not list unconfirmed future brands or advertise unavailable merchandise.

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

### Live production finding: indexing is blocked

Direct HTTP checks on 7 October 2026 confirmed that `https://vetrastore.asia/`, `/ar`, `/th` and `/coffee-blossom-honey` return HTTP 200, but each inspected page has `noindex, nofollow`, a `http://localhost:3000` canonical, and localhost language alternates and social URLs. The live [robots.txt](https://vetrastore.asia/robots.txt) says `Disallow: /` and lists `http://localhost:3000/sitemap.xml`; the live [sitemap.xml](https://vetrastore.asia/sitemap.xml) likewise publishes localhost URLs. The full production crawl fails its first origin assertion (`http://localhost:3000` instead of `https://vetrastore.asia`). **Do not start SEO/AEO/GEO campaigns expecting search discovery until this is fixed and verified on the live deployment.**

The apex domain redirects HTTP to HTTPS. The legacy `/en?utm_source=seo-audit` route redirects permanently to `/?utm_source=seo-audit`. Both the apex and `www` HTTPS hosts currently return HTTP 200 for the homepage, without a preferred-host redirect. The logo and favicon return HTTP 200 and are referenced by the live HTML. No actual bot identity, Search Console property or regional field-performance data was tested.

The live output matches the source fallback when `NEXT_PUBLIC_SITE_URL` is absent, or an explicitly configured localhost value: `http://localhost:3000` activates `preventIndexing`. This is a **configuration inference**, not proof of the values in the private Vercel dashboard. Inspect Production environment variables before the next deployment. The source now rejects a Vercel production build unless `NEXT_PUBLIC_SITE_URL=https://vetrastore.asia` and demo mode is disabled. This guard is local until a separately authorized deployment. `SITE_NOINDEX=true` remains an intentional staging/prelaunch control and must be false or absent for the approved public indexing launch.

After setting the Production variables, redeploy: Vercel does not apply changed environment variables to previous deployments. Configure `www.vetrastore.asia` to redirect to the owner-confirmed apex host in Vercel Domains. Then rerun `node scripts/check-seo.mjs https://vetrastore.asia --expected-site-url=https://vetrastore.asia`, verify the robots file and representative page HTML, and inspect URLs in Google Search Console and Bing Webmaster Tools. [Vercel environment-variable guidance](https://vercel.com/docs/environment-variables/managing-environment-variables), [Vercel domain redirects](https://vercel.com/docs/domains/working-with-domains/deploying-and-redirecting).

| Work | Where it must be verified | Status in this audit |
| --- | --- | --- |
| Final domain, SSL, preferred host and redirect chain | Production deployment | `https://vetrastore.asia` confirmed; HTTPS works, but `www` also serves 200 and needs a redirect |
| Correct robots/meta/header behavior | Actual CDN and production responses | **Failed:** all-crawler disallow, noindex and localhost canonical/alternates/sitemap |
| Bot access and challenges | Hosting/WAF logs plus verified crawler fetches | Ordinary HTTP fetch succeeds; verified bot access remains untested |
| Google indexing/canonicals/hreflang | Search Console property and URL Inspection | No verified account inspection |
| Google rich results | Rich Results Test and Search Console | Eligibility/output requires deployed validation |
| Bing indexing and AI citation reporting | Bing Webmaster Tools | Property/account verification required |
| Real traffic/CWV/conversions | Analytics, CrUX/PSI, operational enquiry records | No field performance or conversion evidence |
| Current business/batch/delivery facts | Owner-approved CMS publication | Requires the factual inputs in section 3 |
| Training crawler preference | Owner decision plus production robots | Search access and training permission are independent decisions |
| Advertiser geography/language/budget | Actual campaign account before activation | No campaigns created or budgets changed |

Public robots access alone does not prove that Googlebot, Bingbot or OAI-SearchBot can pass a host challenge. Verify the actual responses and relevant verified crawler/IP behavior. OpenAI distinguishes **OAI-SearchBot** for search from **GPTBot** for potential model training, and these controls are independent. The planned public allowance in source is not a guarantee of an AI citation. [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots).

Google must be able to crawl a URL to see its noindex directive. Do not reintroduce robots disallow rules for public noindex pages as an indexing-removal mechanism. Staging still remains protected by its environment-wide indexing block; private content needs authentication. [Google noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

## 8. Practical marketing sequence and measurement

1. **Complete the factual foundation:** publish real business contact information, current product/batch photos, availability and approved enquiry/delivery/wholesale terms. Resolve the product/payment launch gates appropriate to the intended conversion.
2. **Verify the released implementation:** complete section 9, deploy only through the separately authorized release process, inspect the actual final host, and connect search/analytics properties.
3. **Strengthen each product and its supporting answers:** improve the current ESHAN guides and prepare evidence, complete translations and distinct product pages for each additional brand/product as it is published. Keep the store's retail/wholesale identity separate from individual campaign messages.
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

Local implementation results were obtained on **7 October 2026** from the local production build. The owned read-only preview was `http://127.0.0.1:3203`; the build's configured metadata origin remained the existing demo origin `http://127.0.0.1:3100`. Canonical consistency was checked explicitly against that configuration. The owner subsequently confirmed `https://vetrastore.asia/` for separate live checks.

| Check | Actual result/evidence from this run |
| --- | --- |
| TypeScript and lint | `npm.cmd run typecheck`, `npm.cmd run lint` and `git diff --check` passed |
| Commerce/enquiry regression | `npm.cmd test`, 12 form checks and 15 isolated operations checks passed; database calls mocked or disposable. The forms browser runner passed 24 journeys twice consecutively, including a Dubai enquiry with no postcode, recovery, focus and unchanged Thai requirements |
| Language and CMS publication checks | `node scripts/check-languages.mjs --current` passed 6 checks and verified current published translations without a storage write. CMS tests passed 15 groups, including media publication/reference regression and draft separation, using disposable files |
| Structured data/metadata/robots/media regression | `npm.cmd run test:seo` passed origin, production-build guard, crawl-rule, catalog filter, pagination, entity/social/schema and original media noindex tests. Isolated `--media-only --port=3204` runner passed 59 live media checks including successful optimized CMS response headers and bundled-image exclusion |
| Production build | `npm.cmd run build` passed after the source fixes, including TypeScript compilation |
| Localized raw-HTML HTTP crawl/smoke | SEO crawl passed **48 sitemap pages, their 48 rendered 1200 × 630 PNG social cards, plus 18 query/private pages**: explicit canonical origin, reciprocal hreflang, headings, social parity, identity and noindex. Existing smoke passed **57 localized routes**, discovery/schema, missing routes and legacy redirects |
| Social-card visual review | Six contact sheets cover all 48 cards. The English, Arabic and Thai layouts were inspected; long Arabic/Thai titles were adjusted to stay within the text panel, and packshot fit was aligned with the editorial cards. The generated files are under `output/qa/og/` |
| English/Arabic/Thai focused carousel browser regression | `--carousel-only` passed pointer Pause, persistent focus pause, native Enter restart and reduced-motion behavior in all three languages; no uncaught browser errors |
| Representative responsive visual review | Accessibility script passed **81 responsive views**, 18 localized routes at actual 100/200/400% browser zoom, 36 route/width views with a real 32px font preference, Arabic local fonts, search focus and reduced motion. Fresh home, honey/breadcrumb and expanded FAQ screenshots reviewed at 390/1440px in en/ar/th; form screenshots also reviewed at 320/1440px |
| Local performance samples | **12 samples**, home+honey × en/ar/th × 390/1440px. Observed LCP **628–1,992 ms**, accumulated CLS **0.00011–0.00626**, no measured long tasks or overflow. Single samples per route/width, disabled HTTP cache, 150ms network latency, 400KB/s download, no CPU throttle; no field INP or deployed-region measurements |
| Launch configuration | `npm.cmd run check:launch` correctly reports PENDING for public HTTPS domain, demo disablement, production storage/media and staff configuration; indexing remains blocked. This expected demo result is a launch blocker, not a successful production-readiness check |
| Live domain | Direct apex, `www`, `/ar`, `/th`, product, redirect, robots, sitemap and asset checks produced the section 7 findings. `node scripts/check-seo.mjs https://vetrastore.asia --expected-site-url=https://vetrastore.asia` currently **fails** because the sitemap origin is localhost |
| Search accounts and field data | No Search Console, Bing Webmaster Tools, ads, analytics or real-user performance access; complete section 7 after the release |

Main reusable checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:languages`, `npm run test:seo`, `npm run build`, `npm run test:smoke` and the isolated storefront/release runners. For a runtime SEO crawl use `node scripts/check-seo.mjs <preview-origin> --expected-site-url=<configured-origin>`. The focused carousel journey is `node scripts/check-storefront-browser.mjs <loopback-origin> --isolated --carousel-only`; it belongs to the normal storefront suite as well. Media HTTP verification is `node scripts/check-cms-live.mjs --media-only --port=<unused-port>`.

Generated local evidence is under `output/qa/seo/` (crawl and fresh screenshots), `output/qa/storefront-polish/` (forms, accessibility and performance reports), and `output/qa/cms-media-server.log`. These are local generated artifacts. The owned previews and disposable browser/CMS data are stopped or cleaned after verification; the user's published CMS data was not changed.

Review the actual deployed product and representative article in Google's tools after the code is released. A successful local schema parse does not prove rich-result eligibility, and a successful smoke test does not prove indexing. Preserve the evidence and owner approvals needed to explain every visible commercial claim.

## 10. Store identity recheck — 8 October 2026

The source homepage incorrectly selected its title and description from the first featured product. The generated homepage card repeated that choice. This is corrected to use the editable localized VETRA homepage copy, with retailer-first title formatting. Home/catalog share artwork is independent of a product brand. The visible home introduction and general Help/catalog copy now support the wider store assortment. ESHAN names, label facts, product metadata and Product.brand remain on the relevant product/article pages.

The shared logo and Organization/WebSite identities already belonged to VETRA. Product seller/publisher links use that retailer identity; each Product keeps its own brand. Shared Shop navigation now remains active on both the special honey page and generic product detail pages. The country/language marketing order in section 1 is unchanged.

Direct live HTTP reads on **8 October 2026, 01:00 Bangkok time** again found ESHAN homepage titles/descriptions at `/`, `/ar` and `/th`. All six inspected public pages returned `noindex, nofollow`, localhost canonicals and `http://localhost:3000/images/honey-product.png` social URLs. Robots still disallows all crawling and points to a localhost sitemap; the sitemap still publishes localhost URLs. The `www` HTTPS host still serves HTTP 200 without redirecting. Evidence is saved in `output/qa/store-identity/live-report.json`. These responses are from the current deployment, and do not establish that local fixes have been deployed. The origin/indexing configuration actions in section 7 still apply. Google considers homepage title, headings, `og:site_name` and WebSite markup when identifying a site; keep them consistent with VETRA's retailer identity. [Google site-name guidance](https://developers.google.com/search/docs/appearance/site-names).

The local recheck passed TypeScript, lint, commerce, language/CMS localization and SEO regression checks plus the production build. The isolated `node scripts/check-cms-live.mjs --identity-only --port=3310` runner checks 57 localized routes, 48 sitemap pages with their 48 rendered share cards, and 18 query/private pages. Browser checks cover home widths 390, 768, 1440 and 2560 in all three languages. A second featured brand is published through the real CMS API using disposable local data: retailer homepage metadata/share URLs remain unchanged, Help lists both products, the new Product keeps its own brand, and both product routes retain working desktop/mobile Shop navigation. Exact navigation destinations use `aria-current="page"`; product/article sections use `aria-current="location"`. No uncaught browser exceptions or horizontal overflow were observed. Storefront screenshots and store cards were visually reviewed; Arabic wrapping was corrected for both Arabic-first and Latin-brand-first titles. Reports and screenshots are under `output/qa/store-identity/`. No user CMS data or live deployment was changed.

The present product model accepts individual brand names, but the category taxonomy currently contains honey and coffee. Expand that taxonomy when actual additional categories are supplied; store branding and homepage SEO now remain stable independently of product count or featured brand.

# Languages & SEO / AEO / GEO
Default: en. Display order: en, ar, th.
Canonical routes: English at `/`, Arabic at `/ar`, Thai at `/th`.
Legacy `/en/...` routes redirect permanently to their unprefixed equivalents,
preserving query strings. Unprefixed pages now serve English by explicit owner
request; `/th/...` is no longer a redirect to the default language.
Centralize language settings; support new languages through configuration
and translations without rewriting components. Reordering must not change
URLs or the default language.

Fully localize content, UI, and metadata. Preserve the equivalent page
when switching languages.
Use polished Modern Standard Arabic and `dir="rtl"` for Arabic pages, with
appropriate local fonts, logical spacing and mixed-script isolation. Keep
product/brand identities and business facts unchanged. Arabic currency and
address formatting must not imply a new market or shipping coverage.
Preserve existing bilingual CMS drafts, publications, history, Trash and
backups when adding locale fields. Require review of missing translations;
do not present English content as an Arabic translation.

Use crawlable localized pages, semantic HTML, page-specific metadata,
self-referencing canonicals, hreflang, sitemap, and relevant structured
data matching visible content.

Keep VETRA STORE as the retailer identity in the homepage title, description,
share card, header and Organization/WebSite markup. Homepage and catalog SEO
must not automatically inherit a featured product's brand or description.
Each product keeps its own brand in its title, facts, images and Product markup.
Adding or featuring another product must not rename the store in search or shares.

Write useful, factual content with clear headings and direct answers.
Avoid keyword stuffing, invented claims, and ranking promises.

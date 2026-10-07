# Visual and content system

VETRA uses warm ivory surfaces, midnight blue anchors, restrained champagne
details, and product photography. Keep this hierarchy when adding pages; gold
is an accent rather than a general text or background color.

## Layout and type

- Build for available layout space rather than named device resolutions. At
  smaller and ordinary widths, keep the browser baseline (`1rem = 16px` at
  default settings). As the available CSS viewport becomes substantially
  wider, progressively increase the root `rem` value with a controlled upper
  bound. This lets typography, spacing, icons, controls, and other `rem`-based
  values grow together while respecting browser font and zoom preferences.
  Define the root scale and shared visual tokens in `src/app/globals.css`.
- Prefer `%`, `rem`, `fr`, `minmax()`, intrinsic sizing, `auto-fit`/`auto-fill`,
  and container queries alongside controlled root scaling. Use `max-width`
  where it improves readability or composition, avoiding restrictive page
  shells. As space grows, increase useful width, columns, spacing, and content
  density so large layouts remain balanced.
- Choose breakpoints where content needs a different arrangement. Make
  components respond to their available container space so they remain useful
  when reused. Account for browser zoom, operating-system scaling,
  accessibility settings, and high-DPI displays. Respond to available CSS
  layout space rather than physical pixel count.
- Keep type, spacing, icons, controls, radii, and interaction targets
  consistent with shared tokens. Bound their growth for usability and visual
  balance. Support narrow screens and very large future viewports without
  overflow, stretched media, long unreadable lines, oversized elements, or
  unnecessary empty space. Avoid adding resolution-specific CSS for each new
  display generation.
- Page and section shells are full width. Use the shared `.container` class or
  `--page-gutter` for responsive side spacing. Do not introduce a page-wide
  `max-width`.
- Keep prose readable with `--reading-measure` on the text block itself. This
  is separate from the full-width page shell.
- Use `--type-display`, `--type-section-title`, and `--type-card-title` for
  hierarchy. Use `--font-size-1` through `--font-size-9` only when a role token
  does not fit. Edit text sizes in `src/app/globals.css`; the token scale runs
  from 1rem to 2.6rem without `clamp()`. Root scaling changes their computed
  pixel sizes together while preserving this type hierarchy.
- Use `--space-1` through `--space-6` and `--section-space` for rhythm rather
  than adding a new unrelated spacing value for each section.
- The existing DM Sans, Noto Thai and Noto Arabic faces are self-hosted through
  `src/app/fonts.ts`; bundled subsets, OFL licenses and source hashes live in
  `src/app/fonts/`. Builds and visitors do not need Google Fonts requests.
  Keep Thai text at the shared Thai heading line height without Latin-style
  negative tracking.
- Use shared motion, shadow and status tokens. True-hover effects must stay
  inside the existing hover/fine-pointer query; keep touch feedback and visible
  keyboard focus. Respect reduced motion. Drawers use the shared `Modal`
  lifecycle for focus, Escape and scroll locking; short drawers should allow
  one natural vertical scroll instead of hiding their footer.

## Color, fields, and media

- Use `--ink-strong`, `--ink-soft`, and `--accent-ink` on light surfaces;
  `--gold-light` is for dark blue surfaces. Use the shared overlay tokens for
  translucent navy treatments instead of copying hexadecimal alpha values.
- Keep form control height, border, and focus treatment aligned through the
  `--field-*` tokens. Each component still owns its layout in a colocated CSS
  Module.
- Packshots use a quiet `--media-surface`, `--media-border`, and contained
  framing. Lifestyle images may crop to fill a section. Set a realistic
  responsive `sizes` value on every `next/image` image that uses `fill`.
- On ultra-wide screens, let section backgrounds span the viewport while
  keeping source images near a useful display size. Do not stretch a small
  source image across several thousand CSS pixels.

## Adding content

- Put shared product facts, localized names, card copy, and search terms in
  `src/lib/catalog.ts`. Add a product to `catalogProducts` only when its own
  detail page and order path are ready. Each product may keep a distinct detail
  layout, as required by `docs/PROJECT.md`.
- Keep navigation, homepage collection, hero slide, and journal destinations
  beside their stable keys in `src/content/site-structure.ts`. Add English,
  Arabic and Thai text under the matching keys in `src/content/site.ts`; do not pair
  copy with links or images by array index.
- Arabic uses Noto Sans Arabic and Noto Naskh Arabic, the global Arabic line-height
  tokens, logical spacing and RTL controls. Keep Latin brand marks, media and
  technical URL/number inputs readable without reversing their contents.
- Keep journal article slugs in `src/content/editorial.ts`. Homepage journal
  entries refer to those slugs so TypeScript can catch a missing article.

After content or layout changes, run typecheck, lint, commerce checks, and the
localized route smoke test. Review the home, catalog, product, and form pages
at phone, tablet, desktop, and ultra-wide sizes in all three languages.

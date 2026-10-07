# Media assets

Prepared 2026-09-30 and updated 2026-10-01 for the VETRA STORE storefront using the built-in image generation tool. No fallback API/CLI was used. User-supplied reference photography remains unchanged in `example product image/`.

## Asset provenance

| Public asset | Source and use | Dimensions |
| --- | --- | --- |
| `public/images/hero-eshan-1.webp` | AI-assisted scene using the supplied ESHAN front photograph as the product edit target and its prepared cutout as a supporting reference. Coffee blossoms and hills are illustrative, not a verified source location. | 2172 × 724 |
| `public/images/hero-eshan-2.webp` | AI-assisted coffee ritual using the supplied ESHAN front photograph as the product edit target and its prepared cutout as a supporting reference. | 2172 × 724 |
| `public/images/hero-eshan-3.webp` | AI-assisted still life using the supplied ESHAN front photograph as the product edit target and its prepared cutout as a supporting reference. | 2172 × 724 |
| `public/images/honey-product.png` | AI-assisted background removal and studio treatment of the supplied ESHAN front product photograph. Transparent PNG. | 1100 × 1000 |
| `public/images/nature-story.webp` | AI-generated atmospheric northern Thailand-inspired mountain landscape; not a photograph of a verified supplier, farm or location. | 1536 × 1024 |
| `public/images/coffee-beans.webp` | AI-generated editorial coffee still life; not a specific product, brand or confirmed inventory. | 1536 × 1024 |
| `public/images/coffee-ritual.webp` | AI-generated editorial coffee and honey still life; not specific product packaging. | 1536 × 1024 |
| `public/images/honey-front.jpg` | Unchanged copy of user-supplied `example product image/1790762721113.jpg`. | 3072 × 4096 |
| `public/images/honey-back.jpg` | Unchanged copy of user-supplied `example product image/1790762721131.jpg`. | 3072 × 4096 |

Generated imagery is a visual treatment, not evidence for product composition, origin, certification, inventory, or delivery claims. The original supplied photographs and confirmed business information remain the source of truth. Packaging in generated images may contain small differences; use the real front/back photographs for label details. Dates and lot numbers in the back photograph describe that photographed sample only.

The actual supplied packaging is ESHAN Coffee Blossom Honey with a yellow label, gold cap, and rounded squat jar. VETRA STORE is the storefront name; it is not substituted onto the product packaging.

## Encoding and checks

- All generated outputs were visually inspected before inclusion.
- The three panoramic slides were encoded to WebP at quality 88 using Sharp, preserving their generated dimensions. Earlier landscape assets were encoded at quality 86 and preserve their 1536 × 1024 dimensions.
- The transparent product image was resized proportionally to 1100 × 1000 and losslessly encoded to PNG. Alpha metadata and pixel statistics confirmed real transparency (alpha range 0–255).
- Sharp was used only for encoding and proportional image sizing. All generated composition, background removal, and scene editing used the built-in image generation tool.
- Original source photographs were copied without image modification.

## Image prompt specifications

### Hero slide 1

Use case: compositing. Asset type: VETRA STORE homepage panoramic 3:1 banner. Use the original ESHAN front product photo as the primary identity reference and its prepared cutout for supporting detail. Remove the hand and indoor background. Place the same squat amber jar with its gold lid and vivid yellow illustrated ESHAN Coffee Blossom Honey label on natural stone among white coffee blossoms and misty hills at sunrise. Keep the jar complete and central for mobile cropping. Preserve the packaging details faithfully; add no new labels, claims, certification symbols, people, text overlays, or watermark.

### Hero slide 2

Use case: compositing. Asset type: VETRA STORE homepage panoramic 3:1 banner. Use the original ESHAN front product photo as the primary identity reference and its prepared cutout for supporting detail. Remove the hand and indoor background. Set the same branded jar beside a navy ceramic coffee cup, roasted beans, linen, and blossoms on a stone tabletop in soft morning light. Keep jar and cup in the central mobile crop. Preserve the original product shape, cap, yellow label and markings; add no invented claims, packaging, people, text overlays, or watermark.

### Hero slide 3

Use case: compositing. Asset type: VETRA STORE homepage panoramic 3:1 banner. Use the original ESHAN front product photo as the primary identity reference and its prepared cutout for supporting detail. Remove the hand and indoor background. Set the same branded jar on pale stone against a muted navy wall with an ivory ceramic bowl, linen, coffee blossoms, and leaves. Keep the full jar and front label in the central mobile crop. Preserve the original shape, cap, yellow label and markings; add no invented claims, packaging, people, text overlays, watermark, border, or black band.

### Transparent product

Use case: background-extraction. Asset type: ecommerce transparent product cutout. Input image is edit target. Isolate the EXACT actual ESHAN Coffee Blossom Honey 380g product jar in the attached photograph on a genuinely transparent background. Remove human hand and all indoor scene. Preserve exact squat rounded jar proportions, metallic gold screw cap, dark amber honey, bright yellow original illustrated label, all original English Thai Arabic label text, ESHAN logo, honeycomb and leaf illustrations. Do not redesign packaging or change brand. Upright front-facing carefully lit clean studio product photograph, correct obvious perspective tilt only, sharp and credible premium ecommerce image. Complete entire jar from cap to base fully visible, centered with 12% padding. No floor, no backdrop, no extra props, no text added. Transparent alpha background.

### Nature story

Use case: photorealistic-natural. Asset type: premium nature-focused honey brand editorial story image. Create a beautiful wide landscape 1536x1024 photograph of lush green mountains in northern Thailand at sunrise, successive mountains disappearing into delicate pale golden mist, mature coffee plant leaves and a few small white coffee blossoms in the lower right foreground. Quiet authentic Southeast Asian highland vegetation and atmosphere, deep forest green foliage, warm cream sky and soft sunlight, poetic calm restrained editorial photography, subtle 35mm film grain, natural colors, refined magazine art direction. Mountainous forest landscape takes majority of frame; white flowers a gentle small foreground detail. No buildings, people, labels, logos, packaging, typography or watermark. Not an identifiable specific farm, just editorial atmospheric nature.

### Coffee beans

Use case: photorealistic-natural. Asset type: premium storefront coffee category editorial photo. Create a realistic landscape 1536x1024 food photograph, medium close-up of a rustic dark wooden scoop filled with medium-roasted coffee beans resting on a natural warm linen table. Scattered coffee beans, delicate earthy ceramic bowl partly in frame, a leafy coffee branch with two ripe red cherries at rear edge. Natural side window light, rich roasted brown with warm cream and deep forest green accents. Refined independent magazine food photography, tactile textures, understated and elegant, shallow depth of field. The bean-filled scoop occupies center; interesting balance with generous atmospheric background. No packaging, logos, people, hands, lettering or watermarks. Beans should have natural nonuniform texture and restrained shine. This is atmospheric editorial imagery, not a specific branded product.

### Coffee ritual

Use case: photorealistic-natural. Asset type: premium honey brand journal and coffee lifestyle category image. Create a beautiful landscape 1536x1024 editorial food photograph of a quiet morning ritual: matte ivory ceramic cup filled with freshly brewed black coffee on a matching saucer, small glass bowl of amber honey and a wooden honey dipper resting neatly on its rim, on warm natural linen atop light aged wood. A small leafy branch with white coffee blossoms is subtly arranged behind; soft olive green garden bokeh through a nearby window in background. Composition: cup toward center-left, honey to right, full objects visible with breathing room. Gentle morning sunlight from upper left, rich cream and forest green with warm amber, tactile handmade ceramic, relaxed refined premium natural store aesthetic, shallow depth of field, realistic photograph. No coffee splash, no spoon magically floating, no steam plume, no hands, no people, no logo, no product packaging, no text or watermarks.


# Golden Template Studio

## What the golden page is
- The internal reference landing page for Quiz Factory.
- A stable baseline of blocks, spacing, and copy rhythm.
- The first place to verify new blocks or variants.

## What the golden page is not
- A marketing experiment or a one-off redesign.
- A full design system for the entire app.
- A place to introduce new dependencies or imagery without review.

## Asset rules
- Use only the studio icon set.
- Avoid stock photos and AI faces.
- If imagery is essential, keep it local, abstract, and minimal.

## Copy rules
- Avoid generic marketing phrases ("unlock your potential", "revolutionary", "game-changing").
- Use specific outcomes, numbers, or test language.
- Keep every sentence purposeful; trim anything that reads like filler.

## Block checklist
- The block has a single purpose and fits the golden order.
- Variants are prop-driven and typed, not duplicated components.
- Theme tokens drive radius, font, and primary accent usage.
- Layout works on mobile and desktop without layout shifts.
- No new dependencies or global refactors.

## Definition of Done for new blocks or variants
- The block renders in `/studio/blocks` with all variants visible.
- The golden page either uses the block or documents why it does not.
- Copy follows the rules above and avoids generic phrasing.
- Assets follow the icon and imagery rules.
- Studio routes remain gated by `STUDIO_ENABLED` and are noindex.

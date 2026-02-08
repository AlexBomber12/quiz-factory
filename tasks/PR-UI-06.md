PR-UI-06: Test Landing Calm Premium Refresh (Sticky CTA + Conversion Layout)

Read and follow AGENTS.md strictly.

Context
- The public test landing page lives at apps/web/src/app/t/[slug]/page.tsx.
- It is composed from Studio blocks (apps/web/src/studio/blocks/*) and styled via "studio-" CSS in globals.css.
- PR-UI-04 sets Calm Premium styling and provides Stitch references for the landing layout.

Goal
- Implement the chosen Stitch variant for /t/[slug] (conversion layout).
- Add a mobile sticky Start CTA that links to /t/[slug]/run.
- Keep the page fast, accessible, and consistent with Calm Premium tokens.

Workflow rules
- Create a new branch from main named: pr-ui-06-test-landing-sticky-cta
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing (scripts/ci.sh).

Task A: Stitch alignment
A1) Read docs/ui/stitch/NOTES.md and implement the chosen Test Landing variant.
- Use existing Studio blocks when possible.
- If a new block variant is required, implement it as a typed prop variant (do not duplicate whole components).
- Keep changes minimal and focused on /t/[slug].

Task B: Mobile sticky Start CTA
B1) Add a sticky CTA bar visible on mobile only (md:hidden).
- It must link to /t/[slug]/run and use the primary CTA styling (teal).
- Suggested implementation:
  - Add a section at the end of the page with position: fixed bottom-0 inset-x-0.
  - Add a translucent surface and border using tokens.
  - Include safe-area padding (pb-[env(safe-area-inset-bottom)]) if needed.
- Ensure page content is not hidden behind the sticky bar:
  - Add bottom padding to the main content wrapper on this page only.

Task C: Conversion layout polish
C1) Ensure the page has clear hierarchy and scannable sections:
- Hero with primary CTA above the fold.
- "What you get" section remains clear and uses consistent card styling.
- Trust/social proof and FAQ remain present.
- Avoid adding multiple competing CTA styles; reuse the same primary CTA.

Task D: Accessibility and SEO safety
D1) Ensure CTA and anchors are keyboard accessible.
D2) Do not change metadata logic except what is necessary for layout.
- Keep canonical/locale alternates as implemented.

Tests and gates
- Run scripts/ci.sh and ensure exit code 0.
- Run pnpm --filter @quiz-factory/web build.

Success criteria
- /t/[slug] matches the chosen Stitch layout.
- Mobile sticky Start CTA appears and does not overlap content.
- Calm Premium styling remains consistent (no warm legacy colors in the landing).
- scripts/ci.sh exits 0.

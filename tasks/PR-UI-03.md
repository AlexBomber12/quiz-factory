PR-UI-03: Test Landing Page (/t/[slug]) with Tailwind + shadcn/ui

Read and follow AGENTS.md strictly.

Context
- PR-UI-02 introduced a tenant homepage listing tests and linking to /t/<slug>.
- Test runner and payments may be implemented later, but the landing page must exist now.
- The landing page must be tenant-aware and localized.

Goal
- Implement /t/[slug] landing page that renders localized test copy and a clear CTA.
- Keep it mobile-first, fast, and consistent with the new UI foundation.

Workflow rules
- Create a new branch from main named: pr-ui-03-test-landing
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing.

Task A: Landing route
A1) Add a new route:
- apps/web/src/app/t/[slug]/page.tsx

Behavior
- Resolve tenant_id and locale.
- Resolve slug to a test record using the same catalog loader from PR-UI-02.
- Render:
  - Hero: title and short_description
  - Intro section: longer intro text if available, otherwise reuse short_description
  - Meta chips: estimated_minutes and category (if available)
  - Disclaimer block: "Not medical advice" (neutral wording)

Task B: CTA behavior
B1) Primary CTA button
- Label: Start
- Link target:
  - If /t/[slug]/run exists in the repo, link to it.
  - If it does not exist yet, keep the button disabled and show "Coming soon".

B2) Secondary CTA
- Link back to the homepage.

Task C: Metadata
C1) Implement generateMetadata
- Title and description from localized test copy.
- Canonical uses the request host.
- Set OpenGraph title and description.

Task D: Styling
D1) Use shadcn/ui components
- Card, Button, Badge, Separator.

D2) Keep layout simple
- Max width container
- Mobile-first spacing

Task E: Tests
E1) Add a vitest test for slug resolution
- Given a known slug, the loader resolves a test with a non-empty title.

Success criteria
- scripts/ci.sh exits 0.
- /t/<slug> renders a consistent landing page.
- CTA behavior matches runner availability.

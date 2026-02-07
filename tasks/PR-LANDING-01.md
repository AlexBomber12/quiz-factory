PR-LANDING-01: Selling Test Landing Page (/t/[slug]) Using Studio Blocks

Read and follow AGENTS.md strictly.

Context
- /t/[slug] exists and renders a simple shadcn/ui card layout.
- The repo already has a Golden Template Studio with reusable blocks under apps/web/src/studio/blocks.
- We want the public test landing to feel like a real product page, not a placeholder.

Goal
- Rebuild /t/[slug] as a selling landing composed from the existing studio blocks.
- Use localized test content from the published test in the content DB.
- Make the page answer the buyer questions: what is this, what do I get for free, what is paid, how long it takes, can I trust it.

Non-goals
- Do not add new studio blocks.
- Do not change checkout, scoring, paywall, or report behavior.
- Do not add new tracking events beyond existing page_view.

Workflow rules
- Create a new branch from main named: pr-landing-01-selling-landing
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing.

Task A: Landing composition
A1) Refactor /t/[slug] to a block-based layout
- Update: apps/web/src/app/t/[slug]/page.tsx
- Replace the current card stack with a section stack using:
  - NavbarBlock
  - HeroBlock
  - HowItWorksBlock
  - SocialProofBlock (use variant "trust-bullets" only)
  - FaqBlock
  - FooterBlock

A2) Add a small public wrapper to keep spacing consistent
- Create: apps/web/src/components/public/PublicPage.tsx
- Responsibilities:
  - Provide a max-width container and vertical spacing.
  - Optional anchor support (id props passed through).

Task B: Map localized test content into blocks
B1) Hero mapping
- kicker: test.category (fallback: "Quiz")
- headline: test.title
- subheadline: test.short_description (fallback to test.intro)
- primary CTA:
  - label: "Start test"
  - href: /t/<slug>/run
- secondary CTA:
  - label: "What's inside"
  - href: #what-you-get
- stats: use real values when available, otherwise conservative placeholders:
  - "Time" -> "<estimated_minutes> min"
  - "Questions" -> "<questions.length>"
  - "Report" -> "PDF + insights"

B2) How it works mapping
- Steps must be short and practical:
  1) Answer questions (no account)
  2) Get free preview
  3) Unlock full report

B3) Trust bullets
- Use SocialProofBlock variant "trust-bullets" with 3 bullets:
  - Privacy-aware tracking
  - Clear pricing and access
  - Instant report + PDF

Task C: Add a "What you get" section
C1) Add a section between HowItWorks and FAQ
- Anchor id: what-you-get
- Use shadcn Card components.
- Content requirements:
  - Split into 2 columns on desktop:
    - Free preview includes: result headline, short summary, score breakdown.
    - Full report includes: deep interpretation, action plan, pitfalls, printable PDF.
  - Add a neutral disclaimer line: informational only, not medical advice.

Task D: Avoid broken links
D1) Ensure the public landing does not link to /studio/*
- Navbar links must point to public anchors (#how, #proof, #faq) not studio routes.
- Footer links must point to public pages (/, /tests, /privacy).

Task E: Tests
E1) Add a small unit test for the landing props
- Create: apps/web/src/components/public/test_landing_props.ts
- Export a pure function that builds the block props from (test, publishedSpec).
- Add: apps/web/src/components/public/test_landing_props.test.ts
- Verify for the golden test:
  - Primary CTA href is /t/<slug>/run
  - Anchor ids are stable
  - Stats include questions count

Success criteria
- scripts/ci.sh exits 0.
- /t/<slug> renders the block-based selling landing.
- All CTAs and footer links resolve to real public routes.

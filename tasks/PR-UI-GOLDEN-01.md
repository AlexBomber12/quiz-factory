PR-UI-GOLDEN-01: Golden Template Studio (Golden Landing + Blocks Catalog + Theme Tokens)

Read and follow AGENTS.md strictly.

Context
- We need a repeatable UI factory for Quiz Factory.
- The goal is to stop hand-designing pages and start assembling pages from reusable blocks.
- This PR creates an internal Template Studio (for us, not for end users):
  - /studio/golden: 1 canonical landing page (the "golden" reference)
  - /studio/blocks: a catalog that renders every block and its variants
- The stack is pnpm + Next.js in apps/web. Follow existing repo conventions.

Principles
- Start from a strong reference, then reduce. Avoid invention.
- Consistency beats novelty: 1 icon set, 1 typography system, minimal or zero imagery.
- Studio pages must not be indexed by search engines and must be disabled by default in production.
- Do not add a new "template" dependency (no git submodules, no copying an entire repo). Only implement the needed UI blocks in our codebase.

Goals
1) Internal studio routes
- Add /studio/golden and /studio/blocks.
- Add a shared /studio layout with a small navigation between Golden and Blocks.

2) Golden landing built from blocks
- Implement the golden page by composing blocks (not by writing one huge page).
- Golden page sections (in this order):
  - Navbar
  - Hero (1 headline, 1 subheadline, 1 primary CTA)
  - How it works (3 steps)
  - Social proof (either 3 short testimonials OR 3 trust bullets)
  - FAQ (5 items)
  - Footer

3) Block library with variants
- Create a block library where each section is a reusable component.
- Add a Blocks catalog page that renders every block.
- At least 2 blocks must implement at least 2 variants (example: Hero variant A/B, SocialProof variant A/B).
- Variants must be driven by a typed prop (not by duplicating whole components).

4) Theme tokens single source of truth
- Add themes/default.json as the single source of truth for basic tokens:
  - primary color
  - radius
  - font stack
- Apply these tokens so that changing themes/default.json changes the rendered UI without hunting across files.

5) Rules and checklists
- Add docs/ui/golden.md with:
  - what the golden page is and is not
  - asset rules (icons, images, no AI faces)
  - copy rules (avoid generic AI marketing phrases)
  - block checklist and Definition of Done for adding new blocks or variants

Non-goals
- Full admin/auth system for studio pages.
- Full design system rework across the whole app.
- Dozens of variants. Keep this PR focused.
- Adding stock photo libraries or AI generated imagery.

Implementation requirements
A) Studio gating (disabled by default)
- Studio must be disabled by default.
- Add an env gate STUDIO_ENABLED.
- If STUDIO_ENABLED is not "true", /studio/* routes must behave like 404.

B) Noindex
- /studio/* must never be indexed.
- Add Next.js metadata robots rules for studio pages (index=false, follow=false).

C) Assets and icons
- Use exactly 1 icon set.
- Prefer the icon set already used by the codebase (likely lucide-react from shadcn).
- No external images are required for this PR. If you add any imagery, it must be minimal, abstract, and local (no remote hotlinks).

D) Styling
- Use existing Tailwind + shadcn/ui patterns.
- Keep layout clean and minimal: typography, spacing, cards, badges, accordions.
- Do not introduce a new styling framework.

Suggested file layout (adapt to existing repo conventions)
- themes/default.json
- docs/ui/golden.md
- apps/web/app/studio/layout.tsx
- apps/web/app/studio/golden/page.tsx
- apps/web/app/studio/blocks/page.tsx
- apps/web/src/studio/blocks/
  - NavbarBlock.tsx
  - HeroBlock.tsx
  - HowItWorksBlock.tsx
  - SocialProofBlock.tsx
  - FaqBlock.tsx
  - FooterBlock.tsx
- apps/web/src/studio/theme/
  - tokens.ts (typed loader for themes/default.json)
  - applyTheme.ts (helper to apply tokens to CSS variables, if needed)
- apps/web/src/studio/studioGuard.ts (STUDIO_ENABLED gate)

Theme tokens spec
- Create themes/default.json with a small schema like:
  - id
  - font_sans
  - radius
  - colors.primary_hsl (or the format already used by the project)
- Implement a small typed loader that imports themes/default.json and exports a ThemeTokens object.
- Apply at least:
  - --radius from theme radius
  - font-sans (either via CSS variable or Tailwind config hook if already exists)
  - primary color (only if it does not break existing light/dark setup; otherwise document how to wire it next)

Definition of Done
- /studio/golden renders the canonical landing page using only reusable blocks.
- /studio/blocks renders all blocks and demonstrates variants for at least 2 blocks.
- Studio routes are gated by STUDIO_ENABLED and return 404 when disabled.
- Studio routes are noindex (robots index=false, follow=false).
- themes/default.json exists and is used as the single source of truth for at least radius and font, and (if safe) primary color.
- docs/ui/golden.md exists and provides clear rules for future UI work.
- Local test gate passes (Run Standard PR Runbook).

Workflow rules
- Create a new branch from main named: pr-ui-golden-01-template-studio
- Implement only what this task requests.
- Keep commits small and readable.
- When green, commit with message: "PR-UI-GOLDEN-01: Template Studio golden + blocks"

Notes
- If the repo already has a theme system, integrate with it instead of inventing a second one.
- If the project already has a /admin or /internal pattern, follow that naming, but keep the requested routes working.

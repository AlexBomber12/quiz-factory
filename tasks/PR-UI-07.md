PR-UI-07: Primary Ink CTA (Decouple --primary from --color-primary)

Read and follow AGENTS.md strictly.

Goal
- Make primary CTA color ink (brand navy) across the public site and Studio.
- Keep teal as an accent and keep Studio gradients teal.
- Implement by decoupling CSS variables:
  - --primary (CTA) becomes ink
  - --color-primary (accent used by Studio gradient) remains teal
- Ensure focus ring uses ink, not teal.

Workflow rules
- Create a new branch from main named: pr-ui-07-primary-ink-cta
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing (scripts/ci.sh).

Required changes

A) Update shadcn tokens in apps/web/src/app/globals.css
A1) In :root, introduce a teal token and rewire primary variables exactly as follows:
- Add:
  --brand-teal: 174.67 83.85% 31.57%
- Set:
  --primary: var(--brand-navy)
  --ring: var(--brand-navy)
  --primary-hover: 210 72.97% 17.65%
  --color-primary: var(--brand-teal)

A2) Keep existing values unchanged for:
- --background, --foreground, --card, --muted, --accent, --accent-foreground, --border, --input, --radius, --brand-navy, --primary-foreground.

A3) Confirm the following UI outcomes:
- Public CTAs (shadcn Button variant default, and .studio-button) are ink, not teal.
- Teal still appears in accents (chips, Studio gradient) via --accent and --color-primary.
- Focus outlines are ink (ring token).

B) Stop Studio theme from overriding --primary
B1) Update apps/web/src/studio/theme/applyTheme.ts
- applyTheme must no longer set the --primary CSS var.
- It must still set:
  - --radius
  - --font-sans
  - --color-primary (from tokens.colors.primary_hsl)
- Do not rename themes/default.json schema in this PR.
- Rationale: tokens.colors.primary_hsl remains teal and continues to drive Studio gradients via --color-primary only.

C) Verification steps (manual)
C1) Start dev server and check key pages
- Run:
  pnpm --filter @quiz-factory/web dev
- Open:
  http://localhost:3000/
  http://localhost:3000/tests
  http://localhost:3000/t/focus-rhythm
  http://localhost:3000/studio/golden
- Confirm:
  - "Start test" button is ink
  - category chips and subtle highlights remain teal
  - Studio shell background keeps a teal-tinted gradient

D) Tests and gates
- Run scripts/ci.sh
- Run pnpm --filter @quiz-factory/web build
- Run pnpm --filter @quiz-factory/web test
- Run pnpm --filter @quiz-factory/web e2e

Commit and PR
- Commit message: PR-UI-07: Primary ink CTA tokens
- Push branch and open PR targeting main.

Success criteria
- No teal primary CTAs on public pages; primary and ring are ink.
- Studio gradient remains teal (driven by --color-primary), but Studio CTA buttons are ink.
- scripts/ci.sh exits 0.
- pnpm build, test, and e2e exit 0.

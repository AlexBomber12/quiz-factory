PR-UI-04: Calm Premium Theme Contract (Navy + Teal) + Stitch References

Read and follow AGENTS.md strictly.

Context
- apps/web is a Next.js app-router project in a pnpm monorepo.
- Tailwind + shadcn/ui are already installed and used for public pages such as the tenant homepage (/).
- The public test landing page (/t/[slug]) is built from Studio blocks under apps/web/src/studio/blocks and uses the "studio-" CSS classes in apps/web/src/app/globals.css.
- Current tokens and Studio styles lean warm (beige/orange). We want a calm premium look inspired by 123test style, but with a navy + teal palette.

Goal
- Define and implement a strict Calm Premium token contract (colors, typography, radius, shadows).
- Apply it consistently to:
  - Tailwind + shadcn/ui tokens (CSS variables in globals.css)
  - Studio block styling (the "studio-" CSS in globals.css)
  - themes/default.json (primary color, radius, font)
- Produce Stitch reference layouts (3 variants each) for:
  - Tenant Homepage (/)
  - Test Landing (/t/[slug])

Workflow rules
- Create a new branch from main named: pr-ui-04-calm-premium-theme-contract
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing (scripts/ci.sh).

Design contract (must be implemented exactly)

1) Palette (hex)
- background: #F8FAFC
- surface: #FFFFFF
- border/input: #E2E8F0
- text: #0F172A
- text-muted: #475569
- brand navy: #0A2540
- primary CTA teal: #0D9488
- primary hover teal: #0F766E
- accent bg (chips/hover): #F0FDFA
- secondary bg: #F1F5F9
- destructive: #DC2626
- destructive hover: #B91C1C

2) shadcn/ui CSS variables (HSL)
- Update apps/web/src/app/globals.css :root tokens to:
  --background: 210 40% 98%
  --foreground: 222.22 47.37% 11.18%
  --card: 0 0% 100%
  --card-foreground: 222.22 47.37% 11.18%
  --popover: 0 0% 100%
  --popover-foreground: 222.22 47.37% 11.18%
  --primary: 174.67 83.85% 31.57%
  --primary-foreground: 0 0% 100%
  --secondary: 210 40% 96%
  --secondary-foreground: 222.22 47.37% 11.18%
  --muted: 210 40% 96%
  --muted-foreground: 215.29 19.32% 34.51%
  --accent: 166.15 76.47% 96.67%
  --accent-foreground: 210 72.97% 14.51%
  --destructive: 0 72% 51%
  --destructive-foreground: 0 0% 100%
  --border: 214.29 31.82% 91.37%
  --input: 214.29 31.82% 91.37%
  --ring: 174.67 83.85% 31.57%
  --radius: 0.75rem

3) Additional CSS variables (global)
- Also define in :root (globals.css):
  --brand-navy: 210 72.97% 14.51%
  --primary-hover: 175.34 77.44% 26.08%
  --color-primary: var(--primary)

4) Typography
- Set --font-sans to an Inter-first stack in :root:
  "Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"

5) Shadows
- Use a soft premium shadow for cards and panels in Studio styles:
  - card shadow: 0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px -16px rgba(15, 23, 42, 0.12)
  - dropdown shadow: 0 12px 32px -18px rgba(15, 23, 42, 0.22)

6) UI rules
- Exactly 1 primary CTA style (teal) per section. Secondary actions must be muted.
- Links and headings use brand navy, not teal.
- Focus states use the ring token (teal).

Task A: Stitch reference layouts via MCP
A1) Use Google Stitch via MCP to generate 3 layout variants for the Tenant Homepage (/).
- Include search + category tag chips in the layout.
- Use the design contract above (navy + teal, calm premium, mobile-first).
- Export images to:
  - docs/ui/stitch/tenant-home-a.png
  - docs/ui/stitch/tenant-home-b.png
  - docs/ui/stitch/tenant-home-c.png

A2) Generate 3 layout variants for the Test Landing (/t/[slug]).
- Include conversion structure (hero, what you get, trust, FAQ) and a mobile sticky start CTA.
- Export images to:
  - docs/ui/stitch/test-landing-a.png
  - docs/ui/stitch/test-landing-b.png
  - docs/ui/stitch/test-landing-c.png

A3) Create docs/ui/stitch/NOTES.md
- Pick exactly 1 variant for Tenant Homepage and 1 variant for Test Landing.
- Explain why in max 10 bullets total.
- List the block/component breakdown needed to implement the chosen variants.

Task B: Update theme tokens source of truth
B1) Update themes/default.json to match Calm Premium:
- id: calm-premium-default
- font_sans: the Inter stack from the contract
- radius: "12px"
- colors.primary_hsl: "174.67 83.85% 31.57%"

Task C: Implement shadcn token contract
C1) Update apps/web/src/app/globals.css
- Replace the :root token values to match the contract exactly.
- Ensure the base body uses bg-background and text-foreground (already in layout).
- Update base link styling so anchors default to brand navy, with underline-offset-4 (keep underlines subtle).

Task D: Update Studio block styling to Calm Premium
D1) Update the Studio section in apps/web/src/app/globals.css, focusing on:
- .studio-shell: use calm premium background (based on background token) and border (border token).
  - Replace the warm beige background gradients with subtle teal-tinted gradients.
  - Set Studio text to use brand navy for ink and muted token for secondary text.
- .studio-button: teal background with white text. Use primary-hover on hover.
- .studio-button--ghost: transparent, border uses border token, text uses brand navy.
- .studio-badge and any accent chips: use accent bg token and primary teal for text.
- Ensure Studio cards/panels use the premium shadow values defined above.

Constraints
- Do not redesign page layouts in this PR. This PR is tokens + styling + Stitch references only.
- Do not add Tailwind Plus or new UI frameworks.

Tests and gates
- Run scripts/ci.sh and ensure exit code 0.
- Run pnpm --filter @quiz-factory/web build to confirm Next build passes.

Success criteria
- docs/ui/stitch/* images and NOTES.md are committed.
- themes/default.json matches the contract.
- globals.css :root tokens match the contract exactly.
- Studio landing look shifts to calm premium (navy + teal) without broken layouts.
- scripts/ci.sh exits 0.

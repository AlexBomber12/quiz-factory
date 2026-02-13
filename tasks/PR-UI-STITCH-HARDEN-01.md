PR ID: PR-UI-STITCH-HARDEN-01
Branch: pr/ui-stitch-harden-01

Goal
Harden the currently integrated Stitch-based Tenant Home UI so it is production-grade and CI-stable, while switching the Accent color to warm terracotta (as in Stitch) and keeping teal only as a secondary accent.

Context
- Stitch “Tenant Home - Standard Grid” has been integrated already (PR-UI-STITCH-MCP-01 is DONE).
- Primary CTA is already ink/navy (PR-UI-07 is DONE).
- Visual regression gate exists and should remain green.

Hard constraints
- Do not modify anything under apps/web/src/app/api/.
- Do not introduce new UI libraries. Use existing Tailwind + shadcn/ui + lucide-react.
- Keep all existing routes and behaviors unchanged.
- No external asset dependencies for critical UI rendering (fonts/icons/remote images must not be required at runtime).
- No randomness and no time-based animation that can cause flaky screenshots.

Work plan
1) Audit for external assets introduced by Stitch integration
   - Search the codebase for any of these strings and remove or replace them:
     - fonts.googleapis.com
     - material-icons / Material Icons
     - https://images. / https://cdn.
     - <img src="http
   - Replace icons with lucide-react (already in dependencies).
   - Replace any remote images with deterministic code-only placeholders (gradient blocks, subtle SVG, or local /public assets).

2) Implement Accent = terracotta, teal secondary
   - Update apps/web/src/app/globals.css token values so that:
     - --primary and --ring remain ink/navy (do not revert primary back to teal).
     - --accent becomes a warm terracotta family color.
     - --accent-foreground remains readable (use ink/navy or near-black).
     - teal remains available only as a secondary accent (do not use teal as primary CTA).
   - Add explicit tokens to avoid future confusion:
     - --brand-terracotta (new)
     - --brand-teal (new or reuse existing teal token)
     - Keep the existing decoupling rule: --primary is not the same as the decorative/studio accent.
   - Update only the components that should visually reflect Accent (chips, subtle highlights, small badges) to use the terracotta accent token.

3) Make visuals deterministic for screenshots
   - Ensure any gradient/shape overlays:
     - are deterministic (no random seeds)
     - have no animation in visual tests
   - If there are CSS animations, ensure they are disabled in the visual test environment.

4) Keep the UI contract consistent
   - Tenant Home should still render the same information and links.
   - Search, category filtering, and navigation must keep working.

5) Update visual baselines for Linux (expected UI change)
   - Run the visual gate locally in the same environment as CI.
   - If snapshots changed due to the accent switch and asset hardening, update Linux snapshots in this PR.

Local gates
- pnpm -w lint
- pnpm -w test
- pnpm --filter @quiz-factory/web e2e
- pnpm --filter @quiz-factory/web e2e-visual

Commit and push
- Commit message: PR-UI-STITCH-HARDEN-01: harden Stitch UI (terracotta accent, deterministic assets)

Success criteria
- Accent across homepage uses terracotta, not teal; primary CTA remains ink/navy.
- No runtime reliance on Google Fonts, Material Icons, or remote images.
- Visual suite is stable (run e2e-visual 2-3 times locally with identical results).
- All gates pass, and updated Linux snapshots (if changed) are committed in this PR.

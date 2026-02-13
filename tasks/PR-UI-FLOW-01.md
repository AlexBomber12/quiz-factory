PR ID: PR-UI-FLOW-01
Branch: pr/ui-flow-01

Goal
Unify the test-taking flow UI with the new marketing design language so the experience remains premium after the user clicks “Start test”.

Scope
- /t/[slug]/run
- /t/[slug]/preview
- /t/[slug]/pay

Hard constraints
- Do not modify anything under apps/web/src/app/api/.
- Preserve all flow behavior (resume, start over, navigation, cookies).
- No new UI libraries.
- Keep a11y at least as good as current.

Work plan
1) Remove legacy hardcoded styles
   - Identify any remaining old CSS classes and hardcoded colors used in runner/preview/pay.
   - Replace with Tailwind + shadcn/ui components.

2) Apply the color strategy
   - Primary CTA remains ink/navy.
   - Terracotta accent for highlights.
   - Teal only secondary.

3) Standardize layout and typography
   - Use consistent spacing, section headers, and card styling.
   - Ensure the sticky CTA and important actions look intentional on mobile.

4) Robust empty/error/loading states
   - Preview/pay should handle missing preview/report gracefully without “dev copy”.

5) Do not touch business logic
   - Only presentation-layer changes.

Local gates
- pnpm -w lint
- pnpm -w test
- pnpm --filter @quiz-factory/web e2e
- pnpm --filter @quiz-factory/web e2e-visual

Commit and push
- Commit message: PR-UI-FLOW-01: unify run/preview/pay UI with premium design

Success criteria
- Flow pages look visually consistent with homepage/tests.
- No regressions in navigation and attempt flow.
- Visual gate remains green (update snapshots only if changes are expected and part of this PR).

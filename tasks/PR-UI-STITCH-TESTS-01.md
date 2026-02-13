PR ID: PR-UI-STITCH-TESTS-01
Branch: pr/ui-stitch-tests-01

Goal
Make /tests visually and structurally consistent with the Stitch-based Tenant Home (Standard Grid) so the user experience feels like one product.

Hard constraints
- Do not modify anything under apps/web/src/app/api/.
- Do not introduce new UI libraries.
- Preserve /tests behavior:
  - existing query parameter ?q= must still filter results
  - navigation to /t/[slug] must remain correct
- Keep Playwright gates green.

Work plan
1) Unify layout and blocks between / and /tests
   - Identify the components used on the tenant homepage (likely a shared explorer/grid component).
   - Reuse the same card component, same search input styling, same chips styling, same spacing/typography.
   - Avoid duplicating styles: extract shared UI into components if needed.

2) Apply the current color strategy
   - Primary CTA remains ink/navy.
   - Accent is terracotta for chips/highlights.
   - Teal stays secondary (do not use teal as primary accent in /tests).

3) Improve empty and small-catalog states
   - Keep the existing message logic, but ensure it looks intentional and aligned with the homepage styling.

4) Update visual snapshots
   - /tests snapshot should match the new styling.
   - If the visual gate changes, update Linux snapshots in the same PR.

Local gates
- pnpm -w lint
- pnpm -w test
- pnpm --filter @quiz-factory/web e2e
- pnpm --filter @quiz-factory/web e2e-visual

Commit and push
- Commit message: PR-UI-STITCH-TESTS-01: align /tests with Stitch tenant home design

Success criteria
- /tests looks like the same design system as / (same cards, spacing, typography, chips, inputs).
- Terracotta accent is used consistently; teal is only secondary.
- All gates are green; updated Linux snapshots (if changed) are committed.

PR ID: PR-UI-GATE-02
Branch: pr/ui-gate-02

Goal
Extend the Playwright visual regression suite to cover the full user journey, not only / and /tests.

Add visual snapshots for
- /t/focus-rhythm
- /t/focus-rhythm/run
- /t/focus-rhythm/preview
- /t/focus-rhythm/pay

Hard constraints
- Keep tests deterministic: no flakiness.
- Prefer reusing existing visual test helpers and conventions.
- Do not add new dependencies.

Work plan
1) Inspect existing visual suite
   - Find the current e2e-visual spec and helper utilities.
   - Follow the existing naming convention (01-home, 02-tests, etc.).

2) Add 4 new golden page screenshots
   - Ensure each page waits for stable render:
     - fonts loaded
     - network idle or a stable selector
   - Disable animations for snapshot runs if not already done.

3) Ensure base URL setup matches CI
   - Use the same PLAYWRIGHT_BASE_URL logic as the workflow.
   - Avoid cross-origin issues by matching host/origin expectations.

4) Update Linux baselines if needed
   - Run e2e-visual locally on Linux.
   - If new snapshots are introduced, commit them.

Local gates
- pnpm --filter @quiz-factory/web e2e-visual

Commit and push
- Commit message: PR-UI-GATE-02: extend visual suite to flow pages

Success criteria
- CI job e2e-visual covers 01-home, 02-tests, plus the 4 new flow pages.
- Visual suite is stable (no intermittent failures).
- All new Linux snapshots are committed.

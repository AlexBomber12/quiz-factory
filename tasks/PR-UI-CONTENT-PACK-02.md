PR ID: PR-UI-CONTENT-PACK-02
Branch: pr/ui-content-pack-02

Goal
Make the UI feel non-prototype when a tenant has 0-3 tests by introducing content packs and intentional empty/small-catalog states.

Hard constraints
- Do not modify anything under apps/web/src/app/api/.
- No new UI libraries.
- Keep existing routing and functionality.

Work plan
1) Introduce a small marketing copy pack layer
   - Add a minimal content pack module used by public pages (/ and /tests at minimum).
   - Provide stable strings for:
     - hero headline/subheadline
     - section headers (“Featured”, “Browse”, “How it works” if present)
     - empty state copy (0 tests)
     - small catalog guidance (1-3 tests)
   - Ensure there is a safe fallback (no crashes if tenant profile is missing).

2) Human-friendly category labels
   - Ensure category slugs like daily-habits render as “Daily habits”.
   - Keep this deterministic and localizable later.

3) Remove any remaining dev-vitrine copy
   - Search and remove public-facing strings that feel internal:
     - “Tenant homepage”, raw tenant ids, debug labels

4) Keep design language consistent
   - Use existing tokens (primary ink, accent terracotta, teal secondary).

5) Update visual snapshots
   - If text and layout change affects visual gate, update Linux snapshots in this PR.

Local gates
- pnpm -w lint
- pnpm -w test
- pnpm --filter @quiz-factory/web e2e
- pnpm --filter @quiz-factory/web e2e-visual

Commit and push
- Commit message: PR-UI-CONTENT-PACK-02: content packs for small catalogs and empty states

Success criteria
- With 0 tests: page looks intentional, not broken.
- With 1 test: layout does not look empty or dev-ish.
- With 2-3 tests: no awkward “grid gaps” or noisy metrics.
- No internal/technical labels leak into public UI.
- Visual gate is green (snapshots updated if needed).

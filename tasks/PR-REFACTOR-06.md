PR-REFACTOR-06: Tailwind Brand Tokens and UI Component Extraction

Read and follow AGENTS.md strictly.

Context
- Brand colors are referenced via raw CSS variable syntax: `hsl(var(--brand-terracotta)/0.2)` in dozens of components.
- No semantic Tailwind tokens exist for brand colors.
- Repeated UI patterns (FlowFrame, ErrorBanner, ProgressBar) are inlined in test-runner.tsx and other files.
- Only 5 UI primitives exist in `src/components/ui/`.

Goal
- Define brand colors as first-class Tailwind tokens.
- Replace all raw `hsl(var(--brand-*))` with Tailwind classes.
- Extract repeated UI patterns into reusable components.

Workflow rules
- Branch: `pr-refactor-06-brand-tokens`
- Depends on: PR-REFACTOR-01 (path aliases).
- Implement only what this task requests.
- Run the project test gate locally before committing.

Task A: Tailwind brand color tokens
A1) Update `apps/web/tailwind.config.ts`:
- Add brand colors to the `extend.colors` section:
  ```typescript
  colors: {
    "brand-navy": "hsl(var(--brand-navy) / <alpha-value>)",
    "brand-teal": "hsl(var(--brand-teal) / <alpha-value>)",
    "brand-terracotta": "hsl(var(--brand-terracotta) / <alpha-value>)",
  }
  ```
A2) Verify that CSS variables (`--brand-navy`, `--brand-teal`, `--brand-terracotta`) are defined in `globals.css`.

Task B: Replace raw CSS variable usage
B1) Find all instances of `hsl(var(--brand-terracotta)` patterns in `apps/web/src/`.
B2) Replace with Tailwind token equivalents:
- `bg-[hsl(var(--brand-terracotta)/0.2)]` -> `bg-brand-terracotta/20`
- `text-[hsl(var(--brand-navy))]` -> `text-brand-navy`
- `border-[hsl(var(--brand-teal)/0.35)]` -> `border-brand-teal/35`
B3) Preserve visual appearance exactly (same opacity values).

Task C: Extract reusable components
C1) Extract from `test-runner.tsx` into `apps/web/src/components/ui/`:
- `flow-frame.tsx`: The FlowFrame wrapper (max-width container with studio shell).
- `error-banner.tsx`: The error banner with destructive styling.
- `progress-bar.tsx`: The animated progress bar with aria attributes.
C2) Each component should:
- Accept className prop for customization.
- Use cn() helper for class merging.
- Have proper TypeScript props interface.
C3) Update `test-runner.tsx` and any other files using these patterns to import the new components.

Task D: Verification
D1) `grep -rn "hsl(var(--brand-" apps/web/src/` returns zero results.
D2) `pnpm typecheck` passes.
D3) `pnpm test` passes.
D4) `pnpm build` succeeds.
D5) `scripts/ci.sh --scope app` exits 0.
D6) Visual regression: if Playwright golden tests exist, update snapshots and verify pages look identical.

Success criteria
- Zero raw `hsl(var(--brand-*))` patterns remain.
- Brand tokens are usable as `brand-navy`, `brand-teal`, `brand-terracotta` in any Tailwind class.
- FlowFrame, ErrorBanner, ProgressBar are reusable components.
- `scripts/ci.sh --scope app` exits 0.

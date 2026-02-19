PR-REFACTOR-03: Centralized Environment Variable Validation (zod)

Read and follow AGENTS.md strictly.

Context
- ~40 environment variables are accessed via `process.env.X` scattered across the codebase.
- No validation at startup; missing vars cause runtime errors (e.g., Stripe webhook fails silently if `STRIPE_WEBHOOK_SECRET` is unset).
- Dev fallbacks are inconsistent: some files have them, some throw, some silently return null.

Goal
- Create a single `@/lib/env.ts` module that validates all env vars at first access.
- Replace all direct `process.env.X` references with imports from `@/lib/env`.
- Provide clear error messages at startup if required vars are missing in production.

Workflow rules
- Branch: `pr-refactor-03-env-validation`
- Depends on: PR-REFACTOR-01 (path aliases).
- Implement only what this task requests.
- Run the project test gate locally before committing.

Task A: Install zod
A1) Add `zod` to `apps/web/package.json` dependencies.
A2) Run `pnpm install` and commit updated lockfile.

Task B: Create env module
B1) Create `apps/web/src/lib/env.ts`.
B2) Define zod schemas grouped by domain:
- `server` (always validated on server):
  - STRIPE_SECRET_KEY: z.string().min(1) in production, optional in dev
  - STRIPE_WEBHOOK_SECRET: z.string().min(1) in production, optional in dev
  - ADMIN_SESSION_SECRET: z.string().min(1) in production, optional in dev
  - ATTEMPT_TOKEN_SECRET: z.string().min(1) in production, optional in dev
  - RESULT_COOKIE_SECRET: z.string().min(1) in production, optional in dev
  - REPORT_TOKEN_SECRET: z.string().min(1) in production, optional in dev
  - REPORT_WORKER_SECRET: z.string().optional()
  - ALERTS_RUNNER_SECRET: z.string().optional()
  - RATE_LIMIT_SALT: z.string().min(1) in production, optional in dev
  - CONTENT_DATABASE_URL: z.string().optional()
  - CONTENT_SOURCE: z.enum(["fs", "db"]).default("fs")
  - TENANTS_SOURCE: z.enum(["file", "db"]).default("file")
  - OPENAI_API_KEY: z.string().optional()
  - OPENAI_BASE_URL: z.string().url().optional()
  - OPENAI_MODEL: z.string().optional()
  - POSTHOG_HOST: z.string().optional()
  - POSTHOG_SERVER_KEY: z.string().optional()
  - BIGQUERY_PROJECT_ID: z.string().optional()
  - and remaining vars found via grep
- `client` (safe to expose):
  - NEXT_PUBLIC_* vars if any exist
B3) Export a typed `env` object with lazy validation (validate on first access, cache result).
B4) Export `validateEnv()` function that can be called explicitly (e.g., in instrumentation.ts).
B5) Keep dev-friendly defaults for all secrets (matching current behavior).

Task C: Replace all process.env references
C1) Find all `process.env.X` in `apps/web/src/` (excluding test files and next-env.d.ts).
C2) Replace with `env.X` from `@/lib/env`.
C3) For test files: allow direct process.env access in tests that mock env vars (do not break test setup patterns).
C4) Handle `process.env.NODE_ENV` separately: this is special in Next.js and should NOT be routed through the env module.
C5) Handle `process.env.NEXT_PHASE` separately: this is Next.js internal.

Task D: Update .env.example
D1) Update `.env.example` and `.env.production.example` to list all vars with comments explaining which are required in production.

Task E: Verification
E1) `grep -rn "process\.env\." apps/web/src/lib/ apps/web/src/app/ apps/web/src/components/` returns only:
  - `process.env.NODE_ENV` references
  - `process.env.NEXT_PHASE` references
  - test files (*.test.ts)
E2) `pnpm typecheck` passes.
E3) `pnpm test` passes.
E4) `pnpm build` succeeds.
E5) `scripts/ci.sh --scope app` exits 0.

Success criteria
- All env vars are validated through a single module.
- Missing required vars in production throw a clear error message listing all missing vars.
- Dev mode works without any env vars set (sensible defaults).
- `scripts/ci.sh --scope app` exits 0.

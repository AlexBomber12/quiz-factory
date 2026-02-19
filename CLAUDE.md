# CLAUDE.md

Read and follow all rules in AGENTS.md -- it governs all PR workflows.

## Project Overview
- Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS
- Monorepo: apps/web (main app), analytics/dbt (data pipeline)
- Multi-tenant quiz platform with Stripe payments
- Content served from PostgreSQL (with filesystem fallback)
- Admin console at /admin with RBAC tokens

## Key Commands
- `pnpm lint` -- ESLint
- `pnpm typecheck` -- TypeScript strict check
- `pnpm test` -- Vitest unit tests
- `pnpm build` -- Next.js production build
- `pnpm e2e` -- Playwright E2E tests
- `scripts/ci.sh` -- full CI pipeline (lint + typecheck + test + build + python validators)
- `scripts/ci.sh --scope app` -- skip analytics/dbt checks

## Architecture Conventions
- All imports must use path aliases: `@/lib/*`, `@/components/*` (after PR-REFACTOR-01)
- Shared utilities live in `src/lib/utils/` (after PR-REFACTOR-02)
- API routes use `withApiGuards()` wrapper from `@/lib/security/` (after PR-REFACTOR-04)
- Env variables accessed only through `@/lib/env.ts` (after PR-REFACTOR-03)
- Logger: `import { logger } from "@/lib/logger"` -- never bare console.* (after PR-REFACTOR-05)
- Brand colors: use Tailwind tokens (brand-terracotta, brand-teal, brand-navy) (after PR-REFACTOR-06)

## File Structure
- `apps/web/src/app/` -- Next.js app router pages and API routes
- `apps/web/src/lib/` -- business logic, security, analytics, tenants, content
- `apps/web/src/components/ui/` -- shared UI primitives (shadcn/ui based)
- `apps/web/src/studio/` -- internal Template Studio
- `analytics/dbt/` -- dbt models for BigQuery
- `scripts/` -- CI, content tools, deployment
- `tasks/` -- PR task files (immutable during execution)
- `docs/` -- metrics spec, UI guide, ops runbooks

## Testing
- Unit tests: Vitest, co-located as `*.test.ts` next to source
- E2E: Playwright in `apps/web/e2e/`
- Run single test: `pnpm vitest run src/lib/path/to/file.test.ts`
- Visual regression: Playwright golden screenshots

## What NOT to Do
- Never add `process.env.*` directly -- use `@/lib/env.ts`
- Never copy `normalizeString` or similar utils -- import from `@/lib/utils/`
- Never leave empty `catch {}` -- always log with context via `@/lib/logger`
- Never use relative imports deeper than 2 levels -- use `@/` aliases
- Never skip CI -- run `scripts/ci.sh` before claiming success
- Never commit secrets or .env files
- Never modify `tasks/PR-*.md` during execution unless explicitly instructed

PR-REFACTOR-01: TypeScript Path Aliases (@/ imports)

Read and follow AGENTS.md strictly.

Context
- apps/web is a Next.js 16 app-router project in a pnpm monorepo.
- Current imports use relative paths up to 9 levels deep: `from "../../../../../../../lib/security/redirect_base"`.
- No path aliases are configured in tsconfig.json.
- This makes refactoring fragile and imports unreadable.

Goal
- Configure TypeScript path aliases: `@/lib/*`, `@/components/*`, `@/app/*`.
- Replace ALL relative imports deeper than 1 level with alias imports across `apps/web/src/`.
- Ensure Next.js resolves aliases correctly in dev, build, and test.

Workflow rules
- Branch: `pr-refactor-01-path-aliases`
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Run the project test gate locally before committing.

Task A: Configure path aliases
A1) Update `apps/web/tsconfig.json`:
- Add `baseUrl: "."` (or appropriate base).
- Add paths:
  ```json
  {
    "@/lib/*": ["src/lib/*"],
    "@/components/*": ["src/components/*"],
    "@/app/*": ["src/app/*"],
    "@/studio/*": ["src/studio/*"]
  }
  ```
A2) Verify `next.config.ts` does not need changes (Next.js supports tsconfig paths natively).
A3) Verify `vitest.config.ts` resolves aliases (add `resolve.alias` if needed).

Task B: Migrate all imports
B1) Replace all relative imports matching `from "../../..` (3+ levels) in `apps/web/src/` with the corresponding `@/` alias.
B2) Keep relative imports that are 1-2 levels deep (same module, co-located files).
B3) Do NOT change imports in test files that import from the same directory (e.g., `from "./scoring"`).
B4) Do NOT change imports of external packages or `config/` files that live outside `src/`.

Task C: Verification
C1) `pnpm typecheck` passes with zero errors.
C2) `pnpm lint` passes with zero warnings.
C3) `pnpm test` passes (all 87+ test files).
C4) `pnpm build` succeeds.
C5) `scripts/ci.sh --scope app` exits 0.

Success criteria
- Zero relative imports deeper than 2 levels remain in `apps/web/src/`.
- All existing tests pass without modification to test logic.
- `scripts/ci.sh --scope app` exits 0.

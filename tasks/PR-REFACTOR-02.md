PR-REFACTOR-02: Shared Utility Functions (Deduplicate normalizeString and friends)

Read and follow AGENTS.md strictly.

Context
- `normalizeString` is copy-pasted in 20+ files across `apps/web/src/lib/`.
- `parsePositiveInt` is duplicated in 4 files with slightly different return types.
- `parseBoolean` is duplicated in 2 files.
- Base64/Base64URL helpers are duplicated in `admin/session.ts` and `security/attempt_token.ts`.
- Signatures vary: some accept `unknown`, some `string | null | undefined`, some `string | null`.

Goal
- Create a shared utilities module.
- Replace all local definitions with imports from the shared module.
- Ensure type compatibility across all call sites.

Workflow rules
- Branch: `pr-refactor-02-shared-utils`
- Depends on: PR-REFACTOR-01 (path aliases must exist).
- Implement only what this task requests.
- Run the project test gate locally before committing.

Task A: Create shared utility module
A1) Create `apps/web/src/lib/utils/strings.ts` with:
- `normalizeString(value: unknown): string | null` — the broadest signature that covers all use cases.
- `normalizeStringStrict(value: string | null | undefined): string | null` — for call sites that already have a string type.
- `parsePositiveInt(value: string | undefined): number | undefined`
- `parseBoolean(value: string | undefined): boolean | undefined`

A2) Create `apps/web/src/lib/utils/encoding.ts` with:
- `encodeBase64Url(value: string): string`
- `decodeBase64Url(value: string): string`

A3) Create `apps/web/src/lib/utils/index.ts` as barrel export.

Task B: Tests for shared utilities
B1) Create `apps/web/src/lib/utils/strings.test.ts` with comprehensive tests:
- null, undefined, empty string, whitespace-only string, valid string
- numeric edge cases for parsePositiveInt (0, negative, NaN, Infinity, float)
- boolean edge cases (1/0, true/false, yes/no, on/off, empty, garbage)

B2) Create `apps/web/src/lib/utils/encoding.test.ts`:
- round-trip encode/decode
- special characters, unicode

Task C: Replace all local definitions
C1) Find all files containing `const normalizeString` in `apps/web/src/`.
C2) Replace each local definition with `import { normalizeString } from "@/lib/utils/strings"`.
C3) If the local definition has a narrower signature (e.g., `string | null`), use `normalizeStringStrict` or add a type assertion at the call site.
C4) Repeat for `parsePositiveInt`, `parseBoolean`, and base64 helpers.
C5) Remove unused imports after replacement.

IMPORTANT: The file `apps/web/src/lib/analytics/session.ts` exports `normalizeString` publicly. Other files import it from there. Update those imports to use the new shared module instead, then remove the re-export from session.ts (or keep it as a re-export if breaking change is too large).

Task D: Verification
D1) `grep -rn "const normalizeString" apps/web/src/` returns zero results (except the shared module).
D2) `grep -rn "const parsePositiveInt" apps/web/src/` returns zero results (except the shared module).
D3) `pnpm typecheck` passes.
D4) `pnpm test` passes.
D5) `scripts/ci.sh --scope app` exits 0.

Success criteria
- Zero local `normalizeString` definitions remain outside `@/lib/utils/`.
- Zero local `parsePositiveInt` definitions remain outside `@/lib/utils/`.
- All existing tests pass.
- `scripts/ci.sh --scope app` exits 0.

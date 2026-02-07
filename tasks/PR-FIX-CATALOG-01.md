PR-FIX-CATALOG-01: Catalog Metadata Resilience (estimated_minutes without content/test_index.json)

Read and follow AGENTS.md strictly.

Context
- Content is now created and published via Admin WebUI into the Content DB (tests/test_versions/tenant_tests).
- New DB-published tests may not exist in the repo filesystem content index (content/test_index.json).
- The tenant homepage/test list currently relies on content/test_index.json for estimated_minutes and can crash with "Catalog metadata missing..." when a test is not present in that file.
- We want the content pipeline to be fully "no repo edits required" for publishing, and the public site must never crash due to missing repo metadata.

Goal
- Remove the hard dependency on content/test_index.json for catalog rendering.
- Ensure estimated_minutes is always available via:
  1) spec_json field (preferred), OR
  2) a deterministic computed fallback from the test spec (question count).
- Keep filesystem content mode working, but it must not require content/test_index.json either.

Scope boundaries
- Do not change the Content DB schema in this PR.
- Do not change pricing/checkout/report logic except where necessary to preserve compatibility.
- Do not log raw MD content or user answers.

Implementation requirements
1) Add optional estimated_minutes to the test spec type/schema
- Update the shared spec schema/types so estimated_minutes can be stored in spec_json (optional integer, 1..120).
- Ensure existing specs without this field continue to validate (backward compatible).

2) Ensure new imports populate estimated_minutes
- In the Admin import conversion pipeline (MD -> spec_json), set estimated_minutes if not provided:
  - If the MD includes a frontmatter/meta field estimated_minutes, use it (after validation).
  - Otherwise compute it deterministically from the number of questions in the spec:
    - Use a simple, explainable formula and clamp to a safe range (e.g. min 2, max 20).
  - Store the resulting value inside spec_json so it is preserved with the version.

3) Ensure runtime fallback exists everywhere
- Create a single helper (e.g. getEstimatedMinutes(spec)) that:
  - returns spec.estimated_minutes when present and valid
  - otherwise computes the same deterministic fallback from question count
- Use this helper in the catalog builder so it never throws due to missing metadata.
- Remove any runtime reads of content/test_index.json from the public site path (catalog/listing rendering).
- If content/test_index.json is still used for developer tooling, it must be optional and must not affect prod paths.

4) Tests
- Add unit tests for the helper and the catalog builder:
  - when estimated_minutes is missing, catalog generation still succeeds and returns a sensible value
  - when estimated_minutes is present, it is used
- Add a regression test reproducing the current crash scenario (DB-published test without entry in test_index.json) and assert it no longer crashes.

5) Docs
- Update the relevant docs (short note) explaining where estimated_minutes comes from now (spec_json + fallback).

Workflow rules
- Create a new branch from main named: pr-fix-catalog-01-estimated-minutes
- Implement only what this task requests.
- Run the standard local test gate before committing.

Definition of Done
- Tenant homepage and test listing render successfully for tests published via Admin WebUI even if content/test_index.json has no entry for them.
- New Admin imports store estimated_minutes into spec_json (or runtime fallback is used consistently).
- No public runtime path requires content/test_index.json.
- All tests and the project gate pass.
- Commit message: "PR-FIX-CATALOG-01: remove test_index dependency for estimated_minutes"

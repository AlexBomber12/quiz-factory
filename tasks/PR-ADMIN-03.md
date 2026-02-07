PR-ADMIN-03: Convert Import -> spec_json -> Draft Test Version

Read and follow AGENTS.md strictly.

Context
- Imports store raw markdown sources per locale.
- We need to convert an import into a new draft version in test_versions with validated spec_json.
- The project already has Python converters in scripts/content/*.
  - universal_human_md_to_spec.py supports --source-dir with multi-locale files.
- This PR focuses on universal_human_v1 only. Unsupported formats must fail clearly.

Goal
- Add admin actions to:
  - create or find a test (tests table)
  - generate a new draft version (test_versions) from an import
  - validate spec_json with the existing TypeScript validator used by FS loader
- Add admin UI to view the draft version details and a safe preview (read-only).

Non-goals
- Do not publish versions to tenants in this PR.
- Do not switch public site to DB in this PR.

Implementation requirements
- Format detection:
  - require universal_human_v1. Determine it by front matter key "format_id: universal_human_v1" in source.en.md.
  - if missing or different, return a clear error and keep import status unchanged.
- test_id and slug:
  - if front matter provides test_id and slug, use them
  - else derive slug from EN title (slugify) and set test_id = "test-" + slug
  - enforce uniqueness: if slug already exists for a different test, fail with a clear error
- Conversion execution:
  - write import files to a temp directory as source.<locale>.md
  - run python3 scripts/content/universal_human_md_to_spec.py --source-dir <tmp> --out <tmp>/spec.json
  - enforce timeout (15s) and size limits; capture stderr for debugging but do not log raw md
- Validation:
  - parse spec.json and validate using apps/web/src/lib/content/validate.ts
  - compute checksum sha256 of canonical JSON (stable key order) and store it
- DB writes:
  - mark import.status="processed" on success, "failed" with error on failure
  - insert test_versions with version = max(version)+1 per test
  - store source_import_id on test_versions

Workflow rules
- Create a new branch from main named: pr-admin-03-import-to-draft
- Implement only what this task requests.

Definition of Done
- From an import, admin can produce a draft test_version row with spec_json.
- Draft creation is idempotent per (import_id, checksum): repeat calls do not create duplicates.
- Errors are actionable and do not leak raw md in logs.
- scripts/ci.sh --scope app passes.

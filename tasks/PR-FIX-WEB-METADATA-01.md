PR-FIX-WEB-METADATA-01: Fix server-side 500 caused by generateMetadata calling .trim() on undefined

Read and follow AGENTS.md strictly.

Context
- In production, opening /t/<slug> returns HTTP 500.
- Server logs show: TypeError: Cannot read properties of undefined (reading 'trim') inside generateMetadata.
- This should never crash the request. Missing metadata must fall back gracefully.
- This bug blocks running tests and makes the deployment unusable.

Goal
- Make all generateMetadata implementations resilient to missing/partial test metadata.
- Ensure /t/<slug> and /t/<slug>/run do not throw even when metadata fields are missing (title/description/slug/etc.).
- Provide safe fallbacks for metadata fields so pages render instead of 500.
- Add a small regression test (or build-time sanity) so this cannot silently reappear.

Implementation requirements
1) Locate the failing generateMetadata for /t/[slug] (and any other related routes) and remove any direct .trim() on possibly-undefined values.
   - Introduce a small helper, e.g. safeTrim(value, fallback) that returns a string safely.
   - Use safeTrim for title, description, and any other user-facing metadata fields.
2) When test metadata is missing in the index/registry:
   - Use route slug as a fallback slug.
   - Use spec.json title/description if available (or a deterministic default).
   - Never throw; always return valid Metadata.
3) Scan the web app for other generateMetadata implementations that may do unsafe string operations and harden them the same way.
4) Ensure the fix works for both CONTENT_SOURCE=fs and CONTENT_SOURCE=db modes:
   - FS mode: content/tests/<test_id>/spec.json is used and may be missing optional fields.
   - DB mode: metadata may be partially missing depending on published content.
5) Developer experience:
   - Keep the change minimal and targeted.
   - Add a small automated check:
     - Preferred: a unit test that calls the metadata builder with missing fields and asserts it does not throw.
     - If unit tests are not set up, add a tiny script or test that runs in CI and fails if generateMetadata throws for a minimal fixture.

Workflow rules
- Create a new branch from main named: pr-fix-web-metadata-01
- Implement only what this task requests.
- Run the project test gate locally before committing (the repo’s standard scripts).
- Do not commit secrets.

Acceptance criteria (must all pass)
- /t/focus-rhythm returns HTTP 200 in production build when metadata fields are missing or partial.
- /t/focus-rhythm/run returns HTTP 200 in production build.
- No server-side 500 caused by generateMetadata occurs in logs for these routes.
- CI passes (lint + build at minimum).
- A regression guard exists (unit test or CI check) proving missing metadata does not crash generateMetadata.

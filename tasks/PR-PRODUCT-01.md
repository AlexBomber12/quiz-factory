PR-PRODUCT-01: Test Content Format, Registry, and Validation (1 Golden Test EN-ES-PT-BR)

Read and follow AGENTS.md strictly.

Context
- We will operate 200 tenant sites with different languages and audiences.
- Tests are content, not code. We must be able to add tests without touching application logic.
- There are no user accounts. A test attempt is identified by session_id.
- Analytics must not store raw answers or free text. Only derived scores and result keys are allowed.

Goal
- Introduce a versioned, validated test content format stored in the repo.
- Introduce a tenant-to-tests registry so each tenant can have a different test set.
- Add strict CI validation to prevent broken catalogs, missing locales, or invalid specs.
- Add 1 golden test with locales: en, es, pt-BR.

Workflow rules
- Create a new branch from main named: pr-product-01-content-registry
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing.

Task A: Content directory and JSON spec
A1) Create a new directory at repo root:
- content/tests/

A2) Define a JSON test spec format.
- File layout:
  - content/tests/<test_id>/spec.json
- Required top-level fields:
  - test_id (string, format test-<slug>)
  - slug (string, url-safe)
  - version (integer, start at 1)
  - category (string)
  - locales (object keyed by locale tag)
  - questions (array)
  - scoring (object)
  - result_bands (array)

- Locale object must include:
  - title
  - short_description
  - intro
  - paywall_headline
  - report_title

- Question object:
  - id (string)
  - type (only "single_choice" for now)
  - prompt (object keyed by locale tag)
  - options: array of
    - id (string)
    - label (object keyed by locale tag)

- Scoring object:
  - scales: array of scale ids (strings)
  - option_weights: object mapping option_id to an object mapping scale_id to integer weight

- Result bands:
  - band_id (string)
  - min_score_inclusive (integer)
  - max_score_inclusive (integer)
  - copy: object keyed by locale tag, each containing:
    - headline
    - summary
    - bullets (array of strings)

Task B: Loader utilities in the web app
B1) Add loader modules:
- apps/web/src/lib/content/types.ts
- apps/web/src/lib/content/validate.ts
- apps/web/src/lib/content/load.ts

B2) Provide utilities:
- listAllTests(): returns an array of { test_id, slug, category, locales }
- loadTestSpecById(testId): returns the raw spec for internal use
- loadLocalizedTest(testId, locale): returns a localized view with:
  - test_id, slug, category
  - localized strings (title, description, intro)
  - questions with localized prompt and option labels
  - scoring and result_bands unchanged

B3) Validation behavior
- Validation must throw a descriptive error that includes the failing test_id and the first missing path.
- Locale tags must normalize to:
  - "en", "es", "pt-BR" (region uppercased)

Task C: Tenant catalog
C1) Add config/catalog.json
- Structure:
  {
    "tenants": {
      "tenant-xxx": ["test-abc", "test-def"]
    }
  }

C2) Add a validator script:
- scripts/content/validate_catalog.py

It must load:
- config/tenants.json
- config/catalog.json
- content/tests/*/spec.json

Validations:
- Every tenant_id in catalog exists in tenants.json.
- Every referenced test_id exists on disk.
- No duplicates inside each tenant test list.
- test_id uniqueness across all tests.
- slug uniqueness across all tests.
- Every referenced test includes the tenant default locale in its locales keys.
- Each spec.json conforms to the format rules (required fields, types, per-locale strings present).

Exit behavior:
- Exit code 0 when valid.
- Exit code 1 when invalid.
- Print a concise list of errors, one per line.

C3) Wire the validator into scripts/ci.sh
- In run_app(), after tenants validation, add:
  - python3 scripts/content/validate_catalog.py

Task D: Documentation
- Add docs/content/tests.md documenting:
  - directory layout
  - spec fields (short, not a full schema dump)
  - how to add a test
  - what is forbidden in analytics payloads (raw answers, free text)

Task E: Add 1 golden test
- Add 1 test with 8 to 12 questions and 3 result bands.
- Locales must include: en, es, pt-BR.
- Theme must be neutral and non-medical.

Task F: Unit tests
- Add at least 1 vitest test in apps/web that:
  - loads the golden test in each locale
  - asserts question count > 0
  - asserts required localized strings exist

Success criteria
- CI gate passes locally: CI=true scripts/ci.sh
- content catalog validation runs in CI and fails on broken catalog or spec.
- The golden test loads correctly for en, es, pt-BR.
- No secrets are introduced.

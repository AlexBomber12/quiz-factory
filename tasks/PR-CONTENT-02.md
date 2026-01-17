PR-CONTENT-02: Content Factory Tooling (New Test Generator and CSV Import)

Read and follow AGENTS.md strictly.

Context
- PR-PRODUCT-01 introduced content/tests and a validation script.
- We need to add tests fast and safely across multiple locales.
- Manual JSON editing does not scale.

Goal
- Add scripts to generate a new test skeleton and optionally import questions from CSV.
- Make it easy to add tests in batches without breaking CI.

Workflow rules
- Create a new branch from main named: pr-content-02-factory-tooling
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing.

Task A: New test generator
A1) Add a script:
- scripts/content/new_test.py

Usage
- python3 scripts/content/new_test.py --test-id test-<slug> --slug <slug> --locales en es pt-BR --category <category>

Behavior
- Create directory content/tests/<test_id>/
- Create spec.json with:
  - required top-level fields
  - empty questions array
  - placeholder result_bands with 3 bands
  - locales scaffolded with placeholder strings
- Fail if the test_id already exists.

Task B: CSV question importer
B1) Add a script:
- scripts/content/import_questions_csv.py

Usage
- python3 scripts/content/import_questions_csv.py --test-id test-<slug> --csv <path>

CSV format (required columns)
- question_id
- option_id
- prompt_en
- prompt_es
- prompt_pt_br
- option_label_en
- option_label_es
- option_label_pt_br
- weight (integer)

Behavior
- Append or replace questions in spec.json.
- Populate scoring.option_weights using the provided weight under a single scale id "score".
- Validate the resulting spec using the same rules as validate_catalog.py.

Task C: Documentation
C1) Add docs/content/factory.md
- How to create a new test
- How to import questions
- Common pitfalls

Task D: CI
D1) Ensure scripts/content/validate_catalog.py continues to be the single enforcement gate.
- Do not weaken validation.

Task E: Tests
E1) Add minimal unit tests for the scripts.
- Use a temp directory fixture and verify generated files exist and are valid.

Success criteria
- scripts/ci.sh passes.
- A new test can be generated and validated without manual edits.
- CSV import produces a valid spec and passes validation.

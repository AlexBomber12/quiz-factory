PR-CONTENT-04: universal_human_v1 Converter + content_add Support (No Attachments)

Read and follow AGENTS.md strictly.

Context
- The repo has a content add pipeline (content_add.py or scripts/content/content_add.py) that currently supports values_compass_v1 only.
- I cannot attach files in Codex. Source inputs must be read from the repo filesystem.
- I am using UNIVERSAL-TEST-TEMPLATE.md to generate new tests in markdown for 3 locales.
- Current failure: content_add expects values_compass sections/30 questions/values, but source files are universal.

Goal
- Add support for universal_human_v1 so content_add can convert universal sources into a spec.json and proceed to catalog validation, CI, and review artifacts.
- Keep values_compass_v1 behavior unchanged.

Workflow rules
- Create a new branch from main named: pr-content-04-universal-converter
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing.

A) Source placement (no attachments)
- Standardize source locations:
  - content/sources/<test_id>/source.en.md
  - content/sources/<test_id>/source.es.md
  - content/sources/<test_id>/source.pt-BR.md
- content_add must read from this location by default.

B) universal_human_v1 input contract (must be machine-readable)
- For universal_human_v1 sources, require YAML front matter at the top of each source.<locale>.md:
  - format_id: universal_human_v1
  - test_id: test-<slug>
  - slug
  - version
  - category
  - primary_locale
  - locales: [en, es, pt-BR]
  - question_type: likert_5
  - scoring_model: multi_scale
  - scales: [SCALE_ID_1, SCALE_ID_2, ...]
  - missing_policy: required_all
- Fail fast with a clear error if front matter is missing, invalid, or inconsistent across locales.

- For universal_human_v1 sources, require a machine-readable Questions section in each locale file.
  - Each question block must use exactly:
    - QID: q01
    - Scale: <scale_id>
    - Prompt: <localized prompt text for this locale>
  - There must be exactly question_count blocks.
  - question ids must be q01..qNN with zero padding.

C) Add a universal converter
C1) Add scripts/content/universal_human_md_to_spec.py
- Input:
  - path to content/sources/<test_id>/ (contains the 3 source files)
- Output:
  - content/tests/<test_id>/spec.json

- The converter must:
  - parse YAML front matter for each locale source
  - validate consistency across locales (same test_id, slug, version, category, question_count, scales)
  - parse UI copy sections from the markdown body for each locale:
    - Title
    - Short description
    - Intro
    - Instructions
    - Paywall hook
    - Paid report structure
    If a section is not present, store an empty string and let validate_catalog fail if it is required.
  - parse Questions blocks for each locale
  - merge the 3 locales into 1 spec.json that includes:
    - format_id: universal_human_v1
    - test_id, slug, version, category
    - locales: { en: {...}, es: {...}, pt-BR: {...} }
    - scales: list of scale_id
    - questions: array of
      - question_id
      - scale_id
      - prompt: object keyed by locale
    - scoring:
      - model: multi_scale
      - missing_policy
    - monetization placeholders:
      - price_eur_single
      - pack_options

- No raw answers or free text response storage fields may be introduced.
- Do not log the markdown body or prompts.

C2) Add a small fixture under content/sources/ for a tiny universal test (2 scales, 4 questions) and ensure converter produces spec.json in tests.

D) Update content_add pipeline
D1) Ensure there is a stable entrypoint command:
- python3 content_add.py ...

If the repo currently uses scripts/content/content_add.py, keep it, but also provide a thin repo-root content_add.py wrapper that forwards to the scripts version.

D2) Extend content_add to support:
- --format universal_human_v1

Behavior for universal_human_v1:
- read sources from content/sources/<test_id>/
- run universal_human_md_to_spec.py
- update config/catalog.json to add test_id under the provided --tenant-id (append if missing)
- run scripts/content/validate_catalog.py

Keep existing values_compass_v1 behavior unchanged.

E) Update validate_catalog.py
- Extend validation to handle 2 formats based on spec.json format_id:
  - values_compass_v1: keep strict existing checks
  - universal_human_v1: enforce minimal strict rules:
    - required locales exist
    - question_count matches number of questions
    - qids unique and match q01..qNN
    - each question scale_id is in scales
    - tenant default_locale exists in locales

F) Place the universal template in the repo
- Add docs/content/templates/UNIVERSAL-TEST-TEMPLATE.md
- Add a short note at the top of the template describing the machine-readable Questions block required by the universal_human_v1 converter (QID, Scale, Prompt).

G) Docs and tests
- Add or update docs/content/factory.md to describe:
  - where to place sources
  - required YAML front matter
  - how to run content_add for both formats
- Add minimal tests for the converter and validator.

Success criteria
- content_add succeeds for values_compass_v1 exactly as before.
- content_add succeeds for universal_human_v1 for the included tiny fixture.
- validate_catalog.py passes for valid specs and fails with clear errors for invalid specs.
- scripts/ci.sh passes.

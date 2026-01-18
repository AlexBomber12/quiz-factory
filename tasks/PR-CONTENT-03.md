PR-CONTENT-03: Universal Test Template in Repo + Values Compass MD Converter + CONTENT ADD Runbook (No Attachments)

Read and follow AGENTS.md strictly.

Context
- The user cannot attach files to Codex. Source inputs must already exist inside the repo working tree.
- We want a repeatable pipeline to add a new test as content without editing tasks/QUEUE.md for every test.
- We will store human-authored sources (Markdown) and machine-consumed specs (JSON) in repo.

Goal
- Add docs/content/templates/UNIVERSAL-TEST-TEMPLATE.md to the repo.
- Add a canonical sources path for user-supplied Markdown per test.
- Add a deterministic converter for Values Compass style sources (3 locales) into content/tests/<test_id>/spec.json.
- Add a new AGENTS work mode: Run CONTENT ADD: <test_id>.
- Add an orchestrator script that runs conversion + validation + catalog update using only files on disk.

Repository layout to introduce
- docs/content/templates/UNIVERSAL-TEST-TEMPLATE.md
- content/sources/<test_id>/source.en.md
- content/sources/<test_id>/source.es.md
- content/sources/<test_id>/source.pt-BR.md
- content/tests/<test_id>/spec.json
- scripts/content/values_compass_md_to_spec.py
- scripts/content/content_add.py

Workflow rules
- Create a new branch from main named: pr-content-03-content-add-pipeline
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run scripts/ci.sh and ensure it exits 0.
- Generate artifacts via scripts/make-review-artifacts.sh.

Task A: Add universal template to repo
A1) Create docs/content/templates/ and add UNIVERSAL-TEST-TEMPLATE.md.
Input note: the file may already exist in the working tree at repo root as UNIVERSAL-TEST-TEMPLATE.md. If so, copy it into docs/content/templates/.
A2) Add docs/content/templates/README.md describing how templates are used by humans and LLMs.

Task B: Canonical sources folder (no attachments)
B1) Create content/sources/README.md describing:
- for each test_id create folder content/sources/<test_id>/
- put 3 locale files:
  - source.en.md
  - source.es.md
  - source.pt-BR.md
- do not put secrets or PII
B2) Add a .gitkeep if required by the repo conventions.

Task C: Values Compass converter
C1) Add scripts/content/values_compass_md_to_spec.py

Requirements
- CLI args:
  - --test-id
  - --slug
  - --category
  - --version
  - --en
  - --es
  - --ptbr
  - --out
- The script must be deterministic, offline, and safe to run in CI.
- It must parse 3 locale Markdown files and extract:
  - title, short description, intro, instructions
  - 30 statements in order
  - 10 value dimensions with names and definitions
  - conflict pairs
  - preview and paid copy blocks per value
  - preview template, paywall hook, paid report structure
- The output JSON at --out must conform to the repo test spec schema used by scripts/content/validate_catalog.py.
- Stable IDs:
  - questions: q01..q30
  - options: q01_1..q01_5 (5 per question, unique option ids)
  - values: stable value_id mapping (explicit mapping table in code)
- Locale coverage must be strict. Any missing localized string must fail with a clear error.
- Do not emit raw answers or any PII fields.

C2) Add minimal fixtures under scripts/content/fixtures/values_compass/
- en.md
- es.md
- pt-BR.md

C3) Add a unit test script
- scripts/content/test_values_compass_md_to_spec.py

The test must:
- run the converter on fixtures
- load the generated JSON
- assert:
  - 30 questions exist
  - each question has 5 options
  - 3 locales are present

C4) Wire the unit test into scripts/ci.sh
- Add python3 scripts/content/test_values_compass_md_to_spec.py to the app CI path.

Task D: Orchestrator script for content add
D1) Add scripts/content/content_add.py

Requirements
- Offline script, no network.
- CLI:
  - --format values_compass_v1
  - --test-id <test_id>
  - --tenant-id <tenant_id>
  - optional --slug, --category, --version
- Input file locations are fixed (no attachments):
  - content/sources/<test_id>/source.en.md
  - content/sources/<test_id>/source.es.md
  - content/sources/<test_id>/source.pt-BR.md
- If any source file is missing, fail with a clear error telling the exact expected path.
- Output file:
  - content/tests/<test_id>/spec.json
- Behavior:
  1) Ensure output directory exists.
  2) Run values_compass_md_to_spec.py with the provided args and fixed source paths.
  3) Update config/catalog.json by appending test_id to tenants[tenant_id] if not present.
  4) Print a short summary of what was written or updated.
- Idempotency:
  - Re-running with the same inputs must produce identical spec.json (byte-for-byte) and must not duplicate test_id in catalog.

Task E: AGENTS new work mode (no attachments)
E1) Update AGENTS.md
- Add a new trigger phrase:
  - Run CONTENT ADD: <test_id>
- Add a CONTENT ADD Runbook section.

CONTENT ADD Runbook requirements
- Preflight: git status must be clean.
- Branch name:
  - content-add-YYYYMMDD-<short-slug>
- Inputs:
  - The user places Markdown sources inside content/sources/<test_id>/ as described in Task B.
  - The agent must not request attachments.
- Steps:
  1) Validate sources exist for test_id.
  2) Run python3 scripts/content/content_add.py --format values_compass_v1 --test-id <test_id> --tenant-id <tenant_id> plus any required metadata flags.
  3) Run python3 scripts/content/validate_catalog.py.
  4) Run scripts/ci.sh until exit 0.
  5) Generate artifacts via scripts/make-review-artifacts.sh.
  6) Commit and push, open PR if possible.
- Rules:
  - Do not edit tasks/QUEUE.md.
  - Do not create tasks/PR-*.md.
  - Only modify content, catalog, and derived spec files.

Task F: Documentation
F1) Add docs/content/content_add.md
It must document:
- Where to place sources (content/sources/<test_id>/source.<locale>.md)
- How to run the converter manually
- How to run the orchestrator script
- How to use Run CONTENT ADD mode in Codex
- How to add a new converter format in the future

Success criteria
- scripts/ci.sh passes.
- docs/content/templates/UNIVERSAL-TEST-TEMPLATE.md exists and is tracked in git.
- values_compass_md_to_spec.py and content_add.py exist, are deterministic, and have basic tests.
- validate_catalog.py plus the new unit test runs in CI.
- AGENTS.md contains the new Run CONTENT ADD mode and it does not require attachments.

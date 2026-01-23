PR-CONTENT-05: Localization Quality Lint (EN vs ES vs PT-BR) + Golden Test Fix

Read and follow AGENTS.md strictly.

Context
- The content factory supports multi-locale test specs.
- For initial development, ES and PT-BR content is often a placeholder copy of EN, which is not acceptable for launch.
- We need an automated guardrail to prevent accidentally shipping identical translations.

Goal
- Add a locale quality linter and make the golden test pass with native translations.

Scope
1) Add a new script: scripts/content/lint_locales.py (or Node equivalent, choose whatever the repo uses more).
- Inputs: content test specs directory and required locales.
- Check at least these fields per locale:
  - test title and short description
  - question prompts
  - answer option labels
  - result profile titles and key paragraphs
- Flag problems when:
  - a non-EN locale string is exactly equal to EN
  - or when similarity is above a configurable threshold (default 0.95) using a lightweight string similarity method.
- Provide allowlist rules for:
  - numbers, punctuation, short tokens
  - known technical terms (EPC, RFID, etc) if they appear in shared content.
- Output must be CI-friendly and list file paths and offending keys.

2) Wire the lint into CI
- Add the lint script to the existing content validation pipeline.
- Ensure the CI fails if lint fails.

3) Fix golden content
- Update 1 golden test spec to have real, native ES and PT-BR copy for all checked fields.
- Keep tone: modern, non-formal, non-medical, no diagnosis claims.

Constraints
- Do not introduce new runtime dependencies that are heavy.
- Keep the linter fast.

Workflow rules
- Create a new branch from main named: pr-content-05-locale-lint
- Implement only what this task requests.
- Run the project test gate per AGENTS.md.

Definition of Done
- Running the lint script locally succeeds on the repo content.
- CI runs the lint script and fails when ES or PT-BR is a copy of EN.
- The golden test has native ES and PT-BR text and passes lint.
- All tests and lint pass and the PR is ready to merge.

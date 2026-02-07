PR-ADMIN-02: Upload Bundle (Multi-locale MD) to Imports + Preview

Read and follow AGENTS.md strictly.

Context
- We need a WebUI to upload test sources (multiple markdown files, one per locale).
- Uploaded sources must be stored in DB (imports.files_json) and previewed before conversion and publish.

Goal
- Add an admin UI flow to create an import:
  - /admin/imports/new: upload files (multiple source.<locale>.md)
  - /admin/imports/[id]: preview import (locales, titles, warnings)
- Add API routes under /api/admin to:
  - create an import record
  - read an import record

Non-goals
- Do not convert MD to spec_json in this PR.
- Do not publish anything in this PR.
- Do not modify public site routes.

Implementation requirements
- Upload parsing:
  - use Next.js route handler request.formData()
  - accept only files with names matching source.<locale>.md where locale is like en, es, pt-BR, fr, de, etc
  - enforce limits:
    - max_total_bytes 2_000_000
    - max_files 30
- Storage:
  - create imports row with status="uploaded"
  - store files_json as jsonb: locale -> { filename, md, sha256 }
  - compute sha256 server-side for each file and store it
- Preview:
  - extract title from each MD as the first H1 line, fallback to first non-empty line
  - show warnings if:
    - required locales (en, es, pt-BR) missing
    - duplicate md hash across locales
  - do not render raw markdown as HTML in admin preview (avoid XSS); show escaped text excerpts.

Workflow rules
- Create a new branch from main named: pr-admin-02-import-upload-preview
- Implement only what this task requests.

Definition of Done
- Admin can upload a bundle and get an import id.
- /admin/imports/[id] shows locales, filenames, size, sha256, title guess, warnings.
- imports are stored in Postgres and retrievable.
- scripts/ci.sh --scope app passes.

PR-REPORT-02: Server-side PDF Generation and Caching (Feature-flagged)

Read and follow AGENTS.md strictly.

Context
- The current PDF flow is client-side print-to-PDF. It is lightweight but inconsistent across devices.
- We want an optional server-side PDF generator for paid reports that produces stable output and caches results.

Goal
- Add server-side PDF generation behind a feature flag, with caching to object storage or filesystem (choose the simplest already-supported storage in the repo).

Scope
1) Feature flag
- Add env var REPORT_PDF_MODE with values client or server. Default must remain client.

2) PDF generation
- Implement server mode using Playwright (or another existing headless renderer already used in the repo; do not introduce a new tool if one already exists).
- Rendering target must be the existing print-friendly report route.
- Ensure the renderer can access the report using an internal token or existing entitlement mechanism without exposing secrets.

3) Caching
- Cache key: tenant_id + test_id + report_key + locale + report_template_version.
- Store cached PDF in object storage if already present (S3 compatible). If no storage exists, implement filesystem cache under a configurable directory with TTL cleanup.
- Subsequent downloads should hit cache and avoid regeneration.

4) Analytics
- Keep existing report_pdf_download event. Ensure it still fires for cached downloads.

5) Docs
- Add docs/ops/pdf.md explaining how to enable server mode, required dependencies, and limitations.

Constraints
- Do not change the default user experience unless REPORT_PDF_MODE=server.
- Do not include user raw answers in PDF cache keys or paths.
- Keep performance acceptable and avoid long blocking requests; if generation is slow, add a simple async job queue only if the repo already has one.

Workflow rules
- Create a new branch from main named: pr-report-02-pdf-server
- Implement only what this task requests.
- Run the project test gate per AGENTS.md.

Definition of Done
- In client mode, behavior is unchanged.
- In server mode, /api/report/pdf returns a real PDF and caches it.
- Repeated downloads are cache hits.
- report_pdf_download is emitted in both modes.
- Docs exist and tests and lint pass.

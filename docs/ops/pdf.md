# Server-side PDF generation

This repo supports two report PDF modes:

- `client` (default): the browser navigates to `/report/<slug>/print` and relies on the user agent to print to PDF.
- `server`: `/api/report/pdf` renders the print page with Playwright and returns a real PDF.

## Enable server mode

Set the following environment variable on the web app:

```bash
REPORT_PDF_MODE=server
```

If `REPORT_PDF_MODE` is unset or invalid, the app falls back to `client` mode.

## Playwright requirements

The server renderer depends on Playwright and a Chromium browser build.

Install Chromium for the web workspace:

```bash
pnpm --filter @quiz-factory/web exec playwright install chromium
```

On fresh Linux hosts, Playwright may also need OS dependencies:

```bash
pnpm --filter @quiz-factory/web exec playwright install-deps chromium
```

## Caching

Server mode caches PDFs on the filesystem.

Environment variables:

- `REPORT_PDF_CACHE_DIR`: Filesystem directory for cached PDFs. Default: `<repo>/.cache/report-pdf`
- `REPORT_PDF_CACHE_TTL_SECONDS`: Cache TTL in seconds. Default: `86400` (24 hours)
- `REPORT_PDF_TEMPLATE_VERSION`: Manual cache-busting seed for template changes. Default: `1`

Cache keys include:

- `tenant_id`
- `test_id`
- `report_key` (`tenant_id:test_id:session_id`)
- `locale`
- `report_template_version` (`REPORT_PDF_TEMPLATE_VERSION-<spec.version>`)

To clear cached PDFs, delete the cache directory.

## Limitations

- Rendering is synchronous inside `/api/report/pdf`.
- This is intended for paid reports where caching keeps repeated downloads fast.
- For high-volume workloads, consider introducing an async job queue (none exists in this repo today).

PR-PRODUCT-07: Print-Friendly Report and PDF Download Tracking

Read and follow AGENTS.md strictly.

Context
- PR-PRODUCT-06 renders a paid HTML report at /report/[slug].
- We want a lightweight PDF flow without server-side PDF generation.
- Analytics already includes report_pdf_download event via POST /api/report/pdf.

Goal
- Add a print-friendly report route that works well on mobile and desktop.
- Add a "Save as PDF" action that emits report_pdf_download and triggers browser print.

Workflow rules
- Create a new branch from main named: pr-product-07-print-report
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing.

Task A: Print route
A1) Add a new route:
- apps/web/src/app/report/[slug]/print/page.tsx

Behavior
- Verify REPORT_TOKEN and RESULT_COOKIE (same rules as the main report).
- Render the report content using a print-friendly layout.
- Add print CSS:
  - hide navigation and buttons
  - ensure readable font sizes
  - avoid page breaks inside bullet lists when possible

Task B: Save as PDF button
B1) Update the main report page UI to include a client button "Save as PDF".

Behavior
- On click:
  1) POST /api/report/pdf with:
     - test_id
     - purchase_id
  2) Navigate to /report/[slug]/print
  3) Trigger window.print() (either automatically on the print page or via a user action)

Task C: Tests
C1) Add minimal unit tests for the button behavior.
- Mock fetch and verify /api/report/pdf is called with purchase_id.

Success criteria
- scripts/ci.sh passes.
- A paid user can click "Save as PDF" and the browser print dialog opens.
- report_pdf_download is emitted with purchase_id.

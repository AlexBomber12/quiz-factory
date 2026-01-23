PR-REPORT-01: Paid Report UX Upgrade (Mobile First, Trust, Upsell)

Read and follow AGENTS.md strictly.

Context
- The paid report route exists and is accessible after checkout confirmation.
- The report is the product. It must look credible, be easy to read on mobile, and clearly justify the price.
- We already have analytics events for report_view, report_pdf_download, and upsell_*.

Goal
- Improve the paid report rendering and UX without changing business logic:
  - Better visual hierarchy, spacing, and typography (Tailwind + shadcn/ui).
  - Clear sections: Summary, Scores, Interpretation, Next steps, Disclaimer.
  - Make it print-friendly; keep existing print route working.
  - Add an upsell block that routes back to paywall with a preselected pack offer and emits upsell_view/upsell_accept.

Scope
1) Report layout and components
- Refactor the report page into reusable components, for example:
  - ReportHeader (test title, locale, date)
  - ReportSummary (top insights)
  - ScoreSection (per-scale or per-profile visualization)
  - InterpretationSection (what it means)
  - NextStepsSection (neutral, non-medical)
  - DisclaimerSection (not medical diagnosis)
- Use shadcn/ui primitives where appropriate (Card, Badge, Separator, Button).
- Avoid adding new design systems; follow existing theme tokens.

2) Data binding
- Use the existing report data structure already produced by scoring.
- Do not add raw answers to the report.
- If a field is missing in the result payload, display a safe fallback and log nothing sensitive.

3) Upsell block
- Add a block near the end of the report:
  - Shows remaining credits (if available) or suggests a pack.
  - Button "Get more reports" that sends upsell_view on render and upsell_accept on click.
  - Clicking routes to the paywall with query param offer_key=pack5 (or your default pack).

4) QA
- Verify the report works on:
  - mobile viewport
  - desktop
  - print route

Constraints
- Do not change payment, entitlement, or credits logic in this PR.
- Do not add new event names to analytics/events.json.
- Do not introduce new heavy dependencies.

Workflow rules
- Create a new branch from main named: pr-report-01-ux
- Implement only what this task requests.
- Run the project test gate per AGENTS.md.

Definition of Done
- The paid report page has a clear, polished structure and is readable on mobile.
- The print version still works.
- upsell_view and upsell_accept are emitted appropriately and route back to paywall.
- No raw answers are rendered or logged.
- Tests and lint pass and the PR is ready to merge.

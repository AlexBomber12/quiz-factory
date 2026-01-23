PR-PROD-04: Shareable Report Links (Signed Access Token, No Accounts)

Read and follow AGENTS.md strictly.

Context
- Credits and entitlements are stored in signed cookies. This keeps the product simple, but makes cross-device access hard.
- We want a safe way for a user to reopen a paid report from another browser or device without creating an account.

Goal
- Implement shareable report links with a signed access token:
  - Token allows access to exactly 1 report (report_key scoped) for a limited time window (for example 7 days).
  - Token contains no raw answers and no PII.
  - The token can be embedded in the URL as a query param, for example /report/[slug]?t=...

Scope
1) Token format and signing
- Create a module, for example apps/web/src/lib/report_link_token.ts:
  - issueReportLinkToken({tenant_id, test_id, report_key, locale, expires_at})
  - verifyReportLinkToken(token) -> payload or error
- Use the existing signing secret mechanism already used for attempt_token or credits cookie.

2) Report route support
- Update the report route and/or report render API to accept token from query param.
- If token is valid and not expired and matches the requested report_key, allow rendering even if credits cookie is missing.
- Keep existing entitlement checks for normal cookie-based access.

3) UI
- Add a "Copy report link" button on the report page that copies the tokenized URL.
- Emit an existing event name (share_click) for this action; do not add new event names.

4) Abuse controls
- Ensure token verification is rate-limited by existing route guards.
- Keep token TTL short enough to reduce abuse.

Constraints
- No email sending in this PR.
- No database or user accounts.
- Do not expose internal Stripe IDs in the token.

Workflow rules
- Create a new branch from main named: pr-prod-04-report-links
- Implement only what this task requests.
- Run the project test gate per AGENTS.md.

Definition of Done
- A report link generated in one browser opens the same report in another browser within TTL.
- The link cannot be used to access other reports.
- Token contains no PII and no raw answers.
- share_click is emitted when copying the link.
- Tests and lint pass and the PR is ready to merge.

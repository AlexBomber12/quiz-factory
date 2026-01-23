PR-PROD-03: Credit Packs Without Accounts (Signed Cookie Ledger)

Read and follow AGENTS.md strictly.

Context
- Paywall offers include single and pack options, but entitlement currently only covers a single report attempt.
- We want pack5/pack10 to be real value: the user can open multiple paid reports over time without creating an account.
- Keep it simple and privacy-friendly.

Goal
- Implement credit-based entitlements without accounts:
  - After successful checkout confirmation, grant credits based on the purchased offer:
    - single_intro_149: +1 credit
    - pack5: +5 credits
    - pack10: +10 credits
  - Store the credit state per tenant in a signed httpOnly cookie (no database in this PR).
  - Each paid report access consumes 1 credit unless that specific report was already consumed before (idempotent re-open).
  - UI shows remaining credits on paywall and on the report.

Constraints
- No database or user accounts in this PR.
- No raw answers storage. No PII in cookies.
- Keep production security behavior unchanged (allowlist, rate limiting, webhook signature verification).

Implementation notes
- Create a module for credits, for example apps/web/src/lib/credits.ts:
  - parseCreditsCookie(reqCookies, tenant_id) -> state
  - serializeCreditsCookie(state) -> cookie value
  - grantCredits(state, credits, grant_id) -> new state
  - consumeCreditForReport(state, report_key) -> {new_state, consumed: bool}
- Use existing signing utilities already used for attempt_token or report_token. Do not log cookie payloads.
- Keep cookie payload small:
  - store only per-tenant credits_remaining and a list of consumed report keys (cap the list length to a safe max, at least 20).
  - store grant history only if needed for idempotency; otherwise keep a set of consumed report keys.
- Define report_key deterministically, using tenant_id + test_id + the attempt/session identifier already used by the report.
- Wire it into the existing flow:
  - In checkout confirmation: determine credits granted from offer_key (from Stripe session metadata) and update the credits cookie.
  - In paid report render: before rendering, check credits cookie and consume 1 credit if this report_key has not been consumed yet.
  - If no credits available and report not previously consumed, return 402 or redirect to paywall.
- Emit analytics props (do not break the contract):
  - On checkout confirm: credits_granted, credits_balance_after
  - On report_view: consumed_credit, credits_balance_after
- Add unit tests for credits module (grant, consume, idempotent reopen, cap behavior).

Workflow rules
- Create a new branch from main named: pr-prod-03-credits
- Implement only what this task requests.
- Run the project test gate per AGENTS.md.

Definition of Done
- Buying pack5 allows opening 5 distinct paid reports without re-paying in the same browser and tenant.
- Reopening an already paid report does not consume an additional credit.
- Buying single still works as before.
- When credits are exhausted, a new report is blocked and the user is sent to paywall.
- Tests and lint pass and the PR is ready to merge.

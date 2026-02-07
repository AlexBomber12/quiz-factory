PR-LLM-REPORT-01: Report Job Pipeline (Attempt Summary, Jobs Table, Enqueue, Internal Runner)

Read and follow AGENTS.md strictly.

Context
- Paid report currently renders from the static test result bands.
- We want the paid report to be generated once (post-checkout) and stored as an immutable artifact.
- Background generation needs durable inputs. We cannot store raw answers, but we can store the scored summary (band_id + scale_scores) which is non-PII.

Goal
- Persist a non-PII attempt summary (band_id + scale_scores) in the content DB.
- Add report job tables to track generation state.
- Enqueue a report generation job on purchase confirmation.
- Provide an internal endpoint that can process queued jobs (generator will be implemented in later PRs).

Non-goals
- Do not call any external LLM yet.
- Do not change public report UI or PDF generation yet.
- Do not store raw answers.

Workflow rules
- Create a new branch from main named: pr-llm-report-01-job-pipeline
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing.

Task A: Content DB migration
A1) Add a new numbered migration under apps/web/src/lib/content_db/migrations.
- Filename: 0003_attempt_summaries_and_report_jobs.sql
- Create table attempt_summaries
  - tenant_id text NOT NULL
  - test_id text NOT NULL
  - session_id text NOT NULL
  - distinct_id text NOT NULL
  - locale text NOT NULL
  - computed_at timestamptz NOT NULL
  - band_id text NOT NULL
  - scale_scores jsonb NOT NULL
  - total_score integer NOT NULL
  - PRIMARY KEY (tenant_id, test_id, session_id)
  - Index on (tenant_id, session_id)
- Create table report_jobs
  - id uuid PRIMARY KEY DEFAULT gen_random_uuid()
  - purchase_id text NOT NULL UNIQUE
  - tenant_id text NOT NULL
  - test_id text NOT NULL
  - session_id text NOT NULL
  - locale text NOT NULL
  - status text NOT NULL CHECK (status IN ('queued', 'running', 'ready', 'failed'))
  - attempts integer NOT NULL DEFAULT 0
  - last_error text
  - created_at timestamptz NOT NULL DEFAULT now()
  - updated_at timestamptz NOT NULL DEFAULT now()
  - started_at timestamptz
  - completed_at timestamptz
  - Index on (status, updated_at)
- Create table report_artifacts
  - id uuid PRIMARY KEY DEFAULT gen_random_uuid()
  - purchase_id text NOT NULL UNIQUE
  - tenant_id text NOT NULL
  - test_id text NOT NULL
  - session_id text NOT NULL
  - locale text NOT NULL
  - style_id text NOT NULL
  - model text NOT NULL
  - prompt_version text NOT NULL
  - scoring_version text NOT NULL
  - report_json jsonb NOT NULL
  - created_at timestamptz NOT NULL DEFAULT now()

A2) Add updated_at trigger for report_jobs
- Reuse the existing set_updated_at() function if present, otherwise add a local trigger for report_jobs.

Task B: Repo helpers
B1) Add a small repo module for attempt summaries.
- Create: apps/web/src/lib/report/attempt_summary_repo.ts
- Functions:
  - upsertAttemptSummary(input)
  - getAttemptSummary(tenantId, testId, sessionId)
- Use getContentDbPool().
- Ensure JSON encoding for scale_scores is stable.

B2) Add a repo module for report jobs.
- Create: apps/web/src/lib/report/report_job_repo.ts
- Functions:
  - enqueueReportJob(input) using ON CONFLICT (purchase_id) DO NOTHING
  - getReportJobByPurchaseId(purchaseId)
  - claimQueuedJobs(limit) using FOR UPDATE SKIP LOCKED and setting status=running
  - markJobFailed(purchaseId, error)
  - markJobReady(purchaseId)

Task C: Persist attempt summary at score-preview
C1) Update /api/test/score-preview to persist the scored summary.
- File: apps/web/src/app/api/test/score-preview/route.ts
- After scoring succeeds, call upsertAttemptSummary with:
  - tenant_id, test_id, session_id, distinct_id, locale
  - computed_at (use the same value used for the result cookie)
  - band_id, scale_scores, total_score
- Locale should match the locale used to load the test (default locale is acceptable for now).
- Fail-safe: if DB write fails, do not break the endpoint; continue returning the score-preview response.

Task D: Enqueue job on checkout confirm
D1) Update /api/checkout/confirm to enqueue a report job when the purchase is confirmed.
- File: apps/web/src/app/api/checkout/confirm/route.ts
- Only enqueue when the grant is not already applied.
- Enqueue payload uses:
  - purchase_id, tenant_id, test_id, session_id, locale
- Status should start as queued.
- Fail-safe: if enqueue fails, do not break checkout confirm.

Task E: Internal runner endpoint
E1) Add /api/internal/report-jobs/run
- Route: apps/web/src/app/api/internal/report-jobs/run/route.ts
- Auth:
  - Require header x-worker-secret matching env REPORT_WORKER_SECRET.
  - If missing or mismatch, return 401.
- Behavior:
  - Claim up to ?limit=5 queued jobs.
  - For each claimed job:
    - Verify attempt_summaries exists for (tenant_id, test_id, session_id).
    - If missing, mark failed with last_error="attempt summary missing" and increment attempts.
    - Otherwise, mark failed with last_error="report generator not implemented" and increment attempts.
  - Return JSON with counts: claimed, failed, ready.

Task F: Tests
F1) Add unit tests for pure helpers used by repos.
- Create: apps/web/src/lib/report/report_job_inputs.ts
  - Export pure validators/sanitizers used by the route code.
- Add: apps/web/src/lib/report/report_job_inputs.test.ts
  - Verify invalid inputs are rejected.
  - Verify scale_scores serialization is stable (sorted keys).

Success criteria
- scripts/ci.sh exits 0.
- score-preview continues to work and sets RESULT_COOKIE.
- attempt_summaries is written opportunistically.
- checkout confirm enqueues report_jobs without breaking the happy path.
- internal runner endpoint is protected by REPORT_WORKER_SECRET.

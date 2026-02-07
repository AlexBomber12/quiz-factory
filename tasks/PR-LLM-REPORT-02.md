PR-LLM-REPORT-02: Report Brief Builder (Deterministic Aggregates for LLM Input)

Read and follow AGENTS.md strictly.

Context
- attempt_summaries now stores non-PII scored data (band_id, scale_scores, total_score).
- The LLM report should never receive raw answers. It should receive a compact, deterministic brief.
- The brief will be the single input to the report generator in later PRs.

Goal
- Implement a deterministic ReportBrief builder using:
  - published test spec
  - attempt_summaries record
- The brief must be stable for the same input and safe to log/store.

Non-goals
- Do not call any external LLM yet.
- Do not change report rendering.

Workflow rules
- Create a new branch from main named: pr-llm-report-02-report-brief
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing.

Task A: Types
A1) Add ReportBrief types.
- Create: apps/web/src/lib/report/report_brief.ts
- Export:
  - type ReportBrief
  - type BriefScale
  - const SCORING_VERSION = "v1"

ReportBrief fields
- tenant_id
- test_id
- slug
- locale
- computed_at_utc
- band_id
- total_score
- scales: BriefScale[]
- top_scales: BriefScale[] (top 3)

BriefScale fields
- scale_id
- raw_score
- normalized_score_0_100 (integer)

Task B: Normalization
B1) Implement scale normalization without needing manual ranges.
- Add helper: apps/web/src/lib/report/scale_normalization.ts
- Compute per scale:
  - max_possible = sum over questions of max weight for that scale across options
  - min_possible = sum over questions of min weight for that scale across options
  - normalized = round( (raw - min) / (max - min) * 100 )
- Clamp to [0, 100].
- If max == min, fall back to 50.

Task C: Brief builder
C1) Build the ReportBrief from (spec, attempt_summary).
- Implement: buildReportBrief({ spec, attemptSummary })
- Resolve slug and test_id from spec.
- Ensure scales are sorted by scale_id for stability.
- Ensure top_scales are sorted by normalized desc, then scale_id.

Task D: Tests
D1) Add unit tests.
- Create: apps/web/src/lib/report/report_brief.test.ts
- Use the golden test spec fixture already present in the repo (or load via content provider helpers if a fixture exists).
- Verify:
  - normalization returns 0-100
  - output is stable given the same inputs
  - top_scales length is min(3, number of scales)
  - sorting is deterministic

Success criteria
- scripts/ci.sh exits 0.
- ReportBrief builder produces stable JSON for a representative attempt summary.

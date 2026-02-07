PR-LLM-REPORT-04: Auto-Style Mapping (Style Cards + Deterministic Selection)

Read and follow AGENTS.md strictly.

Context
- LLM generation currently uses a fixed styleId="neutral".
- We want the report style to be automatically chosen from the test results.
- Style selection must be deterministic and auditable (stored in report_artifacts.style_id).

Goal
- Define a small set of style cards.
- Implement deterministic style selection from ReportBrief.
- Update prompts and job processing to use the selected style.

Non-goals
- No user-controlled style selection yet.
- Do not change report rendering UI yet.

Workflow rules
- Create a new branch from main named: pr-llm-report-04-auto-style
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing.

Task A: Style cards
A1) Create style cards configuration.
- Create: apps/web/src/lib/report/style_cards.ts
- Export:
  - type StyleCard
  - const STYLE_CARDS: Record<string, StyleCard>
  - const DEFAULT_STYLE_ID = "balanced"

StyleCard fields
- id
- label
- tone_guidance (string)
- structure_guidance (string)
- do_list: string[]
- dont_list: string[]

Provide 3 initial styles
- analytical
  - tighter structure, bullets, checklists, trade-offs, explicit risks
- intuitive
  - warmer narrative, examples, metaphors, emotion labels, gentle prompts
- balanced
  - neutral, practical, short paragraphs + bullets

Task B: Deterministic mapping
B1) Implement style inference.
- Create: apps/web/src/lib/report/style_inference.ts
- Function: inferStyleIdFromBrief(brief: ReportBrief): string

Heuristics
- Use brief.top_scales[0].scale_id as the primary signal.
- Normalize scale_id to lowercase.
- Rules:
  - If scale_id contains any of: "analyt", "logic", "system", "detail" -> analytical
  - If scale_id contains any of: "intuit", "feel", "creative", "gut" -> intuitive
  - Otherwise -> balanced
- If brief.top_scales is empty -> balanced

B2) Add a second signal using score spread
- If top 1 and top 2 normalized scores differ by <= 5 points -> balanced (even if keywords match)

Task C: Prompt incorporates style card
C1) Update prompt builder to include style card guidance.
- Update: apps/web/src/lib/report/llm_prompt.ts
- Fetch the style card by id (fallback to balanced).
- Inject tone_guidance, structure_guidance, do_list, dont_list into system prompt.

Task D: Job processing stores style_id
D1) Update job processor to use inferred style.
- Update: apps/web/src/app/api/internal/report-jobs/run/route.ts
- Instead of styleId="neutral":
  - styleId = inferStyleIdFromBrief(brief)
- Store style_id in report_artifacts.

Task E: Tests
E1) Add unit tests for style inference.
- Create: apps/web/src/lib/report/style_inference.test.ts
- Verify:
  - analytical keyword -> analytical
  - intuitive keyword -> intuitive
  - unknown keyword -> balanced
  - spread <= 5 -> balanced

Success criteria
- scripts/ci.sh exits 0.
- Report artifacts created by the internal runner contain a deterministic style_id.

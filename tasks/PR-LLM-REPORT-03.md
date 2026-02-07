PR-LLM-REPORT-03: LLM Generator (OpenAI Responses API + Structured Outputs) and Job Processing

Read and follow AGENTS.md strictly.

Context
- report_jobs and report_artifacts tables exist, but no generator writes artifacts.
- ReportBrief builder exists and is the only allowed input to the LLM.
- We want a strict JSON output that we can render safely.

Goal
- Add an OpenAI Responses API client (server-side) and generate a strict JSON report artifact using Structured Outputs.
- Update the internal job runner to process queued jobs end-to-end: read attempt summary -> build brief -> call OpenAI -> store report_artifact -> mark job ready.

Non-goals
- Do not change public report UI yet.
- Do not add any new user data collection.
- Do not add alternative providers yet.

Workflow rules
- Create a new branch from main named: pr-llm-report-03-structured-outputs
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing.

Task A: Environment variables
A1) Update .env.example
- Add:
  - REPORT_WORKER_SECRET=
  - OPENAI_API_KEY=
  - OPENAI_MODEL=gpt-4o
  - OPENAI_BASE_URL=https://api.openai.com/v1

Task B: OpenAI client
B1) Add a minimal HTTP client wrapper.
- Create: apps/web/src/lib/llm/openai_client.ts
- Requirements:
  - Uses fetch() server-side.
  - Base URL from OPENAI_BASE_URL.
  - Authorization: Bearer OPENAI_API_KEY.
  - Timeout via AbortController (10-20 seconds).
  - Extract aggregated output_text by traversing response.output[].content[] items of type "output_text".

B2) Implement a helper to call Responses API.
- Function: createStructuredJsonResponse({ model, system, user, schemaName, schema, maxOutputTokens })
- Payload shape:
  - model
  - input: [{ role: "system", content: system }, { role: "user", content: user }]
  - text: { format: { type: "json_schema", name: schemaName, schema, strict: true } }

Task C: Report JSON schema
C1) Define the report JSON schema as a TS constant.
- Create: apps/web/src/lib/report/llm_report_schema.ts
- Export:
  - const LLM_REPORT_SCHEMA
  - const LLM_REPORT_SCHEMA_NAME = "quiz_report_v1"
  - const PROMPT_VERSION = "v1"

Schema requirements (keep it minimal and renderable)
- Top-level object required keys:
  - report_title: string
  - summary: { headline: string, bullets: string[] }
  - sections: array of { id: string, title: string, body: string, bullets: string[] }
  - action_plan: array of { title: string, steps: string[] }
  - disclaimers: string[]
- additionalProperties: false everywhere.
- Keep strings reasonably short (prompt instruction will enforce this).

Task D: Prompting
D1) Implement prompt builder.
- Create: apps/web/src/lib/report/llm_prompt.ts
- Inputs:
  - brief: ReportBrief
  - style_id: string (use "neutral" for now, mapping added in next PR)
- Output:
  - system string
  - user string

Prompt rules
- Use the brief only. Do not invent user identity or personal data.
- No medical diagnosis language.
- Use the same language as brief.locale.
- Output must match the schema.
- Keep sections actionable and specific.

Task E: Job processing writes artifacts
E1) Implement generator function.
- Create: apps/web/src/lib/report/llm_report_generator.ts
- Function: generateLlmReport({ brief, styleId, model }) -> reportJson
- Uses openai_client + schema + prompt.

E2) Update internal runner to generate real artifacts.
- Update: apps/web/src/app/api/internal/report-jobs/run/route.ts
- Behavior for each claimed job:
  - Load attempt summary.
  - Load published test spec for the job tenant/test/locale.
  - Build ReportBrief.
  - Call generateLlmReport with styleId="neutral".
  - Insert report_artifacts (purchase_id unique).
  - mark job ready.
- Error handling:
  - If OPENAI_API_KEY missing, mark failed with last_error="openai not configured".
  - On OpenAI errors, increment attempts and mark failed with a short error string.
  - Ensure idempotency: if artifact already exists for purchase_id, mark job ready.

Task F: Tests
F1) Unit test for output_text extraction.
- Create: apps/web/src/lib/llm/openai_client.test.ts
- Use a fixture response JSON containing output[].content[] with type output_text.
- Verify extraction concatenates output_text in order.

F2) Unit test for prompt builder invariants.
- Create: apps/web/src/lib/report/llm_prompt.test.ts
- Verify it includes:
  - brief.test_id
  - brief.locale
  - schemaName

Success criteria
- scripts/ci.sh exits 0.
- Internal runner can generate and persist a report_artifact when OPENAI_API_KEY is configured.
- Jobs become ready after generation.

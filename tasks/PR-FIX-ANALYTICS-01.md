```text
Read and follow AGENTS.md strictly.

Open the repository and fix analytics/events.json so it matches the required event contract format (version + global + events with examples). Do not change product code in this PR. Only modify analytics/events.json (and optionally add a tiny README note inside the JSON notes section).

Context
- analytics/events.json currently exists but does not follow the agreed contract structure.
- We need a single source of truth for event names, required properties, optional properties, enums, forbidden data, and example payloads.

Hard requirements (must be satisfied)
1) analytics/events.json must be strictly valid JSON (no comments, no trailing commas).
2) Top-level JSON structure must include:
- version (string)
- global (object) with:
  - required_properties (object mapping property_name -> definition)
  - optional_properties (object mapping property_name -> definition)
  - enums (object mapping enum_name -> array of allowed values)
  - forbidden_properties (array of forbidden property names and patterns)
  - notes (array of strings documenting rules and constraints)
- events (array of event definitions), each including:
  - name (string)
  - description (string)
  - backend_only (boolean)
  - required_properties (array of property names, including the global required ones)
  - optional_properties (array of property names)
  - forbidden_properties (array; can reference the global list by repeating it or explicitly stating it applies)
  - examples (array with at least 1 example event payload object per event that conforms to the contract)

3) Event list
The contract must include at minimum these event names (exact spelling):
- page_view
- test_start
- test_complete
- result_preview_view
- paywall_view
- checkout_start
- purchase_success
- refund_issued
- dispute_opened
- report_view
- report_pdf_download
- upsell_view
- upsell_accept

If the existing codebase already emits additional events (for example purchase_failed, share_click, etc.), keep them in the contract too, with the same level of detail and examples. To decide, search the codebase for event name strings and include any events that are actually emitted. Otherwise do not invent extra events.

4) Global required properties (required on every event)
- tenant_id (string)
- locale (string, BCP47 examples: en, es, pt-BR)
- session_id (string)
- device_type (enum string: mobile | desktop)

These 4 properties must be included in every event definition required_properties list and in every example payload.

5) Required when applicable
- test_id (string) must be required on test-related events:
  - test_start
  - test_complete
  - result_preview_view
  - paywall_view
  - checkout_start
  - report_view
  - report_pdf_download
  - upsell_view
  - upsell_accept

6) UTM fields
Define these as optional string properties:
- utm_source
- utm_campaign
- utm_content
- utm_medium

Document the rule in global.notes:
- If an optional UTM value is not present, omit the field (do not send empty string).
- If present, it must be a non-empty string.

7) Backend-only finance events
These events must be marked backend_only: true and must include required finance fields:

purchase_success (backend only)
Required properties:
- tenant_id, locale, session_id, device_type
- purchase_id (string)
- amount_eur (number)
- product_type (enum: single | pack5 | pack10)
- payment_provider (enum: stripe)
- is_upsell (boolean)
Optional properties:
- originated_test_id (string)
- originated_session_id (string)

refund_issued (backend only)
Required:
- tenant_id, locale, session_id, device_type
- purchase_id (string)
- refund_id (string)
- amount_eur (number)
- payment_provider (enum: stripe)

dispute_opened (backend only)
Required:
- tenant_id, locale, session_id, device_type
- purchase_id (string)
- dispute_id (string)
- amount_eur (number)
- payment_provider (enum: stripe)

8) Report events
report_view
- If reports are always paid, require purchase_id (string).
- If free reports are supported, document the exact rule in global.notes and still provide a paid example with purchase_id present.

report_pdf_download
Required:
- purchase_id (string)
- file_format (enum: pdf)

9) Upsell events
upsell_view
Required:
- base_purchase_id (string)
- upsell_product_type (enum: pack5 | pack10)

upsell_accept
Required:
- base_purchase_id (string)
- upsell_purchase_id (string)
- upsell_product_type (enum: pack5 | pack10)
- amount_eur (number)

10) page_view fields
For page_view, define safe optional fields:
- path (string, path only, no querystring)
- referrer (string)
- page_type (enum: landing | quiz | result_preview | paywall | report | other)

11) Forbidden data
In global.forbidden_properties, explicitly forbid and document:
- PII: email, phone, full_name, first_name, last_name, address, exact_gps, government_id
- raw test answers: answers, responses, question_answers, free_text, open_text
- payment card/billing details: card_*, iban, billing_*, cvc, pan
- ip, ip_address
- any full user-generated text fields

Also add a short rationale in global.notes:
- This system must never store raw answers or PII in analytics events.
- Only opaque ids (session_id, purchase_id, tenant_id, test_id) are allowed for debugging.

12) Compatibility note
If the previous file used a different name such as language instead of locale, document a migration note in global.notes:
- locale is the canonical field name going forward.

Implementation steps
1) Inspect current analytics/events.json and the codebase for emitted event names and current property usage.
2) Rewrite analytics/events.json into the new structure (version/global/events) without losing required intent.
3) Ensure each required event has at least 1 example payload:
- Examples must only include allowed properties.
- Examples must include global required properties.
- Examples for backend-only events must include the finance fields above.
4) Validate JSON locally:
- jq -e . analytics/events.json
  or
- node -e "JSON.parse(require('fs').readFileSync('analytics/events.json','utf8')); console.log('ok')"

Git workflow
- Create a new branch from main named: pr-fix-analytics-01-events-contract
- Commit only the analytics/events.json change.
- Commit message: "PR-FIX-ANALYTICS-01: fix events contract"
- Push the branch to origin.

Success criteria
- analytics/events.json matches the required top-level structure (version/global/events) and is valid JSON.
- All minimum required event names are present exactly as listed.
- Global required properties are exactly tenant_id, locale, session_id, device_type and appear in every event definition and every example.
- test_id is required on all specified test-related events.
- Backend-only events are marked backend_only: true and include all required finance fields.
- UTM fields are optional with a documented omission rule.
- Forbidden properties are explicitly listed and include PII and raw answers.
- Each event has at least 1 conforming example payload.
- JSON validation command passes locally.

```
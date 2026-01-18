# Test Content

## Directory layout
- content/tests/<test_id>/spec.json
- config/catalog.json

## Spec fields (short)
- test_id: string in the form test-<slug>
- slug: url-safe string
- version: integer, starting at 1
- category: string
- locales: object keyed by locale tag (en, es, pt-BR)
  - title, short_description, intro, paywall_headline, report_title
- questions: array of single_choice questions
  - prompt and option labels are keyed by locale tag
- scoring: scales array and option_weights mapping option_id to scale_id weights
- result_bands: array of score ranges with localized copy (headline, summary, bullets)

## How to add a test
1) Create content/tests/<test_id>/spec.json and fill the required fields.
2) Add the test_id to config/catalog.json under the tenant that should offer it.
3) Run scripts/content/validate_catalog.py or CI to validate the catalog.

## Analytics restrictions
- Do not send raw answers.
- Do not send free text.
- Only derived scores and result keys are allowed in analytics payloads.

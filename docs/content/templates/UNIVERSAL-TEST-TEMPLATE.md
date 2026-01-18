Universal Test Template (Human-readable, Multi-language)
======================================================

Purpose
-------
A universal, human-readable template for creating new tests for Quiz Factory.
This file is meant to be given to an LLM as the reference style and structure.

Non-negotiables
---------------
- Use stable IDs for anything used in scoring or analytics.
- Localize only display strings, not IDs.
- Do not store raw answers in analytics or databases.
- Avoid free-text responses in MVP.
- Avoid collecting PII.

Disclaimer (user-facing)
------------------------
{{DISCLAIMER_PARAGRAPH}}

Example:
"This is a self-reflection and entertainment tool. It is not a medical, psychological, legal, or financial diagnosis."

Universal Test Template (Human-readable, Multi-language)
======================================================

Purpose
-------
A universal, human-readable template for creating new tests for Quiz Factory.
This file is meant to be given to an LLM as the reference style and structure.

Non-negotiables
---------------
- Use stable IDs for anything used in scoring or analytics.
- Localize only display strings, not IDs.
- Do not store raw answers in analytics or databases.
- Avoid free-text responses in MVP.
- Avoid collecting PII.
- Avoid medical diagnosis claims.

Internal metadata
-----------------
test_id: {{TEST_ID}}
slug: {{SLUG}}
version: {{VERSION}}
category: {{CATEGORY}}
format_id: {{FORMAT_ID}}
primary_locale: {{PRIMARY_LOCALE}}
supported_locales: {{SUPPORTED_LOCALES_LIST}}
estimated_time_min: {{TIME_MIN}}
estimated_time_max: {{TIME_MAX}}
questions_count: {{QUESTIONS_COUNT}}

User-facing disclaimer
----------------------
{{DISCLAIMER_PARAGRAPH}}

Concept
-------
One-paragraph concept:
{{CONCEPT_PARAGRAPH}}

What it measures (1 line):
{{MEASURES_LINE}}

Short promise:
{{SHORT_PROMISE}}

Localized UI copy (start screen)
-------------------------------
Locale: {{LOCALE_1_TAG}}
Title: {{L1_TITLE}}
Short description: {{L1_SHORT_DESCRIPTION}}
Intro: {{L1_INTRO}}
Instructions: {{L1_INSTRUCTIONS}}

Locale: {{LOCALE_2_TAG}}
Title: {{L2_TITLE}}
Short description: {{L2_SHORT_DESCRIPTION}}
Intro: {{L2_INTRO}}
Instructions: {{L2_INSTRUCTIONS}}

Locale: {{LOCALE_3_TAG}}
Title: {{L3_TITLE}}
Short description: {{L3_SHORT_DESCRIPTION}}
Intro: {{L3_INTRO}}
Instructions: {{L3_INSTRUCTIONS}}

Answer scales (reusable)
------------------------
Define scales once, reference them from questions.

Scale: likert_5
- option_id: likert_1, score: 1
  labels:
    {{LOCALE_1_TAG}}: {{LIKERT_1_L1}}
    {{LOCALE_2_TAG}}: {{LIKERT_1_L2}}
    {{LOCALE_3_TAG}}: {{LIKERT_1_L3}}
- option_id: likert_2, score: 2
  labels:
    {{LOCALE_1_TAG}}: {{LIKERT_2_L1}}
    {{LOCALE_2_TAG}}: {{LIKERT_2_L2}}
    {{LOCALE_3_TAG}}: {{LIKERT_2_L3}}
- option_id: likert_3, score: 3
  labels:
    {{LOCALE_1_TAG}}: {{LIKERT_3_L1}}
    {{LOCALE_2_TAG}}: {{LIKERT_3_L2}}
    {{LOCALE_3_TAG}}: {{LIKERT_3_L3}}
- option_id: likert_4, score: 4
  labels:
    {{LOCALE_1_TAG}}: {{LIKERT_4_L1}}
    {{LOCALE_2_TAG}}: {{LIKERT_4_L2}}
    {{LOCALE_3_TAG}}: {{LIKERT_4_L3}}
- option_id: likert_5, score: 5
  labels:
    {{LOCALE_1_TAG}}: {{LIKERT_5_L1}}
    {{LOCALE_2_TAG}}: {{LIKERT_5_L2}}
    {{LOCALE_3_TAG}}: {{LIKERT_5_L3}}

Question types
--------------
Choose any mix:
- single_choice
- multi_choice
- likert_5
- likert_7
- slider_0_10
- ranking
- numeric_input

If you include free-text later, it must never be sent to analytics and must not be stored together with derived results.

Question bank (human-readable)
------------------------------
Define each question with a stable question_id. Suggested pattern: q01, q02, q03 up to q{{QUESTIONS_COUNT}}

Question template
-----------------
QID: {{QUESTION_ID}}
Type: {{QUESTION_TYPE}}
Required: {{REQUIRED_TRUE_FALSE}}
Scale: {{SCALE_REF_OR_NONE}}
Prompt:
- {{LOCALE_1_TAG}}: {{Q_PROMPT_L1}}
- {{LOCALE_2_TAG}}: {{Q_PROMPT_L2}}
- {{LOCALE_3_TAG}}: {{Q_PROMPT_L3}}

Options (for choice types)
- option_id: {{OPTION_ID}}
  Labels:
    {{LOCALE_1_TAG}}: {{OPTION_LABEL_L1}}
    {{LOCALE_2_TAG}}: {{OPTION_LABEL_L2}}
    {{LOCALE_3_TAG}}: {{OPTION_LABEL_L3}}
  Scoring weights (optional, per scale_id):
    {{SCALE_1_ID}}: {{WEIGHT_INT}}
    {{SCALE_2_ID}}: {{WEIGHT_INT}}

Repeat the Question template for all questions.

Scoring model
-------------
Pick 1 and define it clearly.

Model A: Single total score with bands
- total_score = sum(question scores)
- band_id selected by inclusive range

Model B: Multi-scale profile
- scale_scores[scale_id] = sum(weights)
- top_traits = top N scale_ids
- tie-break rules must be deterministic

Model C: Hybrid
- compute scale_scores
- compute top_traits
- compute conflicts from pairs of scales
- compute flags and recommendations

Scales (if using Model B or C)
------------------------------
Scale definition template
- scale_id: {{SCALE_1_ID}}
  Display names:
    {{LOCALE_1_TAG}}: {{SCALE_1_NAME_L1}}
    {{LOCALE_2_TAG}}: {{SCALE_1_NAME_L2}}
    {{LOCALE_3_TAG}}: {{SCALE_1_NAME_L3}}
  Definition:
    {{LOCALE_1_TAG}}: {{SCALE_1_DEF_L1}}
    {{LOCALE_2_TAG}}: {{SCALE_1_DEF_L2}}
    {{LOCALE_3_TAG}}: {{SCALE_1_DEF_L3}}

Tie-break rules (required if ranking)
-------------------------------------
Rule 1: {{TIE_BREAK_RULE_1}}
Rule 2: {{TIE_BREAK_RULE_2}}
Rule 3: {{TIE_BREAK_RULE_3}}

Missing answers policy
----------------------
{{MISSING_POLICY}}

Derived result payload (store only this)
----------------------------------------
This is what you can store in a cookie or token and optionally log in analytics as aggregates.
Do not store raw answers.

Required fields:
- test_id
- computed_at_utc
- derived:
  - scale_scores (object)
  - total_score (optional)
  - band_id (optional)
  - top_traits (optional)
  - conflict_pairs (optional)
  - flags (optional)

Band table (if using bands)
---------------------------
- band_id: {{BAND_1_ID}}, min: {{BAND_1_MIN}}, max: {{BAND_1_MAX}}
- band_id: {{BAND_2_ID}}, min: {{BAND_2_MIN}}, max: {{BAND_2_MAX}}

Conflict rules (optional)
-------------------------
Pair template
- pair_id: {{PAIR_1_ID}}
  a: {{SCALE_A_ID}}
  b: {{SCALE_B_ID}}
  Level rules:
    high_tension: {{HIGH_TENSION_RULE}}
    moderate_tension: {{MODERATE_TENSION_RULE}}
    tilt: {{TILT_RULE}}

Copy libraries
--------------
Use libraries keyed by band_id, scale_id, or other derived keys.

Preview copy library (free)
---------------------------
Key: {{LIB_KEY}}
- {{LOCALE_1_TAG}}: {{PREVIEW_2_SENTENCES_L1}}
- {{LOCALE_2_TAG}}: {{PREVIEW_2_SENTENCES_L2}}
- {{LOCALE_3_TAG}}: {{PREVIEW_2_SENTENCES_L3}}

Paid copy library (full)
------------------------
Key: {{LIB_KEY}}
{{LOCALE_1_TAG}} bullets:
- {{PAID_L1_LINE_1}}
- {{PAID_L1_LINE_2}}
- {{PAID_L1_LINE_3}}

{{LOCALE_2_TAG}} bullets:
- {{PAID_L2_LINE_1}}
- {{PAID_L2_LINE_2}}
- {{PAID_L2_LINE_3}}

{{LOCALE_3_TAG}} bullets:
- {{PAID_L3_LINE_1}}
- {{PAID_L3_LINE_2}}
- {{PAID_L3_LINE_3}}

Result templates
----------------
Free preview template
Title: {{FREE_PREVIEW_TITLE}}
Body:
{{FREE_PREVIEW_BODY}}

Allowed placeholders:
- {TOP1}, {TOP2}, {TOP3}
- {BAND_NAME}
- {SCALE_NAME}
- {PAIR_1_NAME}, {PAIR_1_LEVEL}
- {SCORE_TOTAL}

Paywall hook paragraph:
{{PAYWALL_HOOK_PARAGRAPH}}

Paid report structure
Report title: {{PAID_REPORT_TITLE}}
Sections:
1) {{PAID_SECTION_1}}
2) {{PAID_SECTION_2}}
3) {{PAID_SECTION_3}}
4) {{PAID_SECTION_4}}
5) {{PAID_SECTION_5}}

Paywall copy
------------
CTA: {{PAYWALL_CTA}}
Bullets:
- {{PAYWALL_BULLET_1}}
- {{PAYWALL_BULLET_2}}
- {{PAYWALL_BULLET_3}}
- {{PAYWALL_BULLET_4}}

LLM success checklist
---------------------
The generated test is acceptable if:
- test_id, slug, version, category, primary_locale are present.
- All question_id values are unique and stable.
- All localized strings exist for all required locales.
- Scoring is explicit and deterministic.
- Derived result definition excludes raw answers.
- Preview and paid copy exists.
- No medical diagnosis claims and no PII collection.

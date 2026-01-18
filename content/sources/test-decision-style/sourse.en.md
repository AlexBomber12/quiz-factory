Decision Style: Analytical vs Intuitive (EN)
========================================

Purpose
-------
A fast, self-reflection test for Quiz Factory that maps how you make decisions: analytical vs intuitive, speed vs precision, and your appetite for risk.

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
test_id: decision_style_analytical_intuitive_v1
slug: decision-style-analytical-intuitive
version: 1.0.0
category: decision-making
format_id: universal_human_v1
primary_locale: en
supported_locales: en
estimated_time_min: 5
estimated_time_max: 7
questions_count: 22

User-facing disclaimer
----------------------
This is a self-reflection and entertainment tool. It is not a medical, psychological, legal, or financial diagnosis.

Concept
-------
One-paragraph concept:
Your best decisions usually come from the right mix of thinking and feeling. This test shows your default mix, how fast you commit, and how much uncertainty you tolerate. The goal is not to label you as "good" or "bad". It is to help you spot your decision habits, the situations where they shine, and the moments where a small adjustment would save you time, money, or regret.

What it measures (1 line):
Decision style (Analytical vs Intuitive), pace (Speed vs Precision), and risk appetite.

Short promise:
In 22 quick statements, get your decision profile plus a practical way to dial your speed, accuracy, and risk up or down depending on the stakes.

Localized UI copy (start screen)
-------------------------------
Locale: en
Title: Decision Style: Analytical vs Intuitive
Short description: Find out how you decide under uncertainty: head vs gut, fast vs thorough, safe vs bold.
Intro: 22 statements. No trick questions. Answer how you usually decide, especially when you are busy or under pressure.
Instructions: Choose the option that feels most true for you most of the time. If you are torn between 2 options, pick the one you do slightly more often.

Answer scales (reusable)
------------------------
Scale: likert_5
- option_id: likert_1, score: 1
  labels:
    en: Strongly disagree
- option_id: likert_2, score: 2
  labels:
    en: Disagree
- option_id: likert_3, score: 3
  labels:
    en: Neutral
- option_id: likert_4, score: 4
  labels:
    en: Agree
- option_id: likert_5, score: 5
  labels:
    en: Strongly agree

Question bank (human-readable)
------------------------------
QID: q01
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- en: I feel uneasy deciding without at least a few solid facts.
Scoring weights (per scale_id):
  analysis: 2
  precision: 1

QID: q02
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- en: When the data is messy, I rely on intuition more than spreadsheets.
Scoring weights (per scale_id):
  intuition: 2

QID: q03
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- en: I would rather decide fast and adjust later than wait for full certainty.
Scoring weights (per scale_id):
  speed: 2
  risk: 1

QID: q04
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- en: I naturally turn big choices into criteria and weigh them.
Scoring weights (per scale_id):
  analysis: 2

QID: q05
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- en: I notice "vibes" (tone, timing, subtle cues) and they influence my decisions.
Scoring weights (per scale_id):
  intuition: 2

QID: q06
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- en: I double-check details because small mistakes bother me later.
Scoring weights (per scale_id):
  precision: 2

QID: q07
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- en: I can make a good decision with 70% of the information.
Scoring weights (per scale_id):
  speed: 2
  risk: 1

QID: q08
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- en: I enjoy using simple models (pros/cons, scoring, expected value) to choose.
Scoring weights (per scale_id):
  analysis: 2

QID: q09
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- en: If my first instinct is strong, I often act on it.
Scoring weights (per scale_id):
  intuition: 2
  speed: 1

QID: q10
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- en: Before choosing, I imagine 2-3 ways it could go wrong.
Scoring weights (per scale_id):
  precision: 2
  analysis: 1

QID: q11
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- en: I prefer running a small test to endless debating.
Scoring weights (per scale_id):
  speed: 2
  analysis: 1

QID: q12
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- en: Being right matters more to me than being fast.
Scoring weights (per scale_id):
  precision: 2

QID: q13
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- en: I am comfortable taking a calculated risk if the upside is big.
Scoring weights (per scale_id):
  risk: 1
  analysis: 1

QID: q14
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- en: If new evidence appears, I change my mind quickly.
Scoring weights (per scale_id):
  analysis: 1
  speed: 1

QID: q15
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- en: I ask for a second opinion to catch blind spots.
Scoring weights (per scale_id):
  precision: 1

QID: q16
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- en: I trust patterns from experience even if I cannot explain them well.
Scoring weights (per scale_id):
  intuition: 2

QID: q17
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- en: Under time pressure, I stay calm and still decide.
Scoring weights (per scale_id):
  speed: 2
  risk: 1

QID: q18
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- en: I can tolerate uncertainty without rushing to close it.
Scoring weights (per scale_id):
  precision: 2

QID: q19
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- en: Numbers and forecasts influence me more than stories and anecdotes.
Scoring weights (per scale_id):
  analysis: 2

QID: q20
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- en: I use rules of thumb to decide quickly.
Scoring weights (per scale_id):
  speed: 2
  intuition: 1

QID: q21
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- en: I dislike choosing without a clear definition of success.
Scoring weights (per scale_id):
  analysis: 2
  precision: 1

QID: q22
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- en: I tend to choose the bolder option over the safer one.
Scoring weights (per scale_id):
  risk: 1
  speed: 1

Scoring model
-------------
Model C: Hybrid (multi-scale + deterministic profile)

1) Compute scale scores
- scale_scores[scale_id] = sum(option_score * weight) across all questions.

Scale IDs used in scoring:
- analysis
- intuition
- speed
- precision
- risk

2) Compute axes (deterministic)
- style_axis = scale_scores[analysis] - scale_scores[intuition]
- pace_axis = scale_scores[speed] - scale_scores[precision]

3) Risk tilt (derived from risk score)
- risk_score = scale_scores[risk]
- risk_cautious: 5-12 (inclusive)
- risk_balanced: 13-18 (inclusive)
- risk_bold: 19-25 (inclusive)

4) Profile band_id (4 profiles)
- strategist: style_axis >= 0 AND pace_axis < 0
- rapid_analyst: style_axis >= 0 AND pace_axis >= 0
- reflective_visionary: style_axis < 0 AND pace_axis < 0
- instinct_sprinter: style_axis < 0 AND pace_axis >= 0

5) top_traits (3 IDs, deterministic)
- dominant_style_trait = analysis if scale_scores[analysis] >= scale_scores[intuition] else intuition
- dominant_pace_trait = speed if scale_scores[speed] >= scale_scores[precision] else precision
- risk_tilt_trait = one of: risk_cautious | risk_balanced | risk_bold
- top_traits = [dominant_style_trait, dominant_pace_trait, risk_tilt_trait]

Scales
------
- scale_id: analysis
  Display name:
    en: Analytical
  Definition:
    en: You prefer facts, structure, and explicit trade-offs. You feel safer when the reasoning is visible.

- scale_id: intuition
  Display name:
    en: Intuitive
  Definition:
    en: You trust pattern recognition and context. You pick up signals others miss, even if it is hard to explain.

- scale_id: speed
  Display name:
    en: Speed
  Definition:
    en: You move quickly, decide with imperfect information, and adjust on the fly.

- scale_id: precision
  Display name:
    en: Precision
  Definition:
    en: You slow down, verify details, and optimize for correctness. You prefer fewer mistakes over faster closure.

- scale_id: risk
  Display name:
    en: Risk appetite
  Definition:
    en: Your comfort with uncertainty and downside. Higher scores mean you are more willing to bet for upside.

Derived traits (for TOP3)
-------------------------
- trait_id: risk_cautious
  Display name:
    en: Cautious
  Definition:
    en: You default to safer bets and prefer downside protection.

- trait_id: risk_balanced
  Display name:
    en: Balanced
  Definition:
    en: You take risks when they are worth it, but you do not chase them.

- trait_id: risk_bold
  Display name:
    en: Bold
  Definition:
    en: You are comfortable with big bets and ambiguity, especially when the upside is clear.

Profiles (bands)
----------------
- band_id: strategist
  Display name:
    en: Strategist
  One-liner:
    en: Analytical + Precision. You win by making the decision clean, then executing with confidence.

- band_id: rapid_analyst
  Display name:
    en: Rapid Analyst
  One-liner:
    en: Analytical + Speed. You win by moving fast with a framework and learning through iteration.

- band_id: reflective_visionary
  Display name:
    en: Reflective Visionary
  One-liner:
    en: Intuitive + Precision. You win by sensing patterns deeply and pressure-testing before you commit.

- band_id: instinct_sprinter
  Display name:
    en: Instinctive Sprinter
  One-liner:
    en: Intuitive + Speed. You win by trusting the signal early and turning decisions into action quickly.

Tie-break rules
---------------
Rule 1: If style_axis == 0, choose Analytical (style_axis >= 0).
Rule 2: If pace_axis == 0, choose Speed (pace_axis >= 0).
Rule 3: If risk_score lands exactly on a boundary, use the inclusive ranges above (cautious max 12, balanced max 18).

Missing answers policy
----------------------
All questions are required. If any answer is missing, block completion and ask the user to answer the remaining items.

Derived result payload (store only this)
----------------------------------------
Do not store raw answers. Store only derived outputs.

Required fields:
- test_id
- computed_at_utc
- derived:
  - scale_scores: { analysis, intuition, speed, precision, risk }
  - band_id: one of { strategist, rapid_analyst, reflective_visionary, instinct_sprinter }
  - top_traits: [dominant_style_trait, dominant_pace_trait, risk_tilt_trait]
  - flags: optional list
  - meta: optional object (safe aggregates only)

Recommended derived extras (still safe):
- derived.meta.style_axis
- derived.meta.pace_axis
- derived.meta.risk_score

Copy libraries
--------------
Preview copy library (free)

Key: strategist
- en: You decide like a Strategist: you slow down to get the decision right, then commit. Your superpower is clarity; your risk is overbuilding the case when a smaller move would do.

Key: rapid_analyst
- en: You are a Rapid Analyst: you think in frameworks, but you do not get stuck. Your superpower is momentum; your risk is missing the one detail that would have changed the outcome.

Key: reflective_visionary
- en: You are a Reflective Visionary: you trust patterns, then sanity-check before you commit. Your superpower is depth; your risk is holding the decision open too long.

Key: instinct_sprinter
- en: You are an Instinctive Sprinter: you make fast calls and learn by doing. Your superpower is speed; your risk is betting on the first signal instead of the best one.

Paid copy library (full)

Key: strategist
en bullets:
- Your "decision funnel" (what you do first, second, third) and how to cut time without cutting quality.
- The 3 traps that slow you down, plus counter-moves that work with your brain.
- A personal risk dial: when to play safe, when to push, and how to set guardrails.

Key: rapid_analyst
en bullets:
- How to keep speed without becoming sloppy (your 2 best checks).
- Where you tend to underestimate risk, and how to spot it early.
- 5 decision scripts for high-stakes calls, meetings, and negotiations.

Key: reflective_visionary
en bullets:
- How to turn intuition into clearer reasoning (so others trust your calls).
- Where perfectionism hides as "more thinking", and how to close cleanly.
- A risk map: which bets you should take, and which ones you should delegate or protect.

Key: instinct_sprinter
en bullets:
- How to upgrade gut decisions with 2 fast reality checks (without slowing down).
- The situations where you win big, and where your style can backfire.
- A practical plan to reduce regret while keeping your speed.

Result templates
----------------
Free preview template
Title: Your Decision Style: {BAND_NAME}
Body:
Top signals: {TOP1} + {TOP2}. Your risk dial is set to {TOP3}.

What this means today:
- You have a default way of deciding that saves you energy.
- In the wrong situation, the same habit can create avoidable mistakes.

Unlock the full report to get your Decision Playbook: your best environments, your blind spots, and concrete scripts for faster, cleaner outcomes.

Paywall hook paragraph:
Want the playbook, not just the label? The full report shows exactly how you decide when stakes rise, where you overthink or under-check, and how to tune your risk so you win more often.

Paid report structure
Report title: Your Decision Playbook
Sections:
1) Your core profile (how you think, how you commit)
2) Speed vs precision: your sweet spot by stakes
3) Risk dial: when to bet, when to protect, how to set guardrails
4) Blind spots and common traps (and counter-moves)
5) 7-day upgrade plan (tiny habits + scripts you can reuse)

Paywall copy
------------
CTA: Unlock my full Decision Playbook
Bullets:
- Your profile explained in real-life scenarios (work, money, relationships)
- Personalized scripts for fast, high-quality decisions
- Your risk dial with guardrails (so bold does not become reckless)
- A 7-day plan to upgrade your decision outcomes

LLM success checklist
---------------------
- test_id, slug, version, category, primary_locale are present.
- All question_id values are unique and stable.
- All localized strings exist for locale: en.
- Scoring is explicit and deterministic.
- Derived result definition excludes raw answers.
- Preview and paid copy exists.
- No medical diagnosis claims and no PII collection.

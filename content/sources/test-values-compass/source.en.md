Values Compass (EN)
===================

Purpose
-------
A flagship, reference-quality test for Quiz Factory.

- What it measures: 10 values, their priorities, and 5 key value conflicts.
- Format: 30 statements, 1-5 agreement scale.
- Time: 4-6 minutes.
- Result: Top 3 values + profiles (free preview), full report behind paywall.
- Disclaimer: A self-reflection tool, not a medical or psychological diagnosis.


1. Concept
----------
Values Compass helps people see what truly drives their decisions, what drains their energy, and where internal value conflicts create friction.


2. Values (10) with definitions
-------------------------------
Keep IDs stable for scoring and analytics. Display names can be localized.

1) FREEDOM (Freedom) - autonomy, choice, independence.
2) SECURITY (Security) - safety, stability, predictability.
3) ACHIEVEMENT (Achievement) - progress, mastery, goals.
4) CONNECTION (Connection) - closeness, belonging, relationships.
5) GROWTH (Growth) - learning, development, novelty.
6) CONTRIBUTION (Contribution) - helping others, meaning, impact.
7) RECOGNITION (Recognition) - status, appreciation, influence.
8) ENJOYMENT (Enjoyment) - pleasure, experiences, play.
9) INTEGRITY (Integrity) - honesty, principles, authenticity.
10) ORDER (Order) - structure, order, rules, reliable methods.


3. What the user sees (start screen copy)
----------------------------------------
Title
- Values Compass

Short promise
- Discover your Top 3 values and the hidden conflicts that shape your decisions.

Instructions
- Rate each statement from 1 to 5:
  - 1 = Strongly disagree
  - 2 = Disagree
  - 3 = Neutral
  - 4 = Agree
  - 5 = Strongly agree
- Answer fast. First instinct is usually the most accurate.


4. Questions (30)
-----------------
1. I feel energized when I can choose my own path, even if it is less certain.
2. I sleep better when my plans are clear and my risks are low.
3. A week without measurable progress feels wasted to me.
4. Close relationships are my main source of meaning.
5. I seek new experiences because they change how I think.
6. I want what I do to make life better for others, not just for me.
7. Being respected and seen for my work matters a lot to me.
8. I protect time for fun, even when I am busy.
9. If something violates my principles, I cannot "just go along with it."
10. I function best with routines, checklists, and clear expectations.

11. I prefer options over guarantees.
12. I would rather earn slightly less if it means stability.
13. I set goals that stretch me, and I enjoy chasing them.
14. I naturally check in on people and notice when someone is drifting away.
15. Learning for its own sake is worth time and money.
16. I feel responsible to use my skills in a way that helps someone.
17. I like roles where my influence is visible.
18. Spontaneous moments make life feel rich.
19. I would rather be honest than liked.
20. Structure gives me freedom because it reduces chaos.

21. If a rule does not make sense, I look for a better way rather than follow it.
22. In big decisions, I prioritize safety nets (savings, backup plans, insurance).
23. I get frustrated when people settle for "good enough" if "great" is possible.
24. I would trade some personal advantage to keep harmony with people I care about.
25. I enjoy being a beginner and failing a bit on the way to mastery.
26. If I can help quietly, without recognition, I still do it.
27. I feel demotivated when my contributions are overlooked.
28. I would rather have memorable experiences than more stuff.
29. I feel uneasy when my actions do not match my beliefs, even in small things.
30. I prefer proven methods over improvisation when the stakes are high.


5. Scoring (internal)
---------------------
Each value score = sum of 3 questions (range 3-15).

Mapping

| Value ID | Questions |
| --- | --- |
| FREEDOM | 1, 11, 21 |
| SECURITY | 2, 12, 22 |
| ACHIEVEMENT | 3, 13, 23 |
| CONNECTION | 4, 14, 24 |
| GROWTH | 5, 15, 25 |
| CONTRIBUTION | 6, 16, 26 |
| RECOGNITION | 7, 17, 27 |
| ENJOYMENT | 8, 18, 28 |
| INTEGRITY | 9, 19, 29 |
| ORDER | 10, 20, 30 |

Interpretation per value
- 13-15: Core driver
- 10-12: Strong support
- 7-9: Situational
- 3-6: Low priority

Tie-break rules (if equal total)
1) Higher single-item maximum among the 3 questions.
2) If still tied, higher score on the anchor item:
   - FREEDOM=21, SECURITY=22, ACHIEVEMENT=23, CONNECTION=24, GROWTH=25,
     CONTRIBUTION=26, RECOGNITION=27, ENJOYMENT=28, INTEGRITY=29, ORDER=30.


6. Value conflicts (internal detector + user hook)
-------------------------------------------------
We compute 5 conflict pairs.

Pairs
1) FREEDOM vs SECURITY
2) GROWTH vs ORDER
3) ACHIEVEMENT vs CONNECTION
4) RECOGNITION vs INTEGRITY
5) ENJOYMENT vs CONTRIBUTION

Conflict level for a pair
- High tension: both >= 12 and difference <= 2
- Moderate tension: both >= 10 and difference <= 3
- Clear tilt: difference >= 5
- Low: otherwise


7. Profile library (user-facing)
--------------------------------
Use Top 3 values to assemble the preview and the paid report.

FREEDOM (Freedom)
-----------------
Preview
- You thrive when you can choose, experiment, and move fast. Restrictions drain you, and you are at your best when you own the path.

Paid
- Freedom is your need for self-direction. You do not just want options, you want the right to redesign the game when it stops making sense.
- When honored: you feel alive, creative, decisive.
- When blocked: irritability, procrastination, or sudden "escape" decisions.
- Blind spot: underestimating the cost of instability for you and others.
- Decision rule: maximize options early, commit late, keep 1-2 reversible paths open.

SECURITY (Security)
-------------------
Preview
- You feel strongest with stability, clear plans, and reliable outcomes. Safety nets are not "fear", they are your platform for confidence.

Paid
- Security is your need for predictability and protection from avoidable risk. You build calm through planning and reserves.
- When honored: consistent performance, lower stress, better sleep.
- When threatened: overthinking, avoidance, analysis paralysis.
- Blind spot: missing upside because uncertainty feels like danger.
- Decision rule: take risk only when downside is capped and recovery is defined.

ACHIEVEMENT (Achievement)
-------------------------
Preview
- Progress is your fuel. You respect competence, mastery, and real results, and you dislike stagnation.

Paid
- Achievement is your drive to grow capability and win meaningful goals. You do not want motion, you want measurable improvement.
- When honored: high momentum, discipline, confidence.
- When overused: work becomes identity, rest feels "wasted."
- Blind spot: turning every moment into a scoreboard.
- Decision rule: define 1 metric that matters, ignore the rest, ship.

CONNECTION (Connection)
-----------------------
Preview
- People matter more than optics. You value closeness, trust, and emotional safety, and you notice distance early.

Paid
- Connection is your need to belong and to be seen as a real person, not just a performer.
- When honored: loyalty, warmth, resilience under stress.
- When threatened: people-pleasing or withdrawing.
- Blind spot: avoiding necessary conflict to keep harmony.
- Decision rule: protect the relationship and the truth at the same time.

GROWTH (Growth)
---------------
Preview
- You are built for learning and reinvention. Curiosity is not a hobby for you, it is a core need.

Paid
- Growth is your appetite for novelty, skill expansion, and new mental models.
- When honored: creativity, adaptability, future-proofing.
- When overused: endless starting, not enough finishing.
- Blind spot: chasing "new" to avoid boredom or discomfort.
- Decision rule: learn in sprints, then apply and lock in.

CONTRIBUTION (Contribution)
---------------------------
Preview
- Meaning matters. You want your effort to improve someone’s life, even if nobody applauds.

Paid
- Contribution is your need to matter beyond yourself. You measure success by impact, not only by personal gain.
- When honored: deep motivation, long-term stamina.
- When overused: burnout, rescuing, guilt-driven yes.
- Blind spot: forgetting that you are part of "others" too.
- Decision rule: help where you have leverage, say no where you have guilt.

RECOGNITION (Recognition)
-------------------------
Preview
- Visibility motivates you. You want your work to be valued, respected, and rewarded, not quietly absorbed.

Paid
- Recognition is your need for status signals that confirm your value in the social system.
- When honored: leadership, influence, strong delivery.
- When threatened: frustration, comparison, "why bother?"
- Blind spot: confusing attention with respect.
- Decision rule: choose arenas where results are legible and credit is trackable.

ENJOYMENT (Enjoyment)
---------------------
Preview
- Life is meant to be lived, not only optimized. You recharge through play, spontaneity, and memorable experiences.

Paid
- Enjoyment is your need for positive emotion and sensory richness. It keeps you human, flexible, and resilient.
- When honored: creativity, charisma, better relationships.
- When overused: impulsivity, "future me will deal with it."
- Blind spot: avoiding hard choices by chasing dopamine.
- Decision rule: schedule joy like a responsibility, not as an afterthought.

INTEGRITY (Integrity)
---------------------
Preview
- Alignment is everything. You would rather be real than popular, and you dislike compromises that feel like self-betrayal.

Paid
- Integrity is your need to live by principles and truth. You respect clean ethics and clear conscience.
- When honored: trust, calm confidence, strong boundaries.
- When threatened: rigidity, moral fatigue, isolation.
- Blind spot: "right" becoming more important than "effective."
- Decision rule: keep your non-negotiables few, sharp, and explicit.

ORDER (Order)
-------------
Preview
- You create calm through structure. Clear rules and proven methods are your way to reduce chaos and mistakes.

Paid
- Order is your need for predictability through systems. You do not worship rules, you use them to protect quality and sanity.
- When honored: reliability, efficiency, fewer regrets.
- When overused: control, inflexibility, slow adaptation.
- Blind spot: mistaking structure for certainty.
- Decision rule: standardize the repeatable, experiment only at the edges.


8. Conflict library (user-facing)
---------------------------------
Show only pairs where tension is not Low.

FREEDOM vs SECURITY
-------------------
High tension
- You want maximum choice and maximum safety at the same time. Your stress pattern is swinging between "escape" and "lock it down."
Playbook
- Define a safe sandbox: experiments with capped downside and a clear exit plan.

GROWTH vs ORDER
---------------
High tension
- You crave novelty but also crave reliable structure. You may start new systems, then get tired of maintaining them.
Playbook
- Keep 1 stable routine, run growth in time-boxed sprints.

ACHIEVEMENT vs CONNECTION
-------------------------
High tension
- You want to win and you want to keep everyone close. The trap is self-sacrifice or hidden resentment.
Playbook
- Agree on shared standards and explicit tradeoffs, not silent ones.

RECOGNITION vs INTEGRITY
------------------------
High tension
- You want to be seen, but you refuse to fake it. Great combo, but it can feel lonely.
Playbook
- Build a credibility brand: proof, not performance.

ENJOYMENT vs CONTRIBUTION
-------------------------
High tension
- You want a meaningful life and a joyful life, and you might treat joy as "unearned."
Playbook
- Set a joy budget. Joy is maintenance, not indulgence.


9. Result templates (user-facing)
---------------------------------

Free preview
------------
Title
- Your Values Compass - Top 3 Drivers

Your Top 3
- {TOP1}, {TOP2}, {TOP3}

Quick read (30 seconds)
- {TOP1}: {TOP1_PREVIEW_2_SENTENCES}
- {TOP2}: {TOP2_PREVIEW_2_SENTENCES}
- {TOP3}: {TOP3_PREVIEW_2_SENTENCES}

Hidden tensions (teaser)
- Strongest tension: {PAIR_1_NAME} - {PAIR_1_LEVEL}
- Secondary tension: {PAIR_2_NAME} - {PAIR_2_LEVEL}

Paywall hook
- Your top values can work together, or quietly sabotage each other. The full report shows how your value conflicts shape money decisions, career moves, relationships, and motivation, plus a practical decision playbook you can use immediately.

Paid full report structure
--------------------------
Title
- Your Values Compass - Full Report

Sections
1) Your Top 3 Values Deep Dive (3 full profiles)
2) Your Value Conflict Map (1-3 highest tensions + playbooks)
3) Decision Style (rules based on Top 3 and conflicts)
4) Energy Leaks and Triggers (burnout sources and recharge levers)
5) Work and Money Fit (where you thrive, where you break)
6) 7-Day Alignment Plan (3 micro-experiments + a stop-doing list)

7-day plan generator examples (dynamic, based on Top 1)
- If TOP1=FREEDOM: 1 reversible experiment, 1 boundary, 1 "no-permission" project
- If TOP1=SECURITY: 1 safety net upgrade, 1 risk you cap, 1 routine you standardize
- If TOP1=ACHIEVEMENT: 1 metric, 1 deep work block, 1 ship deadline


10. Paywall copy (user-facing)
------------------------------
Primary CTA button
- Unlock my full Values Compass

Bullets
- Your Top 3 values explained in depth
- Your conflict map and how to resolve it
- A practical decision playbook for work, money, and relationships
- A 7-day alignment plan you can actually follow

Short line
- See why your motivation spikes, then suddenly disappears.

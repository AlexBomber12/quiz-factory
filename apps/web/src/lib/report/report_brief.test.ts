import { describe, expect, it } from "vitest";

import { loadTestSpecById } from "../content/load";
import type { TestSpec } from "../content/types";
import type { AttemptSummaryInput } from "./report_job_inputs";
import { buildReportBrief } from "./report_brief";
import { normalizeScaleScore } from "./scale_normalization";

const createAttemptSummary = (input: {
  testId: string;
  scaleScores: Record<string, number>;
  totalScore: number;
  computedAt?: string;
}): AttemptSummaryInput => ({
  tenant_id: "tenant-demo",
  test_id: input.testId,
  session_id: "session-demo",
  distinct_id: "distinct-demo",
  locale: "en",
  computed_at: input.computedAt ?? "2026-01-01T00:00:00.000Z",
  band_id: "band-demo",
  scale_scores: input.scaleScores,
  total_score: input.totalScore
});

const multiScaleSpec: TestSpec = {
  test_id: "test-brief-demo",
  slug: "brief-demo",
  version: 1,
  category: "demo",
  locales: {
    en: {
      title: "Brief Demo",
      short_description: "Brief demo test",
      intro: "Intro",
      paywall_headline: "Paywall",
      report_title: "Report"
    }
  },
  questions: [
    {
      id: "q1",
      type: "single_choice",
      prompt: { en: "Question 1" },
      options: [
        { id: "q1a", label: { en: "A" } },
        { id: "q1b", label: { en: "B" } }
      ]
    },
    {
      id: "q2",
      type: "single_choice",
      prompt: { en: "Question 2" },
      options: [
        { id: "q2a", label: { en: "A" } },
        { id: "q2b", label: { en: "B" } }
      ]
    }
  ],
  scoring: {
    scales: ["delta", "beta", "alpha", "gamma"],
    option_weights: {
      q1a: { alpha: 0, beta: 0, gamma: 0, delta: 0 },
      q1b: { alpha: 10, beta: 10, gamma: 10, delta: 10 },
      q2a: { alpha: 0, beta: 0, gamma: 0, delta: 0 },
      q2b: { alpha: 0, beta: 0, gamma: 0, delta: 0 }
    }
  },
  result_bands: [
    {
      band_id: "band-demo",
      min_score_inclusive: 0,
      max_score_inclusive: 100,
      copy: {
        en: {
          headline: "Demo",
          summary: "Demo summary",
          bullets: ["Demo bullet"]
        }
      }
    }
  ]
};

describe("report brief", () => {
  it("normalizes scores to the 0-100 range with clamping", () => {
    const spec = loadTestSpecById("test-focus-rhythm");

    const below = normalizeScaleScore({
      spec,
      scaleId: "tempo",
      rawScore: -999
    });
    const above = normalizeScaleScore({
      spec,
      scaleId: "tempo",
      rawScore: 999
    });

    expect(below).toBe(0);
    expect(above).toBe(100);
  });

  it("builds stable output for the same fixture inputs", () => {
    const spec = loadTestSpecById("test-focus-rhythm");
    const attemptSummary = createAttemptSummary({
      testId: spec.test_id,
      scaleScores: { tempo: 14 },
      totalScore: 14
    });

    const first = buildReportBrief({ spec, attemptSummary });
    const second = buildReportBrief({
      spec,
      attemptSummary: {
        ...attemptSummary,
        scale_scores: { ...attemptSummary.scale_scores }
      }
    });

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("sorts scales deterministically and keeps top_scales capped at 3", () => {
    const brief = buildReportBrief({
      spec: multiScaleSpec,
      attemptSummary: createAttemptSummary({
        testId: multiScaleSpec.test_id,
        scaleScores: {
          gamma: 6,
          alpha: 8,
          delta: 9,
          beta: 8
        },
        totalScore: 31
      })
    });

    expect(brief.scales.map((scale) => scale.scale_id)).toEqual(["alpha", "beta", "delta", "gamma"]);
    expect(brief.top_scales).toHaveLength(Math.min(3, brief.scales.length));
    expect(brief.top_scales.map((scale) => scale.scale_id)).toEqual(["delta", "alpha", "beta"]);
  });
});

import { describe, expect, it } from "vitest";

import type { TestSpec } from "../content/types";
import { scoreTest } from "./scoring";

const testSpec: TestSpec = {
  test_id: "test-demo",
  slug: "demo",
  version: 1,
  category: "demo",
  locales: {
    en: {
      title: "Demo",
      short_description: "Demo description",
      intro: "Intro",
      paywall_headline: "Paywall headline",
      report_title: "Report title"
    }
  },
  questions: [
    {
      id: "q1",
      type: "single_choice",
      prompt: { en: "Question one" },
      options: [
        { id: "o1", label: { en: "Option 1" } },
        { id: "o2", label: { en: "Option 2" } }
      ]
    },
    {
      id: "q2",
      type: "single_choice",
      prompt: { en: "Question two" },
      options: [
        { id: "o3", label: { en: "Option 3" } },
        { id: "o4", label: { en: "Option 4" } }
      ]
    }
  ],
  scoring: {
    scales: ["alpha", "beta"],
    option_weights: {
      o1: { alpha: 1, beta: 0 },
      o2: { alpha: 2, beta: 1 },
      o3: { alpha: 0, beta: 2 },
      o4: { alpha: 3, beta: 0 }
    }
  },
  result_bands: [
    {
      band_id: "low",
      min_score_inclusive: 0,
      max_score_inclusive: 3,
      copy: {
        en: {
          headline: "Low",
          summary: "Low summary",
          bullets: ["Low bullet"]
        }
      }
    },
    {
      band_id: "high",
      min_score_inclusive: 4,
      max_score_inclusive: 10,
      copy: {
        en: {
          headline: "High",
          summary: "High summary",
          bullets: ["High bullet"]
        }
      }
    }
  ]
};

describe("scoreTest", () => {
  it("scores answers and resolves the band", () => {
    const result = scoreTest(testSpec, {
      q1: "o2",
      q2: "o3"
    });

    expect(result.scale_scores).toEqual({
      alpha: 2,
      beta: 3
    });
    expect(result.total_score).toBe(5);
    expect(result.band_id).toBe("high");
  });

  it("rejects missing answers", () => {
    expect(() =>
      scoreTest(testSpec, {
        q1: "o1"
      })
    ).toThrow("Missing answer");
  });
});

import { describe, expect, it } from "vitest";

import type { CatalogTest } from "../../lib/catalog/catalog";
import type { PublishedTenantTest } from "../../lib/content/provider";
import type { TestSpec } from "../../lib/content/types";
import { buildTestLandingProps, TEST_LANDING_ANCHORS } from "./test_landing_props";

const GOLDEN_TEST: CatalogTest = {
  test_id: "test-focus-rhythm",
  slug: "focus-rhythm",
  title: "Focus Rhythm",
  short_description: "Find your focus pattern in minutes.",
  estimated_minutes: 8
};

const buildSpec = (questionCount: number): TestSpec => {
  const questions = Array.from({ length: questionCount }, (_unused, index) => {
    const optionId = `q${index + 1}-opt-1`;
    return {
      id: `q${index + 1}`,
      type: "single_choice" as const,
      prompt: {
        en: `Question ${index + 1}`
      },
      options: [
        {
          id: optionId,
          label: {
            en: "Agree"
          }
        }
      ]
    };
  });

  const optionWeights = Object.fromEntries(
    questions.flatMap((question) =>
      question.options.map((option) => [option.id, { focus: 1 }])
    )
  );

  return {
    test_id: "test-focus-rhythm",
    slug: "focus-rhythm",
    version: 1,
    category: "Productivity",
    estimated_minutes: 8,
    locales: {
      en: {
        title: "Focus Rhythm",
        short_description: "Find your focus pattern in minutes.",
        intro: "A fast check-in for your daily focus habits.",
        paywall_headline: "Unlock your full Focus Rhythm report",
        report_title: "Focus Rhythm Report"
      }
    },
    questions,
    scoring: {
      scales: ["focus"],
      option_weights: optionWeights
    },
    result_bands: [
      {
        band_id: "steady",
        min_score_inclusive: 0,
        max_score_inclusive: 100,
        copy: {
          en: {
            headline: "Steady",
            summary: "You keep stable focus across most tasks.",
            bullets: ["Keep your current routine."]
          }
        }
      }
    ]
  };
};

const buildPublished = (
  questionCount: number
): Pick<PublishedTenantTest, "spec" | "test"> => {
  const spec = buildSpec(questionCount);
  return {
    spec,
    test: {
      test_id: spec.test_id,
      slug: spec.slug,
      category: "Productivity",
      title: "Focus Rhythm",
      description: "Find your focus pattern in minutes.",
      intro: "A fast check-in for your daily focus habits.",
      paywall_headline: "Unlock your full Focus Rhythm report",
      report_title: "Focus Rhythm Report",
      questions: spec.questions.map((question) => ({
        id: question.id,
        type: "single_choice",
        prompt: `Question ${question.id}`,
        options: question.options.map((option) => ({
          id: option.id,
          label: "Agree"
        }))
      })),
      scoring: spec.scoring,
      result_bands: spec.result_bands,
      locale: "en"
    }
  };
};

describe("test landing props mapper", () => {
  it("uses the run route for the primary CTA", () => {
    const landing = buildTestLandingProps(GOLDEN_TEST, buildPublished(12));

    expect(landing.hero.primaryCta.href).toBe("/t/focus-rhythm/run");
  });

  it("keeps anchor ids stable for section links", () => {
    const landing = buildTestLandingProps(GOLDEN_TEST, buildPublished(12));

    expect(landing.anchors).toEqual(TEST_LANDING_ANCHORS);
    expect(landing.whatYouGet.id).toBe("what-you-get");
    expect(landing.navbar.links.map((link) => link.href)).toEqual(["#how", "#proof", "#faq"]);
  });

  it("includes questions count in hero stats when spec data is available", () => {
    const landing = buildTestLandingProps(GOLDEN_TEST, buildPublished(12));

    const questionsStat = landing.hero.stats.find((stat) => stat.label === "Questions");
    expect(questionsStat?.value).toBe("12");
  });
});

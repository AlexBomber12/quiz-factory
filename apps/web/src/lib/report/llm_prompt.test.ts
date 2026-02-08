import { describe, expect, it } from "vitest";

import { buildLlmPrompt } from "./llm_prompt";
import { LLM_REPORT_SCHEMA_NAME } from "./llm_report_schema";
import type { ReportBrief } from "./report_brief";

const briefFixture: ReportBrief = {
  tenant_id: "tenant-demo",
  test_id: "test-focus-rhythm",
  slug: "focus-rhythm",
  locale: "en",
  computed_at_utc: "2026-01-01T00:00:00.000Z",
  band_id: "band-balanced",
  total_score: 42,
  scales: [
    {
      scale_id: "tempo",
      raw_score: 42,
      normalized_score_0_100: 84
    }
  ],
  top_scales: [
    {
      scale_id: "tempo",
      raw_score: 42,
      normalized_score_0_100: 84
    }
  ]
};

describe("llm prompt", () => {
  it("includes required report brief and schema identifiers", () => {
    const prompt = buildLlmPrompt({
      brief: briefFixture,
      style_id: "neutral"
    });

    expect(prompt.user).toContain(briefFixture.test_id);
    expect(prompt.user).toContain(briefFixture.locale);
    expect(prompt.system).toContain(LLM_REPORT_SCHEMA_NAME);
  });
});

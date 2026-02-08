import { describe, expect, it } from "vitest";

import type { BriefScale, ReportBrief } from "./report_brief";
import { inferStyleIdFromBrief } from "./style_inference";

const buildScale = (scaleId: string, normalizedScore: number): BriefScale => ({
  scale_id: scaleId,
  raw_score: normalizedScore,
  normalized_score_0_100: normalizedScore
});

const buildBrief = (topScales: BriefScale[]): ReportBrief => ({
  tenant_id: "tenant-demo",
  test_id: "test-demo",
  slug: "test-demo",
  locale: "en",
  computed_at_utc: "2026-01-01T00:00:00.000Z",
  band_id: "band-demo",
  total_score: 100,
  scales: topScales,
  top_scales: topScales
});

describe("inferStyleIdFromBrief", () => {
  it("returns analytical when top scale contains an analytical keyword", () => {
    const styleId = inferStyleIdFromBrief(
      buildBrief([buildScale("logic_planning", 88), buildScale("creative_flow", 60)])
    );

    expect(styleId).toBe("analytical");
  });

  it("returns intuitive when top scale contains an intuitive keyword", () => {
    const styleId = inferStyleIdFromBrief(
      buildBrief([buildScale("gut_signal", 86), buildScale("detail_focus", 72)])
    );

    expect(styleId).toBe("intuitive");
  });

  it("returns balanced when top scale does not match a keyword", () => {
    const styleId = inferStyleIdFromBrief(
      buildBrief([buildScale("tempo", 90), buildScale("clarity", 66)])
    );

    expect(styleId).toBe("balanced");
  });

  it("returns balanced when top score spread is 5 or less", () => {
    const styleId = inferStyleIdFromBrief(
      buildBrief([buildScale("analytical_depth", 81), buildScale("tempo", 77)])
    );

    expect(styleId).toBe("balanced");
  });
});

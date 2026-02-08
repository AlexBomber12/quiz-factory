import type { ReportBrief } from "./report_brief";
import { DEFAULT_STYLE_ID } from "./style_cards";

const ANALYTICAL_KEYWORDS = ["analyt", "logic", "system", "detail"];
const INTUITIVE_KEYWORDS = ["intuit", "feel", "creative", "gut"];
const BALANCED_SPREAD_THRESHOLD = 5;

const matchesAnyKeyword = (value: string, keywords: string[]): boolean =>
  keywords.some((keyword) => value.includes(keyword));

export const inferStyleIdFromBrief = (brief: ReportBrief): string => {
  const [topScale, secondScale] = brief.top_scales;
  if (!topScale) {
    return DEFAULT_STYLE_ID;
  }

  if (secondScale) {
    const spread = Math.abs(topScale.normalized_score_0_100 - secondScale.normalized_score_0_100);
    if (spread <= BALANCED_SPREAD_THRESHOLD) {
      return DEFAULT_STYLE_ID;
    }
  }

  const normalizedScaleId = topScale.scale_id.toLowerCase();

  if (matchesAnyKeyword(normalizedScaleId, ANALYTICAL_KEYWORDS)) {
    return "analytical";
  }

  if (matchesAnyKeyword(normalizedScaleId, INTUITIVE_KEYWORDS)) {
    return "intuitive";
  }

  return DEFAULT_STYLE_ID;
};

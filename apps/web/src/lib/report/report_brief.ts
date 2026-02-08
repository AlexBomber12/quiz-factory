import type { TestSpec } from "../content/types";

import type { AttemptSummaryInput } from "./report_job_inputs";
import { normalizeScaleScore } from "./scale_normalization";

export const SCORING_VERSION = "v1";

export type BriefScale = {
  scale_id: string;
  raw_score: number;
  normalized_score_0_100: number;
};

export type ReportBrief = {
  tenant_id: string;
  test_id: string;
  slug: string;
  locale: string;
  computed_at_utc: string;
  band_id: string;
  total_score: number;
  scales: BriefScale[];
  top_scales: BriefScale[];
};

type BuildReportBriefInput = {
  spec: TestSpec;
  attemptSummary: AttemptSummaryInput;
};

const compareScaleIds = (left: string, right: string): number => {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
};

const normalizeIsoTimestamp = (value: string): string => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Invalid attempt summary timestamp.");
  }

  return new Date(parsed).toISOString();
};

export const buildReportBrief = ({ spec, attemptSummary }: BuildReportBriefInput): ReportBrief => {
  if (attemptSummary.test_id !== spec.test_id) {
    throw new Error("Attempt summary test_id does not match spec test_id.");
  }

  const scales = [...spec.scoring.scales]
    .sort(compareScaleIds)
    .map((scaleId): BriefScale => {
      const rawScore = attemptSummary.scale_scores[scaleId];
      if (typeof rawScore !== "number" || !Number.isFinite(rawScore)) {
        throw new Error(`Missing or invalid scale score for ${scaleId}.`);
      }

      return {
        scale_id: scaleId,
        raw_score: rawScore,
        normalized_score_0_100: normalizeScaleScore({
          spec,
          scaleId,
          rawScore
        })
      };
    });

  const topScales = [...scales]
    .sort((left, right) => {
      const byNormalized = right.normalized_score_0_100 - left.normalized_score_0_100;
      if (byNormalized !== 0) {
        return byNormalized;
      }

      return compareScaleIds(left.scale_id, right.scale_id);
    })
    .slice(0, 3);

  return {
    tenant_id: attemptSummary.tenant_id,
    test_id: spec.test_id,
    slug: spec.slug,
    locale: attemptSummary.locale,
    computed_at_utc: normalizeIsoTimestamp(attemptSummary.computed_at),
    band_id: attemptSummary.band_id,
    total_score: attemptSummary.total_score,
    scales,
    top_scales: topScales
  };
};

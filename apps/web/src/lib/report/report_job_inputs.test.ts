import { describe, expect, it } from "vitest";

import {
  DEFAULT_REPORT_JOB_CLAIM_LIMIT,
  parseReportJobClaimLimit,
  sanitizeAttemptSummaryInput,
  sanitizeEnqueueReportJobInput,
  stableSerializeScaleScores
} from "./report_job_inputs";

describe("report job inputs", () => {
  it("rejects invalid attempt summary payloads", () => {
    expect(
      sanitizeAttemptSummaryInput({
        tenant_id: "tenant-1",
        test_id: "test-1",
        session_id: "session-1",
        distinct_id: "distinct-1",
        locale: "en",
        computed_at: "not-a-date",
        band_id: "band-a",
        scale_scores: { introversion: 7 },
        total_score: 7
      })
    ).toBeNull();

    expect(
      sanitizeAttemptSummaryInput({
        tenant_id: "tenant-1",
        test_id: "test-1",
        session_id: "session-1",
        distinct_id: "distinct-1",
        locale: "en",
        computed_at: "2025-01-01T00:00:00.000Z",
        band_id: "band-a",
        scale_scores: { introversion: Number.NaN },
        total_score: 7
      })
    ).toBeNull();
  });

  it("rejects invalid report job enqueue payloads", () => {
    expect(
      sanitizeEnqueueReportJobInput({
        purchase_id: "",
        tenant_id: "tenant-1",
        test_id: "test-1",
        session_id: "session-1",
        locale: "en"
      })
    ).toBeNull();
  });

  it("serializes scale_scores with sorted keys", () => {
    const first = stableSerializeScaleScores({
      extraversion: 4,
      agreeableness: 3
    });
    const second = stableSerializeScaleScores({
      agreeableness: 3,
      extraversion: 4
    });

    expect(first).toBe('{"agreeableness":3,"extraversion":4}');
    expect(second).toBe('{"agreeableness":3,"extraversion":4}');
  });

  it("falls back to default claim limit for invalid values", () => {
    expect(parseReportJobClaimLimit(null)).toBe(DEFAULT_REPORT_JOB_CLAIM_LIMIT);
    expect(parseReportJobClaimLimit("0")).toBe(DEFAULT_REPORT_JOB_CLAIM_LIMIT);
    expect(parseReportJobClaimLimit("-5")).toBe(DEFAULT_REPORT_JOB_CLAIM_LIMIT);
    expect(parseReportJobClaimLimit("abc")).toBe(DEFAULT_REPORT_JOB_CLAIM_LIMIT);
    expect(parseReportJobClaimLimit("7")).toBe(7);
  });
});

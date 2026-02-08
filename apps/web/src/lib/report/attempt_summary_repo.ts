import { getContentDbPool } from "../content_db/pool";

import {
  sanitizeAttemptSummaryInput,
  sanitizeScaleScores,
  stableSerializeScaleScores,
  type AttemptSummaryInput
} from "./report_job_inputs";

type TimestampValue = Date | string;

type AttemptSummaryRow = {
  tenant_id: string;
  test_id: string;
  session_id: string;
  distinct_id: string;
  locale: string;
  computed_at: TimestampValue;
  band_id: string;
  scale_scores: unknown;
  total_score: number;
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toIsoString = (value: TimestampValue): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
};

export const upsertAttemptSummary = async (input: AttemptSummaryInput): Promise<void> => {
  const normalized = sanitizeAttemptSummaryInput(input);
  if (!normalized) {
    throw new Error("Invalid attempt summary input.");
  }

  const scaleScoresJson = stableSerializeScaleScores(normalized.scale_scores);
  if (!scaleScoresJson) {
    throw new Error("Invalid scale_scores payload.");
  }

  const pool = getContentDbPool();
  await pool.query(
    `
      INSERT INTO attempt_summaries (
        tenant_id,
        test_id,
        session_id,
        distinct_id,
        locale,
        computed_at,
        band_id,
        scale_scores,
        total_score
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
      ON CONFLICT (tenant_id, test_id, session_id)
      DO UPDATE SET
        distinct_id = EXCLUDED.distinct_id,
        locale = EXCLUDED.locale,
        computed_at = EXCLUDED.computed_at,
        band_id = EXCLUDED.band_id,
        scale_scores = EXCLUDED.scale_scores,
        total_score = EXCLUDED.total_score
    `,
    [
      normalized.tenant_id,
      normalized.test_id,
      normalized.session_id,
      normalized.distinct_id,
      normalized.locale,
      normalized.computed_at,
      normalized.band_id,
      scaleScoresJson,
      normalized.total_score
    ]
  );
};

export const getAttemptSummary = async (
  tenantId: string,
  testId: string,
  sessionId: string
): Promise<AttemptSummaryInput | null> => {
  const normalizedTenantId = normalizeString(tenantId);
  const normalizedTestId = normalizeString(testId);
  const normalizedSessionId = normalizeString(sessionId);
  if (!normalizedTenantId || !normalizedTestId || !normalizedSessionId) {
    return null;
  }

  const pool = getContentDbPool();
  const { rows } = await pool.query<AttemptSummaryRow>(
    `
      SELECT
        tenant_id,
        test_id,
        session_id,
        distinct_id,
        locale,
        computed_at,
        band_id,
        scale_scores,
        total_score
      FROM attempt_summaries
      WHERE tenant_id = $1
        AND test_id = $2
        AND session_id = $3
      LIMIT 1
    `,
    [normalizedTenantId, normalizedTestId, normalizedSessionId]
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  const scaleScores = sanitizeScaleScores(row.scale_scores);
  if (!scaleScores) {
    return null;
  }

  const normalized = sanitizeAttemptSummaryInput({
    tenant_id: row.tenant_id,
    test_id: row.test_id,
    session_id: row.session_id,
    distinct_id: row.distinct_id,
    locale: row.locale,
    computed_at: toIsoString(row.computed_at),
    band_id: row.band_id,
    scale_scores: scaleScores,
    total_score: row.total_score
  });

  return normalized;
};

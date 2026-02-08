export const DEFAULT_REPORT_JOB_CLAIM_LIMIT = 5;
const MAX_REPORT_JOB_CLAIM_LIMIT = 50;

export type ScaleScores = Record<string, number>;

export type AttemptSummaryInput = {
  tenant_id: string;
  test_id: string;
  session_id: string;
  distinct_id: string;
  locale: string;
  computed_at: string;
  band_id: string;
  scale_scores: ScaleScores;
  total_score: number;
};

export type EnqueueReportJobInput = {
  purchase_id: string;
  tenant_id: string;
  test_id: string;
  session_id: string;
  locale: string;
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeInteger = (value: unknown): number | null => {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      return null;
    }
    return value;
  }

  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
};

const normalizeIsoTimestamp = (value: unknown): string | null => {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString();
};

const stableStringify = (value: unknown): string => {
  if (value === undefined) {
    return "null";
  }

  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    const parts = value.map((entry) => stableStringify(entry));
    return `[${parts.join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right)
  );
  const parts = entries.map(
    ([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`
  );
  return `{${parts.join(",")}}`;
};

export const sanitizeScaleScores = (value: unknown): ScaleScores | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, entryValue]): [string | null, number | null] => {
      const normalizedKey = normalizeString(key);
      if (typeof entryValue !== "number" || !Number.isFinite(entryValue)) {
        return [null, null];
      }

      return [normalizedKey, entryValue];
    })
    .sort(([left], [right]) => {
      if (!left || !right) {
        return 0;
      }
      return left.localeCompare(right);
    });

  if (entries.length === 0) {
    return null;
  }

  const normalized: ScaleScores = {};
  for (const [key, entryValue] of entries) {
    if (!key || entryValue === null) {
      return null;
    }
    normalized[key] = entryValue;
  }

  return normalized;
};

export const stableSerializeScaleScores = (value: unknown): string | null => {
  const normalized = sanitizeScaleScores(value);
  if (!normalized) {
    return null;
  }

  return stableStringify(normalized);
};

export const sanitizeAttemptSummaryInput = (input: {
  tenant_id: unknown;
  test_id: unknown;
  session_id: unknown;
  distinct_id: unknown;
  locale: unknown;
  computed_at: unknown;
  band_id: unknown;
  scale_scores: unknown;
  total_score: unknown;
}): AttemptSummaryInput | null => {
  const tenantId = normalizeString(input.tenant_id);
  const testId = normalizeString(input.test_id);
  const sessionId = normalizeString(input.session_id);
  const distinctId = normalizeString(input.distinct_id);
  const locale = normalizeString(input.locale);
  const computedAt = normalizeIsoTimestamp(input.computed_at);
  const bandId = normalizeString(input.band_id);
  const scaleScores = sanitizeScaleScores(input.scale_scores);
  const totalScore = normalizeInteger(input.total_score);

  if (
    !tenantId ||
    !testId ||
    !sessionId ||
    !distinctId ||
    !locale ||
    !computedAt ||
    !bandId ||
    !scaleScores ||
    totalScore === null
  ) {
    return null;
  }

  return {
    tenant_id: tenantId,
    test_id: testId,
    session_id: sessionId,
    distinct_id: distinctId,
    locale,
    computed_at: computedAt,
    band_id: bandId,
    scale_scores: scaleScores,
    total_score: totalScore
  };
};

export const sanitizeEnqueueReportJobInput = (input: {
  purchase_id: unknown;
  tenant_id: unknown;
  test_id: unknown;
  session_id: unknown;
  locale: unknown;
}): EnqueueReportJobInput | null => {
  const purchaseId = normalizeString(input.purchase_id);
  const tenantId = normalizeString(input.tenant_id);
  const testId = normalizeString(input.test_id);
  const sessionId = normalizeString(input.session_id);
  const locale = normalizeString(input.locale);

  if (!purchaseId || !tenantId || !testId || !sessionId || !locale) {
    return null;
  }

  return {
    purchase_id: purchaseId,
    tenant_id: tenantId,
    test_id: testId,
    session_id: sessionId,
    locale
  };
};

export const parseReportJobClaimLimit = (value: string | null | undefined): number => {
  const parsed = normalizeInteger(value);
  if (parsed === null || parsed <= 0) {
    return DEFAULT_REPORT_JOB_CLAIM_LIMIT;
  }

  return Math.min(parsed, MAX_REPORT_JOB_CLAIM_LIMIT);
};

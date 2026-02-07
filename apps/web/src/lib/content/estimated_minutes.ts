export const SPEC_ESTIMATED_MINUTES_MIN = 1;
export const SPEC_ESTIMATED_MINUTES_MAX = 120;
export const FALLBACK_ESTIMATED_MINUTES_MIN = 2;
export const FALLBACK_ESTIMATED_MINUTES_MAX = 20;
const QUESTIONS_PER_MINUTE = 2;

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const toSafeQuestionCount = (value: unknown): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value as number));
};

export const isValidSpecEstimatedMinutes = (value: unknown): value is number => {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= SPEC_ESTIMATED_MINUTES_MIN &&
    value <= SPEC_ESTIMATED_MINUTES_MAX
  );
};

export const computeEstimatedMinutesFromQuestionCount = (questionCount: number): number => {
  const safeQuestionCount = toSafeQuestionCount(questionCount);
  const rawEstimate = Math.ceil(safeQuestionCount / QUESTIONS_PER_MINUTE);
  return clamp(
    rawEstimate,
    FALLBACK_ESTIMATED_MINUTES_MIN,
    FALLBACK_ESTIMATED_MINUTES_MAX
  );
};

export const getEstimatedMinutes = (spec: {
  estimated_minutes?: unknown;
  questions?: unknown;
}): number => {
  if (isValidSpecEstimatedMinutes(spec.estimated_minutes)) {
    return spec.estimated_minutes;
  }

  const questionCount = Array.isArray(spec.questions) ? spec.questions.length : 0;
  return computeEstimatedMinutesFromQuestionCount(questionCount);
};

import type { TestSpec } from "../content/types";

const DEFAULT_NORMALIZED_SCORE = 50;
const NORMALIZED_MIN = 0;
const NORMALIZED_MAX = 100;

export type ScaleNormalizationBounds = {
  min_possible: number;
  max_possible: number;
};

type NormalizeScaleScoreInput = {
  spec: TestSpec;
  scaleId: string;
  rawScore: number;
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const resolveScaleWeight = (spec: TestSpec, scaleId: string, optionId: string): number => {
  const optionWeights = spec.scoring.option_weights[optionId];
  if (!optionWeights) {
    throw new Error(`Missing weights for option ${optionId}.`);
  }

  const weight = optionWeights[scaleId];
  if (weight === undefined) {
    return 0;
  }

  if (typeof weight !== "number" || !Number.isFinite(weight)) {
    throw new Error(`Invalid weight for scale ${scaleId}.`);
  }

  return weight;
};

export const getScaleNormalizationBounds = (
  spec: TestSpec,
  scaleId: string
): ScaleNormalizationBounds => {
  let minPossible = 0;
  let maxPossible = 0;

  for (const question of spec.questions) {
    let questionMin = Number.POSITIVE_INFINITY;
    let questionMax = Number.NEGATIVE_INFINITY;

    for (const option of question.options) {
      const weight = resolveScaleWeight(spec, scaleId, option.id);
      questionMin = Math.min(questionMin, weight);
      questionMax = Math.max(questionMax, weight);
    }

    if (!Number.isFinite(questionMin) || !Number.isFinite(questionMax)) {
      throw new Error(`Question ${question.id} has no options.`);
    }

    minPossible += questionMin;
    maxPossible += questionMax;
  }

  return {
    min_possible: minPossible,
    max_possible: maxPossible
  };
};

export const normalizeScaleScore = ({
  spec,
  scaleId,
  rawScore
}: NormalizeScaleScoreInput): number => {
  if (!Number.isFinite(rawScore)) {
    throw new Error(`Invalid raw score for scale ${scaleId}.`);
  }

  const { min_possible: minPossible, max_possible: maxPossible } = getScaleNormalizationBounds(
    spec,
    scaleId
  );

  if (maxPossible === minPossible) {
    return DEFAULT_NORMALIZED_SCORE;
  }

  const normalized = Math.round(
    ((rawScore - minPossible) / (maxPossible - minPossible)) * NORMALIZED_MAX
  );
  return clamp(normalized, NORMALIZED_MIN, NORMALIZED_MAX);
};

import type { TestSpec } from "../content/types";

export type ScoreResult = {
  scale_scores: Record<string, number>;
  total_score: number;
  band_id: string;
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const ensureAnswersObject = (answers: Record<string, unknown>): Record<string, string> => {
  const normalized: Record<string, string> = {};

  for (const [questionId, optionId] of Object.entries(answers)) {
    const normalizedQuestionId = normalizeString(questionId);
    const normalizedOptionId = normalizeString(optionId);
    if (!normalizedQuestionId || !normalizedOptionId) {
      throw new Error("Answers must map question ids to option ids.");
    }
    normalized[normalizedQuestionId] = normalizedOptionId;
  }

  return normalized;
};

export const scoreTest = (
  test: TestSpec,
  rawAnswers: Record<string, unknown>
): ScoreResult => {
  const answers = ensureAnswersObject(rawAnswers);
  const questionById = new Map<string, TestSpec["questions"][number]>();
  for (const question of test.questions) {
    questionById.set(question.id, question);
  }

  for (const questionId of Object.keys(answers)) {
    if (!questionById.has(questionId)) {
      throw new Error(`Unknown question id ${questionId}.`);
    }
  }

  const scaleScores: Record<string, number> = {};
  for (const scaleId of test.scoring.scales) {
    scaleScores[scaleId] = 0;
  }

  for (const question of test.questions) {
    const answer = answers[question.id];
    if (!answer) {
      throw new Error(`Missing answer for question ${question.id}.`);
    }

    const option = question.options.find((candidate) => candidate.id === answer);
    if (!option) {
      throw new Error(`Unknown option id ${answer} for question ${question.id}.`);
    }

    const weights = test.scoring.option_weights[option.id];
    if (!weights) {
      throw new Error(`Missing weights for option ${option.id}.`);
    }

    for (const [scaleId, weight] of Object.entries(weights)) {
      if (!(scaleId in scaleScores)) {
        throw new Error(`Unknown scale id ${scaleId}.`);
      }
      if (typeof weight !== "number" || !Number.isFinite(weight)) {
        throw new Error(`Invalid weight for scale ${scaleId}.`);
      }
      scaleScores[scaleId] += weight;
    }
  }

  const totalScore = Object.values(scaleScores).reduce((sum, value) => sum + value, 0);
  const band = test.result_bands.find(
    (candidate) =>
      totalScore >= candidate.min_score_inclusive &&
      totalScore <= candidate.max_score_inclusive
  );

  if (!band) {
    throw new Error("No matching result band.");
  }

  return {
    scale_scores: scaleScores,
    total_score: totalScore,
    band_id: band.band_id
  };
};

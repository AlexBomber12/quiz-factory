import { logger } from "@/lib/logger";

const RESUME_STATE_PREFIX = "quiz_factory:resume_state";

export const RESUME_STATE_VERSION = 1;

export type ResumeState = {
  version: number;
  test_id: string;
  slug: string;
  session_id: string;
  attempt_token: string;
  current_index: number;
  answers: Record<string, string>;
  updated_at_utc: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const parseNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const parseAnswers = (value: unknown): Record<string, string> | null => {
  if (!isRecord(value)) {
    return null;
  }

  const output: Record<string, string> = {};
  for (const [key, answer] of Object.entries(value)) {
    if (typeof answer !== "string") {
      return null;
    }
    output[key] = answer;
  }

  return output;
};

const parseResumeState = (value: unknown): ResumeState | null => {
  if (!isRecord(value)) {
    return null;
  }

  const versionValue = value.version;
  const currentIndexValue = value.current_index;

  if (
    typeof versionValue !== "number" ||
    !Number.isInteger(versionValue) ||
    typeof currentIndexValue !== "number" ||
    !Number.isInteger(currentIndexValue) ||
    currentIndexValue < 0
  ) {
    return null;
  }

  const version = versionValue;
  const currentIndex = currentIndexValue;

  const testId = parseNonEmptyString(value.test_id);
  const slug = parseNonEmptyString(value.slug);
  const sessionId = parseNonEmptyString(value.session_id);
  const attemptToken = parseNonEmptyString(value.attempt_token);
  const updatedAtUtc = parseNonEmptyString(value.updated_at_utc);
  const answers = parseAnswers(value.answers);

  if (!testId || !slug || !sessionId || !attemptToken || !updatedAtUtc || !answers) {
    return null;
  }

  return {
    version,
    test_id: testId,
    slug,
    session_id: sessionId,
    attempt_token: attemptToken,
    current_index: currentIndex,
    answers,
    updated_at_utc: updatedAtUtc
  };
};

const getStorage = (): Storage | null => {
  try {
    if (!("localStorage" in globalThis)) {
      return null;
    }

    return globalThis.localStorage;
  } catch (error) {
    logger.warn({ error }, "lib/product/resume_state.ts fallback handling failed");
    return null;
  }
};

const getStorageKey = (testId: string, slug: string): string => {
  return `${RESUME_STATE_PREFIX}:${testId}:${slug}`;
};

export const loadResumeState = (testId: string, slug: string): ResumeState | null => {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const raw = storage.getItem(getStorageKey(testId, slug));
  if (!raw) {
    return null;
  }

  try {
    const parsed = parseResumeState(JSON.parse(raw));
    if (!parsed) {
      return null;
    }

    if (parsed.version !== RESUME_STATE_VERSION) {
      return null;
    }

    if (parsed.test_id !== testId || parsed.slug !== slug) {
      return null;
    }

    return parsed;
  } catch (error) {
    logger.warn({ error }, "lib/product/resume_state.ts fallback handling failed");
    return null;
  }
};

export const saveResumeState = (state: ResumeState): void => {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const parsed = parseResumeState(state);
  if (!parsed) {
    return;
  }

  storage.setItem(getStorageKey(parsed.test_id, parsed.slug), JSON.stringify(parsed));
};

export const clearResumeState = (testId: string, slug: string): void => {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(getStorageKey(testId, slug));
};

import { env } from "@/lib/env";
import { createHmac, timingSafeEqual } from "crypto";
import { normalizeString } from "@/lib/utils/strings";
import { encodeBase64Url, decodeBase64Url } from "@/lib/utils/encoding";
import { logger } from "@/lib/logger";

export type ResultCookiePayload = {
  tenant_id: string;
  session_id: string;
  distinct_id: string;
  test_id: string;
  computed_at_utc: string;
  band_id: string;
  scale_scores: Record<string, number>;
};

export const RESULT_COOKIE = "RESULT_COOKIE";

const DEV_RESULT_COOKIE_SECRET = "dev-result-cookie-secret";

const resolveResultCookieSecret = (): string => {
  const secret = normalizeString(env.RESULT_COOKIE_SECRET);
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("RESULT_COOKIE_SECRET is required.");
  }

  return DEV_RESULT_COOKIE_SECRET;
};



const signPayload = (payloadEncoded: string): string => {
  return createHmac("sha256", resolveResultCookieSecret())
    .update(payloadEncoded)
    .digest("base64url");
};

const isSignatureValid = (provided: string, expected: string): boolean => {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
};

const isValidScaleScores = (value: unknown): value is Record<string, number> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  for (const [key, score] of Object.entries(value)) {
    if (!normalizeString(key)) {
      return false;
    }
    if (typeof score !== "number" || !Number.isFinite(score)) {
      return false;
    }
  }

  return true;
};

const isValidPayload = (payload: unknown): payload is ResultCookiePayload => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const record = payload as Record<string, unknown>;
  const tenantId = normalizeString(record.tenant_id);
  const sessionId = normalizeString(record.session_id);
  const distinctId = normalizeString(record.distinct_id);
  const testId = normalizeString(record.test_id);
  const computedAtUtc = normalizeString(record.computed_at_utc);
  const bandId = normalizeString(record.band_id);
  const scaleScores = record.scale_scores;

  if (!tenantId || !sessionId || !distinctId || !testId || !computedAtUtc || !bandId) {
    return false;
  }

  if (!isValidScaleScores(scaleScores)) {
    return false;
  }

  return true;
};

export const signResultCookie = (payload: ResultCookiePayload): string => {
  const payloadEncoded = encodeBase64Url(JSON.stringify(payload));
  const signature = signPayload(payloadEncoded);
  return `${payloadEncoded}.${signature}`;
};

export const verifyResultCookie = (value: string): ResultCookiePayload | null => {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  const parts = normalized.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [payloadEncoded, signature] = parts;
  if (!payloadEncoded || !signature) {
    return null;
  }

  const expectedSignature = signPayload(payloadEncoded);
  if (!isSignatureValid(signature, expectedSignature)) {
    return null;
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(decodeBase64Url(payloadEncoded));
  } catch (error) {
    logger.error({ error }, "lib/product/result_cookie.ts operation failed");
    return null;
  }

  return isValidPayload(parsed) ? parsed : null;
};

import { env } from "@/lib/env";
import { createHmac, timingSafeEqual } from "crypto";
import { normalizeString, parsePositiveInt } from "@/lib/utils/strings";
import { encodeBase64Url, decodeBase64Url } from "@/lib/utils/encoding";

export type AttemptTokenPayload = {
  tenant_id: string;
  session_id: string;
  distinct_id: string;
  exp: number;
};

export type AttemptTokenContext = {
  tenant_id: string;
  session_id: string;
  distinct_id: string;
};

export const ATTEMPT_TOKEN_COOKIE_NAME = "qf_attempt_token";

const DEFAULT_ATTEMPT_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 2;
const DEV_ATTEMPT_TOKEN_SECRET = "dev-attempt-token-secret";

export const resolveAttemptTokenTtlSeconds = (override?: number): number => {
  if (typeof override === "number" && Number.isFinite(override) && override > 0) {
    return Math.floor(override);
  }

  const envTtl = parsePositiveInt(env.ATTEMPT_TOKEN_TTL_SECONDS);
  return envTtl ?? DEFAULT_ATTEMPT_TOKEN_TTL_SECONDS;
};

const resolveAttemptTokenSecret = (): string => {
  const secret = normalizeString(env.ATTEMPT_TOKEN_SECRET);
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("ATTEMPT_TOKEN_SECRET is required.");
  }

  return DEV_ATTEMPT_TOKEN_SECRET;
};



const signPayload = (payloadEncoded: string): string => {
  return createHmac("sha256", resolveAttemptTokenSecret())
    .update(payloadEncoded)
    .digest("base64url");
};

const isValidPayload = (payload: unknown): payload is AttemptTokenPayload => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const record = payload as Record<string, unknown>;
  const tenantId = normalizeString(record.tenant_id);
  const sessionId = normalizeString(record.session_id);
  const distinctId = normalizeString(record.distinct_id);
  const exp = typeof record.exp === "number" ? record.exp : Number(record.exp);

  if (!tenantId || !sessionId || !distinctId) {
    return false;
  }

  if (!Number.isFinite(exp) || exp <= 0) {
    return false;
  }

  return true;
};

const parsePayload = (payloadEncoded: string): AttemptTokenPayload => {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(decodeBase64Url(payloadEncoded));
  } catch {
    throw new Error("Attempt token is invalid.");
  }

  if (!isValidPayload(parsed)) {
    throw new Error("Attempt token is invalid.");
  }

  return parsed;
};

const isSignatureValid = (provided: string, expected: string): boolean => {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
};

export const issueAttemptToken = (
  payload: AttemptTokenContext,
  ttlSeconds?: number
): string => {
  const ttl = resolveAttemptTokenTtlSeconds(ttlSeconds);
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const payloadEncoded = encodeBase64Url(
    JSON.stringify({
      tenant_id: payload.tenant_id,
      session_id: payload.session_id,
      distinct_id: payload.distinct_id,
      exp
    })
  );
  const signature = signPayload(payloadEncoded);

  return `${payloadEncoded}.${signature}`;
};

export const verifyAttemptToken = (token: string): AttemptTokenPayload => {
  const normalized = normalizeString(token);
  if (!normalized) {
    throw new Error("Attempt token is invalid.");
  }

  const parts = normalized.split(".");
  if (parts.length !== 2) {
    throw new Error("Attempt token is invalid.");
  }

  const [payloadEncoded, signature] = parts;
  if (!payloadEncoded || !signature) {
    throw new Error("Attempt token is invalid.");
  }

  const expectedSignature = signPayload(payloadEncoded);
  if (!isSignatureValid(signature, expectedSignature)) {
    throw new Error("Attempt token is invalid.");
  }

  const payload = parsePayload(payloadEncoded);
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    throw new Error("Attempt token has expired.");
  }

  return payload;
};

export const assertAttemptTokenMatchesContext = (
  payload: AttemptTokenPayload,
  context: AttemptTokenContext
): void => {
  if (
    payload.tenant_id !== context.tenant_id ||
    payload.session_id !== context.session_id ||
    payload.distinct_id !== context.distinct_id
  ) {
    throw new Error("Attempt token does not match request context.");
  }
};

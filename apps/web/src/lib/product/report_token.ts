import { env } from "@/lib/env";
import { createHmac, timingSafeEqual } from "crypto";
import { normalizeString } from "@/lib/utils/strings";
import { encodeBase64Url, decodeBase64Url } from "@/lib/utils/encoding";
import { logger } from "@/lib/logger";

export type ReportTokenPayload = {
  purchase_id: string;
  tenant_id: string;
  test_id: string;
  session_id: string;
  distinct_id: string;
  product_type: string;
  pricing_variant: string;
  issued_at_utc: string;
  expires_at_utc: string;
};

export const REPORT_TOKEN = "REPORT_TOKEN";

const DEV_REPORT_TOKEN_SECRET = "dev-report-token-secret";

const resolveReportTokenSecret = (): string => {
  const secret = normalizeString(env.REPORT_TOKEN_SECRET);
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("REPORT_TOKEN_SECRET is required.");
  }

  return DEV_REPORT_TOKEN_SECRET;
};



const signPayload = (payloadEncoded: string): string => {
  return createHmac("sha256", resolveReportTokenSecret())
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

const parseUtcTimestamp = (value: string): number | null => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
};

const isValidPayload = (payload: unknown): payload is ReportTokenPayload => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const record = payload as Record<string, unknown>;
  const purchaseId = normalizeString(record.purchase_id);
  const tenantId = normalizeString(record.tenant_id);
  const testId = normalizeString(record.test_id);
  const sessionId = normalizeString(record.session_id);
  const distinctId = normalizeString(record.distinct_id);
  const productType = normalizeString(record.product_type);
  const pricingVariant = normalizeString(record.pricing_variant);
  const issuedAtUtc = normalizeString(record.issued_at_utc);
  const expiresAtUtc = normalizeString(record.expires_at_utc);

  if (
    !purchaseId ||
    !tenantId ||
    !testId ||
    !sessionId ||
    !distinctId ||
    !productType ||
    !pricingVariant ||
    !issuedAtUtc ||
    !expiresAtUtc
  ) {
    return false;
  }

  const issuedAtMs = parseUtcTimestamp(issuedAtUtc);
  const expiresAtMs = parseUtcTimestamp(expiresAtUtc);
  if (issuedAtMs === null || expiresAtMs === null || expiresAtMs < issuedAtMs) {
    return false;
  }

  return true;
};

export const signReportToken = (payload: ReportTokenPayload): string => {
  const payloadEncoded = encodeBase64Url(JSON.stringify(payload));
  const signature = signPayload(payloadEncoded);
  return `${payloadEncoded}.${signature}`;
};

export const verifyReportToken = (value: string): ReportTokenPayload | null => {
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
    logger.error({ error }, "lib/product/report_token.ts operation failed");
    return null;
  }

  if (!isValidPayload(parsed)) {
    return null;
  }

  const expiresAtMs = parseUtcTimestamp(parsed.expires_at_utc);
  if (expiresAtMs === null || expiresAtMs <= Date.now()) {
    return null;
  }

  return parsed;
};

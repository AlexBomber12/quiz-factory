import { createHmac, timingSafeEqual } from "crypto";

import { normalizeLocaleTag, type LocaleTag } from "./content/types";

export type ReportLinkTokenPayload = {
  tenant_id: string;
  test_id: string;
  report_key: string;
  locale: LocaleTag;
  purchase_id: string;
  session_id: string;
  band_id: string;
  scale_scores: Record<string, number>;
  computed_at_utc: string;
  exp: number;
};

export type ReportLinkTokenInput = {
  tenant_id: string;
  test_id: string;
  report_key: string;
  locale: string;
  expires_at: Date | string | number;
  purchase_id: string;
  session_id: string;
  band_id: string;
  scale_scores: Record<string, number>;
  computed_at_utc: string;
};

const DEV_REPORT_LINK_TOKEN_SECRET = "dev-report-token-secret";

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeLocale = (value: unknown): LocaleTag | null => {
  if (typeof value !== "string") {
    return null;
  }

  return normalizeLocaleTag(value) ?? null;
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

const parseEpochSeconds = (value: Date | string | number): number | null => {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }
    const seconds = value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
    return seconds > 0 ? seconds : null;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
  }

  return null;
};

const resolveReportLinkTokenSecret = (): string => {
  const secret = normalizeString(process.env.REPORT_TOKEN_SECRET);
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("REPORT_TOKEN_SECRET is required.");
  }

  return DEV_REPORT_LINK_TOKEN_SECRET;
};

const encodeBase64Url = (value: string): string => {
  return Buffer.from(value, "utf8").toString("base64url");
};

const decodeBase64Url = (value: string): string => {
  return Buffer.from(value, "base64url").toString("utf8");
};

const signPayload = (payloadEncoded: string): string => {
  return createHmac("sha256", resolveReportLinkTokenSecret())
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

const isValidPayload = (payload: unknown): payload is ReportLinkTokenPayload => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const record = payload as Record<string, unknown>;
  const tenantId = normalizeString(record.tenant_id);
  const testId = normalizeString(record.test_id);
  const reportKey = normalizeString(record.report_key);
  const locale = normalizeLocale(record.locale);
  const purchaseId = normalizeString(record.purchase_id);
  const sessionId = normalizeString(record.session_id);
  const bandId = normalizeString(record.band_id);
  const computedAtUtc = normalizeString(record.computed_at_utc);
  const exp = typeof record.exp === "number" ? record.exp : Number(record.exp);

  if (
    !tenantId ||
    !testId ||
    !reportKey ||
    !locale ||
    !purchaseId ||
    !sessionId ||
    !bandId ||
    !computedAtUtc
  ) {
    return false;
  }

  if (!Number.isFinite(exp) || exp <= 0) {
    return false;
  }

  if (!isValidScaleScores(record.scale_scores)) {
    return false;
  }

  return true;
};

export const issueReportLinkToken = (input: ReportLinkTokenInput): string => {
  const tenantId = normalizeString(input.tenant_id);
  const testId = normalizeString(input.test_id);
  const reportKey = normalizeString(input.report_key);
  const locale = normalizeLocale(input.locale);
  const purchaseId = normalizeString(input.purchase_id);
  const sessionId = normalizeString(input.session_id);
  const bandId = normalizeString(input.band_id);
  const computedAtUtc = normalizeString(input.computed_at_utc);
  const exp = parseEpochSeconds(input.expires_at);

  if (
    !tenantId ||
    !testId ||
    !reportKey ||
    !locale ||
    !purchaseId ||
    !sessionId ||
    !bandId ||
    !computedAtUtc ||
    !exp
  ) {
    throw new Error("Report link token payload is invalid.");
  }

  if (!isValidScaleScores(input.scale_scores)) {
    throw new Error("Report link token payload is invalid.");
  }

  const payload: ReportLinkTokenPayload = {
    tenant_id: tenantId,
    test_id: testId,
    report_key: reportKey,
    locale,
    purchase_id: purchaseId,
    session_id: sessionId,
    band_id: bandId,
    scale_scores: input.scale_scores,
    computed_at_utc: computedAtUtc,
    exp
  };

  const payloadEncoded = encodeBase64Url(JSON.stringify(payload));
  const signature = signPayload(payloadEncoded);
  return `${payloadEncoded}.${signature}`;
};

export const verifyReportLinkToken = (token: string): ReportLinkTokenPayload => {
  const normalized = normalizeString(token);
  if (!normalized) {
    throw new Error("Report link token is invalid.");
  }

  const parts = normalized.split(".");
  if (parts.length !== 2) {
    throw new Error("Report link token is invalid.");
  }

  const [payloadEncoded, signature] = parts;
  if (!payloadEncoded || !signature) {
    throw new Error("Report link token is invalid.");
  }

  const expectedSignature = signPayload(payloadEncoded);
  if (!isSignatureValid(signature, expectedSignature)) {
    throw new Error("Report link token is invalid.");
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(decodeBase64Url(payloadEncoded));
  } catch {
    throw new Error("Report link token is invalid.");
  }

  if (!isValidPayload(parsed)) {
    throw new Error("Report link token is invalid.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (parsed.exp <= now) {
    throw new Error("Report link token has expired.");
  }

  return parsed;
};

import { handleAnalyticsEvent } from "@/lib/analytics/server";
import {
  DEFAULT_EVENT_BODY_BYTES,
  DEFAULT_EVENT_RATE_LIMIT,
  assertAllowedHostAsync,
  assertAllowedMethod,
  assertAllowedOriginAsync,
  assertMaxBodyBytes,
  rateLimit
} from "@/lib/security/request_guards";

const normalizeBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }

  return null;
};

const normalizeNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

export const POST = async (request: Request): Promise<Response> => {
  const methodResponse = assertAllowedMethod(request, ["POST"]);
  if (methodResponse) {
    return methodResponse;
  }

  const hostResponse = await assertAllowedHostAsync(request);
  if (hostResponse) {
    return hostResponse;
  }

  const originResponse = await assertAllowedOriginAsync(request);
  if (originResponse) {
    return originResponse;
  }

  const rateLimitResponse = rateLimit(request, DEFAULT_EVENT_RATE_LIMIT);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const bodyResponse = await assertMaxBodyBytes(request, DEFAULT_EVENT_BODY_BYTES);
  if (bodyResponse) {
    return bodyResponse;
  }

  return handleAnalyticsEvent(request, {
    event: "report_view",
    requirePurchaseId: true,
    extendProperties: ({ body }) => {
      const consumedCredit = normalizeBoolean(body.consumed_credit);
      const creditsBalanceAfter = normalizeNumber(body.credits_balance_after);

      const extra: Record<string, unknown> = {};
      if (consumedCredit !== null) {
        extra.consumed_credit = consumedCredit;
      }
      if (creditsBalanceAfter !== null) {
        extra.credits_balance_after = creditsBalanceAfter;
      }

      return extra;
    }
  });
};

import { handleAnalyticsEvent } from "@/lib/analytics/server";
import { withApiGuards } from "@/lib/security/with_api_guards";

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

export const POST = withApiGuards(async (request: Request): Promise<Response> => {
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
}, { methods: ["POST"] });

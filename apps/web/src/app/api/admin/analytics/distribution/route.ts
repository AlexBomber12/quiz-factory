import { NextResponse } from "next/server";

import {
  ADMIN_ANALYTICS_DISTRIBUTION_DEFAULT_LIMIT,
  ADMIN_ANALYTICS_DISTRIBUTION_MAX_LIMIT,
  type AdminAnalyticsDistributionOptions
} from "@/lib/admin_analytics/types";
import { executeProviderCall, parseFiltersFromRequest } from "../shared";

const INTEGER_PATTERN = /^\d+$/;

type DistributionQueryField = "top_tenants" | "top_tests";

type DistributionOptionsParseIssue = {
  field: DistributionQueryField;
  message: string;
};

type DistributionOptionsParseResult =
  | { ok: true; value: AdminAnalyticsDistributionOptions }
  | { ok: false; errors: DistributionOptionsParseIssue[] };

const parseDistributionLimit = (
  field: DistributionQueryField,
  rawValue: string | null,
  errors: DistributionOptionsParseIssue[]
): number => {
  if (rawValue === null || rawValue.trim().length === 0) {
    return ADMIN_ANALYTICS_DISTRIBUTION_DEFAULT_LIMIT;
  }

  const normalized = rawValue.trim();
  if (!INTEGER_PATTERN.test(normalized)) {
    errors.push({
      field,
      message: `must be an integer between 1 and ${ADMIN_ANALYTICS_DISTRIBUTION_MAX_LIMIT}`
    });
    return ADMIN_ANALYTICS_DISTRIBUTION_DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > ADMIN_ANALYTICS_DISTRIBUTION_MAX_LIMIT
  ) {
    errors.push({
      field,
      message: `must be an integer between 1 and ${ADMIN_ANALYTICS_DISTRIBUTION_MAX_LIMIT}`
    });
    return ADMIN_ANALYTICS_DISTRIBUTION_DEFAULT_LIMIT;
  }

  return parsed;
};

export const parseDistributionOptions = (
  searchParams: URLSearchParams
): DistributionOptionsParseResult => {
  const errors: DistributionOptionsParseIssue[] = [];
  const topTenants = parseDistributionLimit("top_tenants", searchParams.get("top_tenants"), errors);
  const topTests = parseDistributionLimit("top_tests", searchParams.get("top_tests"), errors);

  if (errors.length > 0) {
    return {
      ok: false,
      errors
    };
  }

  return {
    ok: true,
    value: {
      top_tenants: topTenants,
      top_tests: topTests
    }
  };
};

export const GET = async (request: Request): Promise<Response> => {
  const parsed = parseFiltersFromRequest(request);
  if (!parsed.ok) {
    return parsed.response;
  }

  const parsedOptions = parseDistributionOptions(new URL(request.url).searchParams);
  if (!parsedOptions.ok) {
    return NextResponse.json(
      {
        error: "invalid_filters",
        details: parsedOptions.errors
      },
      { status: 400 }
    );
  }

  return executeProviderCall((provider) =>
    provider.getDistribution(parsed.filters, parsedOptions.value)
  );
};

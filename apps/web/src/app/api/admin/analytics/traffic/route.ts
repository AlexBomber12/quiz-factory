import { NextResponse } from "next/server";

import {
  ADMIN_ANALYTICS_TRAFFIC_DEFAULT_LIMIT,
  ADMIN_ANALYTICS_TRAFFIC_MAX_LIMIT,
  type AdminAnalyticsTrafficOptions
} from "@/lib/admin_analytics/types";
import { executeProviderCall, parseFiltersFromRequest } from "../shared";

const INTEGER_PATTERN = /^\d+$/;

type TrafficOptionsParseIssue = {
  field: "top_n";
  message: string;
};

type TrafficOptionsParseResult =
  | { ok: true; value: AdminAnalyticsTrafficOptions }
  | { ok: false; errors: TrafficOptionsParseIssue[] };

const parseTrafficLimit = (
  rawValue: string | null,
  errors: TrafficOptionsParseIssue[]
): number => {
  if (rawValue === null || rawValue.trim().length === 0) {
    return ADMIN_ANALYTICS_TRAFFIC_DEFAULT_LIMIT;
  }

  const normalized = rawValue.trim();
  if (!INTEGER_PATTERN.test(normalized)) {
    errors.push({
      field: "top_n",
      message: `must be an integer between 1 and ${ADMIN_ANALYTICS_TRAFFIC_MAX_LIMIT}`
    });
    return ADMIN_ANALYTICS_TRAFFIC_DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > ADMIN_ANALYTICS_TRAFFIC_MAX_LIMIT
  ) {
    errors.push({
      field: "top_n",
      message: `must be an integer between 1 and ${ADMIN_ANALYTICS_TRAFFIC_MAX_LIMIT}`
    });
    return ADMIN_ANALYTICS_TRAFFIC_DEFAULT_LIMIT;
  }

  return parsed;
};

export const parseTrafficOptions = (
  searchParams: URLSearchParams
): TrafficOptionsParseResult => {
  const errors: TrafficOptionsParseIssue[] = [];
  const topN = parseTrafficLimit(searchParams.get("top_n"), errors);
  if (errors.length > 0) {
    return {
      ok: false,
      errors
    };
  }

  return {
    ok: true,
    value: {
      top_n: topN
    }
  };
};

export const GET = async (request: Request): Promise<Response> => {
  const parsed = parseFiltersFromRequest(request);
  if (!parsed.ok) {
    return parsed.response;
  }

  const parsedOptions = parseTrafficOptions(new URL(request.url).searchParams);
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
    provider.getTraffic(parsed.filters, parsedOptions.value)
  );
};

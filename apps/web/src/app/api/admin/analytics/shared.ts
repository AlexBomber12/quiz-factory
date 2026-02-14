import { NextResponse } from "next/server";

import {
  getAdminAnalyticsProvider,
  isAdminAnalyticsNotImplementedError,
  type AdminAnalyticsProvider
} from "../../../../lib/admin_analytics/provider";
import {
  parseAdminAnalyticsFilters,
  type AdminAnalyticsFilters,
  type AdminAnalyticsValidationIssue
} from "../../../../lib/admin_analytics/types";

const MAX_ROUTE_IDENTIFIER_LENGTH = 120;
const TEST_ID_PATTERN = /^test-[a-z0-9-]+$/;

const hasControlCharacters = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) {
      return true;
    }
  }

  return false;
};

type FieldName = AdminAnalyticsValidationIssue["field"] | "tenant_id" | "test_id";

type ParsedFiltersResult =
  | { ok: true; filters: AdminAnalyticsFilters }
  | { ok: false; response: Response };

type ParsedRouteIdentifierResult =
  | { ok: true; value: string }
  | { ok: false; response: Response };

const buildValidationResponse = (
  error: "invalid_filters" | "invalid_path_param",
  details: Array<{ field: FieldName; message: string }>
): Response => {
  return NextResponse.json(
    {
      error,
      details
    },
    { status: 400 }
  );
};

const buildInternalErrorResponse = (): Response => {
  return NextResponse.json(
    {
      error: "internal_error"
    },
    { status: 500 }
  );
};

export const parseFiltersFromRequest = (request: Request): ParsedFiltersResult => {
  const searchParams = new URL(request.url).searchParams;
  const parsed = parseAdminAnalyticsFilters(searchParams);
  if (!parsed.ok) {
    return {
      ok: false,
      response: buildValidationResponse("invalid_filters", parsed.errors)
    };
  }

  return {
    ok: true,
    filters: parsed.value
  };
};

export const parseRouteIdentifier = (
  value: string | undefined,
  field: "tenant_id" | "test_id"
): ParsedRouteIdentifierResult => {
  const normalized = typeof value === "string" ? value.trim() : "";

  if (normalized.length === 0) {
    return {
      ok: false,
      response: buildValidationResponse("invalid_path_param", [
        {
          field,
          message: "must be provided"
        }
      ])
    };
  }

  if (normalized.length > MAX_ROUTE_IDENTIFIER_LENGTH) {
    return {
      ok: false,
      response: buildValidationResponse("invalid_path_param", [
        {
          field,
          message: `must be ${MAX_ROUTE_IDENTIFIER_LENGTH} characters or fewer`
        }
      ])
    };
  }

  if (hasControlCharacters(normalized)) {
    return {
      ok: false,
      response: buildValidationResponse("invalid_path_param", [
        {
          field,
          message: "contains control characters"
        }
      ])
    };
  }

  if (field === "test_id" && !TEST_ID_PATTERN.test(normalized)) {
    return {
      ok: false,
      response: buildValidationResponse("invalid_path_param", [
        {
          field,
          message: "must match test-[a-z0-9-]+"
        }
      ])
    };
  }

  return {
    ok: true,
    value: normalized
  };
};

export const validateDetailFilterConsistency = (
  field: "tenant_id" | "test_id",
  routeValue: string,
  filters: AdminAnalyticsFilters
): Response | null => {
  const filterValue = field === "tenant_id" ? filters.tenant_id : filters.test_id;
  if (filterValue && filterValue !== routeValue) {
    return buildValidationResponse("invalid_filters", [
      {
        field,
        message: `${field} query filter must match route parameter`
      }
    ]);
  }

  return null;
};

export const executeProviderCall = async <T>(
  call: (provider: AdminAnalyticsProvider) => Promise<T>
): Promise<Response> => {
  try {
    const provider = getAdminAnalyticsProvider();
    const payload = await call(provider);
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    if (isAdminAnalyticsNotImplementedError(error)) {
      return NextResponse.json(
        {
          error: error.code,
          detail: error.message
        },
        { status: error.status }
      );
    }

    return buildInternalErrorResponse();
  }
};

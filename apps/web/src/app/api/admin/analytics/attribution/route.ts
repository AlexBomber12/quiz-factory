import { NextResponse } from "next/server";

import type { AdminAnalyticsAttributionOptions } from "@/lib/admin_analytics/types";
import { executeProviderCall, parseFiltersFromRequest } from "../shared";

const MAX_OPTIONAL_FILTER_LENGTH = 120;
const SUPPORTED_CONTENT_TYPES = new Set(["test"]);

type AttributionQueryField = "content_type" | "content_key";

type AttributionOptionsParseIssue = {
  field: AttributionQueryField;
  message: string;
};

type AttributionOptionsParseResult =
  | { ok: true; value: AdminAnalyticsAttributionOptions }
  | { ok: false; errors: AttributionOptionsParseIssue[] };

const hasControlCharacters = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) {
      return true;
    }
  }

  return false;
};

const parseOptionalValue = (
  field: AttributionQueryField,
  rawValue: string | null,
  errors: AttributionOptionsParseIssue[]
): string | null => {
  if (rawValue === null) {
    return null;
  }

  const normalized = rawValue.trim();
  if (normalized.length === 0) {
    return null;
  }

  if (normalized.length > MAX_OPTIONAL_FILTER_LENGTH) {
    errors.push({
      field,
      message: `must be ${MAX_OPTIONAL_FILTER_LENGTH} characters or fewer`
    });
    return null;
  }

  if (hasControlCharacters(normalized)) {
    errors.push({
      field,
      message: "contains control characters"
    });
    return null;
  }

  return normalized;
};

export const parseAttributionOptions = (
  searchParams: URLSearchParams
): AttributionOptionsParseResult => {
  const errors: AttributionOptionsParseIssue[] = [];
  const contentType = parseOptionalValue("content_type", searchParams.get("content_type"), errors);
  const contentKey = parseOptionalValue("content_key", searchParams.get("content_key"), errors);
  const normalizedContentType = contentType?.toLowerCase() ?? null;

  if (normalizedContentType && !SUPPORTED_CONTENT_TYPES.has(normalizedContentType)) {
    errors.push({
      field: "content_type",
      message: "must be test when provided"
    });
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors
    };
  }

  return {
    ok: true,
    value: {
      content_type: normalizedContentType,
      content_key: contentKey
    }
  };
};

export const GET = async (request: Request): Promise<Response> => {
  const parsed = parseFiltersFromRequest(request);
  if (!parsed.ok) {
    return parsed.response;
  }

  const parsedOptions = parseAttributionOptions(new URL(request.url).searchParams);
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
    provider.getAttribution(parsed.filters, parsedOptions.value)
  );
};

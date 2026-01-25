import type { AnalyticsEventName } from "./events";
import { ANALYTICS_EVENT_NAMES } from "./events";
import eventsContract from "../../../../../analytics/events.json";

type EventContractEntry = {
  required_properties: string[];
  optional_properties?: string[];
};

type AnalyticsEventsContract = Record<AnalyticsEventName, EventContractEntry> & {
  forbidden_properties: string[];
};

export type AnalyticsValidationError = {
  code: "invalid_event" | "forbidden_properties" | "missing_required" | "invalid_type";
  message: string;
  details?: {
    forbidden?: string[];
    missing?: string[];
    invalid?: string[];
  };
};

export type AnalyticsValidationResult =
  | { ok: true; sanitized: Record<string, unknown> }
  | { ok: false; error: AnalyticsValidationError };

const contract = eventsContract as AnalyticsEventsContract;

const EVENT_NAME_SET = new Set(ANALYTICS_EVENT_NAMES);
const BOOLEAN_FIELDS = new Set(["is_upsell", "is_internal"]);
const NUMBER_FIELDS = new Set(["amount_eur", "credits_granted", "unit_price_eur"]);
const NULLABLE_REQUIRED_FIELDS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "referrer",
  "country",
  "language",
  "device_type"
]);

const normalizeKey = (value: string): string => value.trim().toLowerCase();

const forbiddenPatterns = contract.forbidden_properties.map(normalizeKey);
const forbiddenExact = new Set(
  forbiddenPatterns.filter((pattern) => pattern && !pattern.includes("*"))
);
const forbiddenPrefixes = forbiddenPatterns
  .filter((pattern) => pattern.endsWith("*"))
  .map((pattern) => pattern.slice(0, -1));

const isForbiddenKey = (key: string): boolean => {
  const normalized = normalizeKey(key);
  if (forbiddenExact.has(normalized)) {
    return true;
  }

  return forbiddenPrefixes.some((prefix) => normalized.startsWith(prefix));
};

const coerceValue = (key: string, value: unknown): unknown => {
  if (BOOLEAN_FIELDS.has(key)) {
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
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return value;
};

export const coerceAnalyticsPayload = (
  payload: Record<string, unknown>
): Record<string, unknown> => {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    sanitized[key] = coerceValue(key, value);
  }
  return sanitized;
};

export const validateAnalyticsEventPayload = (
  eventName: string,
  payload: Record<string, unknown>
): AnalyticsValidationResult => {
  if (!EVENT_NAME_SET.has(eventName as AnalyticsEventName)) {
    return {
      ok: false,
      error: {
        code: "invalid_event",
        message: "Event name is not allowed."
      }
    };
  }

  const sanitized = coerceAnalyticsPayload(payload);
  const forbidden = Object.keys(sanitized).filter((key) => isForbiddenKey(key));
  if (forbidden.length > 0) {
    return {
      ok: false,
      error: {
        code: "forbidden_properties",
        message: "Forbidden properties are present.",
        details: { forbidden }
      }
    };
  }

  const required = contract[eventName as AnalyticsEventName]?.required_properties;
  if (!required) {
    return {
      ok: false,
      error: {
        code: "invalid_event",
        message: "Event name is not recognized."
      }
    };
  }

  const missing: string[] = [];
  const invalid: string[] = [];

  for (const key of required) {
    const value = sanitized[key];

    if (value === undefined) {
      missing.push(key);
      continue;
    }

    if (BOOLEAN_FIELDS.has(key)) {
      if (value === null) {
        missing.push(key);
      } else if (typeof value !== "boolean") {
        invalid.push(key);
      }
      continue;
    }

    if (NUMBER_FIELDS.has(key)) {
      if (value === null) {
        missing.push(key);
      } else if (typeof value !== "number" || !Number.isFinite(value)) {
        invalid.push(key);
      }
      continue;
    }

    if (value === null) {
      if (!NULLABLE_REQUIRED_FIELDS.has(key)) {
        missing.push(key);
      }
      continue;
    }

    if (typeof value !== "string") {
      invalid.push(key);
    }
  }

  if (missing.length > 0) {
    return {
      ok: false,
      error: {
        code: "missing_required",
        message: "Missing required properties.",
        details: { missing }
      }
    };
  }

  if (invalid.length > 0) {
    return {
      ok: false,
      error: {
        code: "invalid_type",
        message: "Invalid property types.",
        details: { invalid }
      }
    };
  }

  return { ok: true, sanitized };
};

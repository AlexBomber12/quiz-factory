/**
 * Shared string utility functions.
 *
 * Canonical location — import from "@/lib/utils/strings" or "@/lib/utils".
 * Do NOT copy these into other files.
 */

/**
 * Normalize an unknown value to a trimmed non-empty string or null.
 * Accepts `unknown` so it works safely with JSON bodies, env vars, and query params.
 */
export const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * Narrow-typed variant for call sites that already have a string-ish value.
 * Behaviour is identical to `normalizeString` but the signature avoids
 * requiring callers to widen their type to `unknown`.
 */
export const normalizeStringStrict = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * Parse a string as a positive integer (> 0). Returns `undefined` on failure.
 */
export const parsePositiveInt = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
};

/**
 * Parse a boolean-ish string (1/0, true/false, yes/no, on/off).
 * Returns `undefined` for empty or unrecognised input.
 */
export const parseBoolean = (value: string | undefined): boolean | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return undefined;
};

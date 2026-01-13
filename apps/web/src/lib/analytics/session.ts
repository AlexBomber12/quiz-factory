import { randomUUID } from "crypto";

import {
  CLICK_COOKIE_NAME,
  CLICK_ID_FIELDS,
  DISTINCT_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  UTM_COOKIE_NAME,
  UTM_FIELDS,
  type ClickIdField,
  type UtmField
} from "./constants";

export type UtmParams = Record<UtmField, string | null>;
export type ClickIdParams = Record<ClickIdField, string | null>;

const EMPTY_UTM: UtmParams = {
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_content: null,
  utm_term: null
};

const EMPTY_CLICK_IDS: ClickIdParams = {
  fbclid: null,
  gclid: null,
  ttclid: null
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const createSessionId = (): string => {
  return randomUUID();
};

export const createDistinctId = (): string => {
  return randomUUID();
};

export const parseCookies = (cookieHeader: string | null): Record<string, string> => {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(";").reduce<Record<string, string>>((acc, part) => {
    const [name, ...valueParts] = part.trim().split("=");
    if (!name) {
      return acc;
    }

    acc[name] = valueParts.join("=");
    return acc;
  }, {});
};

export const resolveSessionId = (options: {
  bodySessionId?: unknown;
  cookieSessionId?: unknown;
}): string | null => {
  return (
    normalizeString(options.bodySessionId) ?? normalizeString(options.cookieSessionId)
  );
};

export const normalizeUtm = (
  input?: Partial<Record<UtmField, string | null | undefined>>
): UtmParams => {
  const normalized: UtmParams = { ...EMPTY_UTM };
  for (const field of UTM_FIELDS) {
    normalized[field] = normalizeString(input?.[field]);
  }

  return normalized;
};

export const normalizeClickIds = (
  input?: Partial<Record<ClickIdField, string | null | undefined>>
): ClickIdParams => {
  const normalized: ClickIdParams = { ...EMPTY_CLICK_IDS };
  for (const field of CLICK_ID_FIELDS) {
    normalized[field] = normalizeString(input?.[field]);
  }

  return normalized;
};

const getUtmFromQuery = (url: URL): UtmParams => {
  const incoming: Partial<Record<UtmField, string | null>> = {};
  for (const field of UTM_FIELDS) {
    incoming[field] = normalizeString(url.searchParams.get(field));
  }
  return normalizeUtm(incoming);
};

const getClickIdsFromQuery = (url: URL): ClickIdParams => {
  const incoming: Partial<Record<ClickIdField, string | null>> = {};
  for (const field of CLICK_ID_FIELDS) {
    incoming[field] = normalizeString(url.searchParams.get(field));
  }
  return normalizeClickIds(incoming);
};

export const hasUtmValues = (utm: UtmParams): boolean => {
  return UTM_FIELDS.some((field) => Boolean(utm[field]));
};

export const hasClickIdValues = (clickIds: ClickIdParams): boolean => {
  return CLICK_ID_FIELDS.some((field) => Boolean(clickIds[field]));
};

const safeDecodeCookieValue = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const parseCookieObject = (
  value: string | undefined
): Record<string, string | null | undefined> | null => {
  if (!value) {
    return null;
  }

  const candidates = [value];
  const decodedOnce = safeDecodeCookieValue(value);
  if (decodedOnce !== value) {
    candidates.push(decodedOnce);
  }
  const decodedTwice = safeDecodeCookieValue(decodedOnce);
  if (decodedTwice !== decodedOnce && decodedTwice !== value) {
    candidates.push(decodedTwice);
  }

  for (const candidate of candidates) {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      parsed = null;
    }

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string | null | undefined>;
    }

    if (typeof parsed === "string") {
      try {
        const nested = JSON.parse(parsed) as unknown;
        if (nested && typeof nested === "object" && !Array.isArray(nested)) {
          return nested as Record<string, string | null | undefined>;
        }
      } catch {
        continue;
      }
    }
  }

  return null;
};

export const parseUtmCookie = (value: string | undefined): UtmParams | null => {
  const parsed = parseCookieObject(value);
  return parsed ? normalizeUtm(parsed) : null;
};

export const parseClickIdsCookie = (value: string | undefined): ClickIdParams | null => {
  const parsed = parseCookieObject(value);
  return parsed ? normalizeClickIds(parsed) : null;
};

export const serializeUtmCookie = (utm: UtmParams): string => {
  return encodeURIComponent(JSON.stringify(utm));
};

export const serializeClickIdsCookie = (clickIds: ClickIdParams): string => {
  return encodeURIComponent(JSON.stringify(clickIds));
};

export const getSessionIdFromRequest = (options: {
  body?: Record<string, unknown>;
  cookies?: Record<string, string>;
}): string | null => {
  const body = options.body ?? {};
  const cookies = options.cookies ?? {};
  return resolveSessionId({
    bodySessionId: body.session_id,
    cookieSessionId: cookies[SESSION_COOKIE_NAME]
  });
};

export const getDistinctIdFromRequest = (options: {
  body?: Record<string, unknown>;
  cookies?: Record<string, string>;
}): string | null => {
  const body = options.body ?? {};
  const cookies = options.cookies ?? {};
  return normalizeString(body.distinct_id) ?? normalizeString(cookies[DISTINCT_COOKIE_NAME]);
};

export const getUtmFromCookies = (cookies: Record<string, string>): UtmParams | null => {
  return parseUtmCookie(cookies[UTM_COOKIE_NAME]);
};

export const getClickIdsFromCookies = (
  cookies: Record<string, string>
): ClickIdParams | null => {
  return parseClickIdsCookie(cookies[CLICK_COOKIE_NAME]);
};

export type TrackingContext = {
  utm: UtmParams;
  clickIds: ClickIdParams;
  shouldSetUtmCookie: boolean;
  shouldSetClickIdsCookie: boolean;
};

export const getTrackingContextFromRequest = (options: {
  cookies: Record<string, string>;
  url: URL;
}): TrackingContext => {
  const storedUtm = getUtmFromCookies(options.cookies);
  const storedClickIds = getClickIdsFromCookies(options.cookies);

  const storedUtmHasValues = storedUtm ? hasUtmValues(storedUtm) : false;
  const storedClickIdsHaveValues = storedClickIds
    ? hasClickIdValues(storedClickIds)
    : false;

  const queryUtm = getUtmFromQuery(options.url);
  const queryClickIds = getClickIdsFromQuery(options.url);

  const resolvedUtm =
    storedUtmHasValues && storedUtm ? storedUtm : queryUtm;
  const resolvedClickIds =
    storedClickIdsHaveValues && storedClickIds ? storedClickIds : queryClickIds;

  return {
    utm: resolvedUtm,
    clickIds: resolvedClickIds,
    shouldSetUtmCookie: !storedUtmHasValues && hasUtmValues(queryUtm),
    shouldSetClickIdsCookie:
      !storedClickIdsHaveValues && hasClickIdValues(queryClickIds)
  };
};

export {
  CLICK_COOKIE_NAME,
  DISTINCT_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  UTM_COOKIE_NAME,
  normalizeString
};

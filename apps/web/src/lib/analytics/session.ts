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

const sessionUtmStore = new Map<string, UtmParams>();
const sessionClickIdStore = new Map<string, ClickIdParams>();

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

export const mergeUtm = (
  existing: UtmParams | null,
  incoming?: Partial<Record<UtmField, string | null | undefined>>
): UtmParams => {
  const normalizedIncoming = normalizeUtm(incoming);
  if (!existing) {
    return normalizedIncoming;
  }

  const merged: UtmParams = { ...existing };
  for (const field of UTM_FIELDS) {
    if (!merged[field] && normalizedIncoming[field]) {
      merged[field] = normalizedIncoming[field];
    }
  }

  return merged;
};

export const mergeClickIds = (
  existing: ClickIdParams | null,
  incoming?: Partial<Record<ClickIdField, string | null | undefined>>
): ClickIdParams => {
  const normalizedIncoming = normalizeClickIds(incoming);
  if (!existing) {
    return normalizedIncoming;
  }

  const merged: ClickIdParams = { ...existing };
  for (const field of CLICK_ID_FIELDS) {
    if (!merged[field] && normalizedIncoming[field]) {
      merged[field] = normalizedIncoming[field];
    }
  }

  return merged;
};

export const getUtmFromRequest = (options: {
  body?: Record<string, unknown>;
  url?: URL;
}): Partial<Record<UtmField, string | null>> => {
  const body = options.body ?? {};
  const url = options.url;

  const incoming: Partial<Record<UtmField, string | null>> = {};
  for (const field of UTM_FIELDS) {
    const fromBody = normalizeString(body[field]);
    const fromQuery = normalizeString(url?.searchParams.get(field));
    incoming[field] = fromBody ?? fromQuery;
  }

  return incoming;
};

export const getClickIdsFromRequest = (options: {
  body?: Record<string, unknown>;
  url?: URL;
}): Partial<Record<ClickIdField, string | null>> => {
  const body = options.body ?? {};
  const url = options.url;

  const incoming: Partial<Record<ClickIdField, string | null>> = {};
  for (const field of CLICK_ID_FIELDS) {
    const fromBody = normalizeString(body[field]);
    const fromQuery = normalizeString(url?.searchParams.get(field));
    incoming[field] = fromBody ?? fromQuery;
  }

  return incoming;
};

export const hasUtmValues = (utm: UtmParams): boolean => {
  return UTM_FIELDS.some((field) => Boolean(utm[field]));
};

export const hasClickIdValues = (clickIds: ClickIdParams): boolean => {
  return CLICK_ID_FIELDS.some((field) => Boolean(clickIds[field]));
};

export const parseUtmCookie = (value: string | undefined): UtmParams | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<
      Record<UtmField, string | null>
    >;
    return normalizeUtm(parsed);
  } catch {
    return null;
  }
};

export const parseClickIdsCookie = (value: string | undefined): ClickIdParams | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<
      Record<ClickIdField, string | null>
    >;
    return normalizeClickIds(parsed);
  } catch {
    return null;
  }
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

export const getUtmFromSessionStore = (sessionId: string): UtmParams | null => {
  return sessionUtmStore.get(sessionId) ?? null;
};

export const getClickIdsFromSessionStore = (sessionId: string): ClickIdParams | null => {
  return sessionClickIdStore.get(sessionId) ?? null;
};

export const storeUtmForSession = (sessionId: string, utm: UtmParams): void => {
  sessionUtmStore.set(sessionId, utm);
};

export const storeClickIdsForSession = (
  sessionId: string,
  clickIds: ClickIdParams
): void => {
  sessionClickIdStore.set(sessionId, clickIds);
};

export {
  CLICK_COOKIE_NAME,
  DISTINCT_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  UTM_COOKIE_NAME,
  normalizeString
};

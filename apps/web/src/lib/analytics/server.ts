import { NextResponse } from "next/server";

import {
  buildBaseEventProperties,
  type AnalyticsEventName,
  type AnalyticsEventProperties
} from "./events";
import { capturePosthogEvent } from "./posthog";
import {
  CLICK_COOKIE_NAME,
  DISTINCT_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  UTM_COOKIE_NAME,
  createDistinctId,
  createSessionId,
  getClickIdsFromCookies,
  getClickIdsFromRequest,
  getClickIdsFromSessionStore,
  getDistinctIdFromRequest,
  getSessionIdFromRequest,
  getUtmFromCookies,
  getUtmFromSessionStore,
  getUtmFromRequest,
  hasClickIdValues,
  hasUtmValues,
  mergeClickIds,
  mergeUtm,
  normalizeString,
  parseCookies,
  serializeClickIdsCookie,
  serializeUtmCookie,
  storeClickIdsForSession,
  storeUtmForSession
} from "./session";
import { resolveLocale, resolveTenant } from "../tenants/resolve";

type AnalyticsRequestBody = {
  test_id?: unknown;
  distinct_id?: unknown;
  session_id?: unknown;
  locale?: unknown;
  referrer?: unknown;
  country?: unknown;
  language?: unknown;
  device_type?: unknown;
  page_url?: unknown;
  page_type?: unknown;
  purchase_id?: unknown;
  share_target?: unknown;
  upsell_id?: unknown;
  product_type?: unknown;
  is_upsell?: unknown;
  pricing_variant?: unknown;
  utm_source?: unknown;
  utm_medium?: unknown;
  utm_campaign?: unknown;
  utm_content?: unknown;
  utm_term?: unknown;
  fbclid?: unknown;
  gclid?: unknown;
  ttclid?: unknown;
};

const parseJsonBody = async (request: Request): Promise<AnalyticsRequestBody> => {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {};
  }

  try {
    return (await request.json()) as AnalyticsRequestBody;
  } catch {
    return {};
  }
};

const requireString = (value: unknown): string | null => {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  return normalized;
};

const respondBadRequest = (message: string): NextResponse => {
  return NextResponse.json({ error: message }, { status: 400 });
};

type ResponseExtensionContext = {
  body: AnalyticsRequestBody;
  properties: AnalyticsEventProperties;
  sessionId: string;
  tenantId: string;
  distinctId: string;
  utm: ReturnType<typeof mergeUtm>;
  clickIds: ReturnType<typeof mergeClickIds>;
};

export const handleAnalyticsEvent = async (
  request: Request,
  options: {
    event: AnalyticsEventName;
    createSession?: boolean;
    requireTestId?: boolean;
    requirePurchaseId?: boolean;
    extendResponse?: (context: ResponseExtensionContext) => Record<string, unknown>;
  }
): Promise<Response> => {
  const body = await parseJsonBody(request);
  const cookies = parseCookies(request.headers.get("cookie"));
  const url = new URL(request.url);

  const testId = requireString(body.test_id);
  if (options.requireTestId !== false && !testId) {
    return respondBadRequest("test_id is required");
  }

  const distinctIdFromRequest = getDistinctIdFromRequest({ body, cookies });
  const distinctId = distinctIdFromRequest ?? createDistinctId();

  const sessionId = options.createSession
    ? createSessionId()
    : getSessionIdFromRequest({ body, cookies });
  if (!sessionId) {
    return respondBadRequest("session_id is required");
  }

  const { tenantId, defaultLocale } = resolveTenant(request.headers, url.host);
  const locale = resolveLocale({
    defaultLocale,
    acceptLanguage: request.headers.get("accept-language")
  });

  const incomingUtm = getUtmFromRequest({ body, url });
  const storedUtm = getUtmFromCookies(cookies);
  const sessionUtm = getUtmFromSessionStore(sessionId);
  const mergedUtm = mergeUtm(storedUtm ?? sessionUtm, incomingUtm);

  const incomingClickIds = getClickIdsFromRequest({ body, url });
  const storedClickIds = getClickIdsFromCookies(cookies);
  const sessionClickIds = getClickIdsFromSessionStore(sessionId);
  const mergedClickIds = mergeClickIds(storedClickIds ?? sessionClickIds, incomingClickIds);

  const properties = buildBaseEventProperties({
    tenantId,
    sessionId,
    distinctId,
    testId,
    utm: mergedUtm,
    clickIds: mergedClickIds,
    locale,
    referrer: normalizeString(body.referrer),
    country: normalizeString(body.country),
    language: normalizeString(body.language),
    deviceType: normalizeString(body.device_type)
  });

  const purchaseId = normalizeString(body.purchase_id);
  if (options.requirePurchaseId && !purchaseId) {
    return respondBadRequest("purchase_id is required");
  }
  if (purchaseId) {
    properties.purchase_id = purchaseId;
  }

  if (options.event === "page_view") {
    properties.page_url = normalizeString(body.page_url);
    properties.page_type = normalizeString(body.page_type);
  }

  if (options.event === "share_click") {
    const shareTarget = requireString(body.share_target);
    if (!shareTarget) {
      return respondBadRequest("share_target is required");
    }
    properties.share_target = shareTarget;
  }

  const upsellId = requireString(body.upsell_id);
  if (options.event === "upsell_accept") {
    if (!upsellId) {
      return respondBadRequest("upsell_id is required");
    }
    properties.upsell_id = upsellId;
  } else if (options.event === "upsell_view" && upsellId) {
    properties.upsell_id = upsellId;
  }

  void capturePosthogEvent(options.event, properties).catch(() => null);

  const responsePayload: Record<string, unknown> = {
    session_id: sessionId,
    tenant_id: tenantId
  };

  if (options.extendResponse) {
    Object.assign(
      responsePayload,
      options.extendResponse({
        body,
        properties,
        sessionId,
        tenantId,
        distinctId,
        utm: mergedUtm,
        clickIds: mergedClickIds
      })
    );
  }

  const response = NextResponse.json(responsePayload);

  response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production"
  });

  response.cookies.set(DISTINCT_COOKIE_NAME, distinctId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production"
  });

  if (hasUtmValues(mergedUtm)) {
    storeUtmForSession(sessionId, mergedUtm);
    response.cookies.set(UTM_COOKIE_NAME, serializeUtmCookie(mergedUtm), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production"
    });
  }

  if (hasClickIdValues(mergedClickIds)) {
    storeClickIdsForSession(sessionId, mergedClickIds);
    response.cookies.set(CLICK_COOKIE_NAME, serializeClickIdsCookie(mergedClickIds), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production"
    });
  }

  return response;
};

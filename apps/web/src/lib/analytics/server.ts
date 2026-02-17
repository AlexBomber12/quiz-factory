import { NextResponse } from "next/server";

import {
  buildBaseEventProperties,
  type AnalyticsEventName,
  type AnalyticsEventProperties
} from "./events";
import { shouldEmitEvent } from "./event_dedup";
import {
  DEFAULT_PAGE_VIEW_TYPE,
  resolvePageType,
  sanitizePageUrl,
  shouldEmitPageView
} from "./page_view";
import { capturePosthogEvent } from "./posthog";
import { recordAnalyticsEventToContentDb } from "./event_store";
import {
  coerceAnalyticsPayload,
  validateAnalyticsEventPayload,
  type AnalyticsValidationError
} from "./validate";
import {
  CLICK_COOKIE_NAME,
  DISTINCT_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  UTM_COOKIE_NAME,
  type ClickIdParams,
  createDistinctId,
  createSessionId,
  getDistinctIdFromRequest,
  getSessionIdFromRequest,
  getTrackingContextFromRequest,
  normalizeString,
  parseCookies,
  serializeClickIdsCookie,
  serializeUtmCookie,
  type UtmParams
} from "./session";
import {
  ATTEMPT_TOKEN_COOKIE_NAME,
  assertAttemptTokenMatchesContext,
  issueAttemptToken,
  resolveAttemptTokenTtlSeconds,
  verifyAttemptToken
} from "../security/attempt_token";
import { resolveLocale, resolveTenantAsync } from "../tenants/resolve";

const TRACKING_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

type AnalyticsRequestBody = {
  test_id?: unknown;
  distinct_id?: unknown;
  session_id?: unknown;
  attempt_token?: unknown;
  event_id?: unknown;
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
  offer_key?: unknown;
  product_type?: unknown;
  credits_granted?: unknown;
  credits_balance_after?: unknown;
  consumed_credit?: unknown;
  is_upsell?: unknown;
  pricing_variant?: unknown;
  unit_price_eur?: unknown;
  currency?: unknown;
  utm_source?: unknown;
  utm_medium?: unknown;
  utm_campaign?: unknown;
  utm_content?: unknown;
  utm_term?: unknown;
  fbclid?: unknown;
  gclid?: unknown;
  ttclid?: unknown;
};

const parseJsonBody = async (request: Request): Promise<Record<string, unknown>> => {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {};
  }

  try {
    return (await request.json()) as Record<string, unknown>;
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

const respondBadRequest = (error: AnalyticsValidationError): NextResponse => {
  return NextResponse.json({ error }, { status: 400 });
};

const respondUnauthorized = (message: string): NextResponse => {
  return NextResponse.json({ error: message }, { status: 401 });
};

const missingRequiredError = (field: string): AnalyticsValidationError => ({
  code: "missing_required",
  message: `${field} is required.`,
  details: { missing: [field] }
});

const getAttemptTokenFromRequest = (options: {
  body: AnalyticsRequestBody;
  cookies: Record<string, string>;
}): string | null => {
  return (
    requireString(options.body.attempt_token) ??
    requireString(options.cookies[ATTEMPT_TOKEN_COOKIE_NAME])
  );
};

type ResponseExtensionContext = {
  body: AnalyticsRequestBody;
  properties: AnalyticsEventProperties;
  sessionId: string;
  tenantId: string;
  distinctId: string;
  utm: UtmParams;
  clickIds: ClickIdParams;
};

export const handleAnalyticsEvent = async (
  request: Request,
  options: {
    event: AnalyticsEventName;
    createSession?: boolean;
    requireTestId?: boolean;
    requirePurchaseId?: boolean;
    requireAttemptToken?: boolean;
    issueAttemptToken?: boolean;
    extendProperties?: (context: ResponseExtensionContext) => Partial<AnalyticsEventProperties>;
    extendResponse?: (context: ResponseExtensionContext) => Record<string, unknown>;
  }
): Promise<Response> => {
  const rawBody = await parseJsonBody(request);
  const body = coerceAnalyticsPayload(rawBody) as AnalyticsRequestBody;
  const cookies = parseCookies(request.headers.get("cookie"));
  const url = new URL(request.url);

  const testId = requireString(body.test_id);
  if (options.requireTestId !== false && !testId) {
    return respondBadRequest(missingRequiredError("test_id"));
  }

  const distinctIdFromRequest = getDistinctIdFromRequest({ body, cookies });
  const distinctId = distinctIdFromRequest ?? createDistinctId();

  const sessionId = options.createSession
    ? createSessionId()
    : getSessionIdFromRequest({ body, cookies });
  if (!sessionId) {
    return respondBadRequest(missingRequiredError("session_id"));
  }

  const { tenantId, defaultLocale } = await resolveTenantAsync(
    request.headers,
    url.hostname
  );
  const locale = resolveLocale({
    defaultLocale,
    acceptLanguage: request.headers.get("accept-language")
  });

  if (options.requireAttemptToken) {
    const requestAttemptToken = getAttemptTokenFromRequest({ body, cookies });
    if (!requestAttemptToken) {
      return respondUnauthorized("Attempt token is required.");
    }

    let verifiedToken: ReturnType<typeof verifyAttemptToken>;
    try {
      verifiedToken = verifyAttemptToken(requestAttemptToken);
    } catch {
      return respondUnauthorized("Attempt token is invalid.");
    }

    try {
      assertAttemptTokenMatchesContext(verifiedToken, {
        tenant_id: tenantId,
        session_id: sessionId,
        distinct_id: distinctId
      });
    } catch {
      return respondUnauthorized("Attempt token does not match request context.");
    }
  }

  const { utm, clickIds, shouldSetUtmCookie, shouldSetClickIdsCookie } =
    getTrackingContextFromRequest({ cookies, url });

  const properties = buildBaseEventProperties({
    tenantId,
    sessionId,
    distinctId,
    testId,
    utm,
    clickIds,
    locale,
    referrer: normalizeString(body.referrer),
    country: normalizeString(body.country),
    language: normalizeString(body.language),
    deviceType: normalizeString(body.device_type)
  });

  const purchaseId = normalizeString(body.purchase_id);
  if (options.requirePurchaseId && !purchaseId) {
    return respondBadRequest(missingRequiredError("purchase_id"));
  }
  if (purchaseId) {
    properties.purchase_id = purchaseId;
  }

  const pageViewType =
    options.event === "page_view" ? resolvePageType(body.page_type) : null;
  if (options.event === "page_view") {
    properties.page_url = sanitizePageUrl(body.page_url);
    properties.page_type = pageViewType;
  }

  if (options.event === "share_click") {
    const shareTarget = requireString(body.share_target);
    if (!shareTarget) {
      return respondBadRequest(missingRequiredError("share_target"));
    }
    properties.share_target = shareTarget;
  }

  const upsellId = requireString(body.upsell_id);
  if (options.event === "upsell_accept") {
    if (!upsellId) {
      return respondBadRequest(missingRequiredError("upsell_id"));
    }
    properties.upsell_id = upsellId;
  } else if (options.event === "upsell_view" && upsellId) {
    properties.upsell_id = upsellId;
  }

  if (options.extendProperties) {
    const extraProperties = options.extendProperties({
      body,
      properties,
      sessionId,
      tenantId,
      distinctId,
      utm,
      clickIds
    });

    for (const [key, value] of Object.entries(extraProperties)) {
      if (value !== undefined) {
        (properties as Record<string, unknown>)[key] = value;
      }
    }
  }

  const providedEventId = requireString(body.event_id);
  const fallbackEventId = `${options.event}:${properties.timestamp_utc}:${sessionId}`;
  const eventId = providedEventId ?? fallbackEventId;
  properties.event_id = eventId;

  const validation = validateAnalyticsEventPayload(options.event, {
    ...body,
    ...properties
  });
  if (!validation.ok) {
    return respondBadRequest(validation.error);
  }

  const shouldEmit =
    options.event === "page_view"
      ? shouldEmitPageView({
          sessionId,
          pageType: pageViewType ?? DEFAULT_PAGE_VIEW_TYPE
        }) && shouldEmitEvent(eventId)
      : shouldEmitEvent(eventId);

  if (shouldEmit) {
    void capturePosthogEvent(options.event, properties).catch(() => null);
    void recordAnalyticsEventToContentDb(options.event, properties).catch(() => null);
  }

  let attemptToken: string | null = null;
  let attemptTokenTtlSeconds: number | null = null;
  if (options.issueAttemptToken) {
    attemptTokenTtlSeconds = resolveAttemptTokenTtlSeconds();
    attemptToken = issueAttemptToken(
      {
        tenant_id: tenantId,
        session_id: sessionId,
        distinct_id: distinctId
      },
      attemptTokenTtlSeconds
    );
  }

  const responsePayload: Record<string, unknown> = {
    session_id: sessionId,
    tenant_id: tenantId
  };

  if (attemptToken) {
    responsePayload.attempt_token = attemptToken;
  }

  if (options.extendResponse) {
    Object.assign(
      responsePayload,
      options.extendResponse({
        body,
        properties,
        sessionId,
        tenantId,
        distinctId,
        utm,
        clickIds
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

  if (attemptToken && attemptTokenTtlSeconds) {
    response.cookies.set(ATTEMPT_TOKEN_COOKIE_NAME, attemptToken, {
      httpOnly: true,
      maxAge: attemptTokenTtlSeconds,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production"
    });
  }

  if (shouldSetUtmCookie) {
    response.cookies.set(UTM_COOKIE_NAME, serializeUtmCookie(utm), {
      httpOnly: true,
      maxAge: TRACKING_COOKIE_MAX_AGE_SECONDS,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production"
    });
  }

  if (shouldSetClickIdsCookie) {
    response.cookies.set(CLICK_COOKIE_NAME, serializeClickIdsCookie(clickIds), {
      httpOnly: true,
      maxAge: TRACKING_COOKIE_MAX_AGE_SECONDS,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production"
    });
  }

  return response;
};

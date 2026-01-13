import { describe, expect, it } from "vitest";

import {
  createSessionId,
  getSessionIdFromRequest,
  getTrackingContextFromRequest,
  normalizeClickIds,
  normalizeUtm,
  parseCookies,
  serializeClickIdsCookie,
  parseUtmCookie,
  serializeUtmCookie
} from "./session";

describe("session id handling", () => {
  it("creates uuid session ids", () => {
    const sessionId = createSessionId();
    expect(sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it("prefers body session id over cookie", () => {
    const cookies = parseCookies("qf_session_id=cookie-session");
    const sessionId = getSessionIdFromRequest({
      body: { session_id: "body-session" },
      cookies
    });

    expect(sessionId).toBe("body-session");
  });
});

describe("utm persistence", () => {
  it("round-trips utm cookies", () => {
    const utm = normalizeUtm({ utm_source: "newsletter", utm_term: "quiz" });
    const cookie = serializeUtmCookie(utm);
    const parsed = parseUtmCookie(cookie);

    expect(parsed).toEqual(utm);
  });
});

describe("tracking context", () => {
  it("reads utm and click ids from first touch query params", () => {
    const context = getTrackingContextFromRequest({
      cookies: {},
      url: new URL(
        "https://tenant.example.com/api/test/start?utm_source=google&utm_medium=cpc&gclid=abc123"
      )
    });

    expect(context.utm.utm_source).toBe("google");
    expect(context.utm.utm_medium).toBe("cpc");
    expect(context.clickIds.gclid).toBe("abc123");
    expect(context.shouldSetUtmCookie).toBe(true);
    expect(context.shouldSetClickIdsCookie).toBe(true);
  });

  it("prefers stored cookies over new query params", () => {
    const utmCookie = serializeUtmCookie(
      normalizeUtm({ utm_source: "newsletter", utm_medium: "email" })
    );
    const clickCookie = serializeClickIdsCookie(normalizeClickIds({ fbclid: "fb-1" }));

    const context = getTrackingContextFromRequest({
      cookies: {
        qf_utm: utmCookie,
        qf_click: clickCookie
      },
      url: new URL(
        "https://tenant.example.com/api/test/start?utm_source=google&fbclid=fb-2"
      )
    });

    expect(context.utm.utm_source).toBe("newsletter");
    expect(context.clickIds.fbclid).toBe("fb-1");
    expect(context.shouldSetUtmCookie).toBe(false);
    expect(context.shouldSetClickIdsCookie).toBe(false);
  });
});

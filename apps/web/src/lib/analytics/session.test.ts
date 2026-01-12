import { describe, expect, it } from "vitest";

import {
  createSessionId,
  getSessionIdFromRequest,
  mergeUtm,
  normalizeUtm,
  parseCookies,
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
  it("keeps the first utm values", () => {
    const existing = normalizeUtm({ utm_source: "google" });
    const merged = mergeUtm(existing, { utm_source: "bing", utm_medium: "cpc" });

    expect(merged.utm_source).toBe("google");
    expect(merged.utm_medium).toBe("cpc");
  });

  it("round-trips utm cookies", () => {
    const utm = normalizeUtm({ utm_source: "newsletter", utm_term: "quiz" });
    const cookie = serializeUtmCookie(utm);
    const parsed = parseUtmCookie(cookie);

    expect(parsed).toEqual(utm);
  });
});

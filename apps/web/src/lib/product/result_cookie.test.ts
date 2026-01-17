import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  type ResultCookiePayload,
  signResultCookie,
  verifyResultCookie
} from "./result_cookie";

describe("result cookie", () => {
  beforeEach(() => {
    process.env.RESULT_COOKIE_SECRET = "test-result-cookie-secret";
  });

  afterEach(() => {
    delete process.env.RESULT_COOKIE_SECRET;
  });

  it("signs and verifies payloads", () => {
    const payload: ResultCookiePayload = {
      tenant_id: "tenant-1",
      session_id: "session-1",
      distinct_id: "distinct-1",
      test_id: "test-demo",
      computed_at_utc: "2024-01-01T00:00:00Z",
      band_id: "band-1",
      scale_scores: {
        alpha: 2,
        beta: 1
      }
    };

    const signed = signResultCookie(payload);
    const verified = verifyResultCookie(signed);

    expect(verified).toEqual(payload);
  });
});

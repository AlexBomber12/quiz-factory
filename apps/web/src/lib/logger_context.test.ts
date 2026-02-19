import { describe, expect, it } from "vitest";

import { requestContext } from "./logger_context";

describe("requestContext", () => {
  it("redacts query string and hash from request url", () => {
    const request = new Request(
      "https://example.com/api/report/access?t=secret-token#section",
      { method: "POST" }
    );

    expect(requestContext(request)).toEqual({
      method: "POST",
      url: "/api/report/access"
    });
  });
});

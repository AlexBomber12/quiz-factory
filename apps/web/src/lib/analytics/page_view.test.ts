import { beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_PAGE_VIEW_TYPE,
  resetPageViewDedupCache,
  sanitizePageUrl,
  shouldEmitPageView
} from "./page_view";

describe("page view controls", () => {
  beforeEach(() => {
    resetPageViewDedupCache();
  });

  it("dedupes page_view events by session_id", () => {
    const sessionId = "session-123";

    const first = shouldEmitPageView({
      sessionId,
      pageType: DEFAULT_PAGE_VIEW_TYPE,
      now: 1000
    });
    const second = shouldEmitPageView({
      sessionId,
      pageType: DEFAULT_PAGE_VIEW_TYPE,
      now: 1001
    });

    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it("sanitizes page_url to pathname only", () => {
    const sanitized = sanitizePageUrl(
      "https://example.com/quiz/result?utm_source=google&extra=1"
    );

    expect(sanitized).toBe("/quiz/result");
    expect(sanitized?.length).toBeLessThanOrEqual(256);
  });
});

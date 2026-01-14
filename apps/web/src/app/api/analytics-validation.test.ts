import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as pageView } from "./page/view/route";
import { POST as shareClick } from "./share/click/route";

type CapturedEvent = {
  event: string;
  properties: Record<string, unknown>;
};

const buildRequest = (url: string, body: Record<string, unknown>) => {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "tenant.example.com"
    },
    body: JSON.stringify(body)
  });
};

describe("analytics validation routes", () => {
  const capturedEvents: CapturedEvent[] = [];

  beforeEach(() => {
    capturedEvents.length = 0;
    process.env.POSTHOG_SERVER_KEY = "test-server-key";
    process.env.POSTHOG_HOST = "https://posthog.test";

    const fetchSpy = vi.fn(async (_url: string, options?: { body?: unknown }) => {
      const payload = options?.body ? JSON.parse(options.body as string) : null;
      if (payload) {
        capturedEvents.push(payload as CapturedEvent);
      }
      return new Response(null, { status: 200 });
    });

    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.POSTHOG_SERVER_KEY;
    delete process.env.POSTHOG_HOST;
  });

  it("rejects forbidden keys for page_view", async () => {
    const response = await pageView(
      buildRequest("https://tenant.example.com/api/page/view", {
        session_id: "session-123",
        distinct_id: "distinct-123",
        email: "hidden@example.com"
      })
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error?.code).toBe("forbidden_properties");
    expect(capturedEvents).toHaveLength(0);
  });

  it("rejects missing share_target for share_click", async () => {
    const response = await shareClick(
      buildRequest("https://tenant.example.com/api/share/click", {
        test_id: "test-demo",
        session_id: "session-123",
        distinct_id: "distinct-123"
      })
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error?.code).toBe("missing_required");
    expect(payload.error?.details?.missing).toContain("share_target");
    expect(capturedEvents).toHaveLength(0);
  });

  it("accepts share_click payloads", async () => {
    const response = await shareClick(
      buildRequest("https://tenant.example.com/api/share/click", {
        test_id: "test-demo",
        session_id: "session-123",
        distinct_id: "distinct-123",
        share_target: "whatsapp"
      })
    );

    expect(response.status).toBe(200);
    expect(capturedEvents).toHaveLength(1);
    expect(capturedEvents[0]?.event).toBe("share_click");
  });
});

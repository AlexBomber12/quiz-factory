import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { POST as checkoutStart } from "./checkout/start/route";
import { POST as pageView } from "./page/view/route";
import { POST as paywallView } from "./paywall/view/route";
import { POST as testComplete } from "./test/complete/route";
import { POST as testStart } from "./test/start/route";

type CapturedEvent = {
  event: string;
  properties: Record<string, unknown>;
};

class CookieJar {
  private jar: Record<string, string> = {};

  addFromResponse(response: Response) {
    const headerWithSetCookie = response.headers as unknown as {
      getSetCookie?: () => string[];
    };
    const setCookieValues = headerWithSetCookie.getSetCookie
      ? headerWithSetCookie.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean) as string[];

    if (setCookieValues.length === 0) {
      return;
    }

    for (const setCookie of setCookieValues) {
      const cookieParts = setCookie.split(/,(?=[^;]+=[^;]+)/);
      for (const part of cookieParts) {
        const [pair] = part.trim().split(";");
        if (!pair) {
          continue;
        }

        const [name, value] = pair.split("=");
        if (name && value) {
          this.jar[name] = value;
        }
      }
    }
  }

  header() {
    return Object.entries(this.jar)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }
}

const buildRequest = (
  url: string,
  body: Record<string, unknown>,
  cookieHeader?: string
) => {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    host: "tenant.example.com"
  };
  if (cookieHeader) {
    headers.cookie = cookieHeader;
  }

  return new Request(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
};

describe("analytics flow", () => {
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

  it("keeps the same session_id across the funnel", async () => {
    const jar = new CookieJar();
    const baseBody = {
      test_id: "test-personality",
      distinct_id: "11111111-1111-1111-1111-111111111111",
      locale: "en"
    };

    const startRequest = buildRequest(
      "https://tenant.example.com/api/test/start?utm_source=google&utm_medium=cpc",
      baseBody
    );
    const startResponse = await testStart(startRequest);
    jar.addFromResponse(startResponse);
    const startPayload = await startResponse.json();
    const sessionId = startPayload.session_id as string;

    expect(sessionId).toBeTruthy();
    const startCookies = startResponse.headers.get("set-cookie") ?? "";
    expect(startCookies).toContain("qf_session_id");
    expect(startCookies).toContain("qf_utm=");
    expect(startCookies).toContain("Max-Age=");

    const followupBody = { ...baseBody, session_id: sessionId };
    const pageViewResponse = await pageView(
      buildRequest(
        "https://tenant.example.com/api/page/view",
        { ...followupBody, page_type: "attempt" },
        jar.header()
      )
    );
    jar.addFromResponse(pageViewResponse);
    await pageViewResponse.json();

    const completeResponse = await testComplete(
      buildRequest("https://tenant.example.com/api/test/complete", followupBody, jar.header())
    );
    jar.addFromResponse(completeResponse);
    await completeResponse.json();

    const paywallResponse = await paywallView(
      buildRequest("https://tenant.example.com/api/paywall/view", followupBody, jar.header())
    );
    jar.addFromResponse(paywallResponse);
    await paywallResponse.json();

    const checkoutResponse = await checkoutStart(
      buildRequest(
        "https://tenant.example.com/api/checkout/start",
        followupBody,
        jar.header()
      )
    );
    await checkoutResponse.json();

    const pageViewEvent = capturedEvents.find((event) => event.event === "page_view");
    expect(pageViewEvent).toBeTruthy();
    expect(pageViewEvent?.properties.session_id).toBe(sessionId);

    const events = capturedEvents.filter((event) =>
      ["page_view", "test_start", "test_complete", "paywall_view", "checkout_start"].includes(
        event.event
      )
    );

    const sessionIds = new Set(events.map((event) => event.properties.session_id));
    expect(sessionIds.size).toBe(1);

    for (const event of events) {
      expect(event.properties.session_id).toBe(sessionId);
      expect(event.properties.tenant_id).toBe("tenant-tenant-example-com");
      expect(event.properties.utm_source).toBe("google");
      expect(event.properties.utm_medium).toBe("cpc");
      expect(event.properties.locale).toBe("en");
    }
  });
});

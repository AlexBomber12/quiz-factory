import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  completeAttempt,
  emitAttemptEntryPageView,
  emitReportPdfDownload,
  startAttempt
} from "./client";

describe("product client helpers", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts test_start payload", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ session_id: "session-123", attempt_token: "token-123" }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      })
    );

    const result = await startAttempt("test-demo");

    expect(result).toEqual({
      session_id: "session-123",
      attempt_token: "token-123"
    });
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, options] = fetchSpy.mock.calls[0] as [
      string,
      { method?: string; headers?: { [key: string]: string }; body?: string }
    ];
    expect(url).toBe("/api/test/start");
    expect(options?.method).toBe("POST");
    expect(options?.headers).toEqual({
      "content-type": "application/json"
    });
    const body = JSON.parse(options?.body as string);
    expect(body).toEqual({ test_id: "test-demo" });
  });

  it("rejects when attempt_token is missing", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ session_id: "session-123" }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      })
    );

    await expect(startAttempt("test-demo")).rejects.toThrow("Attempt token");
  });

  it("posts attempt entry page_view payload", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }));

    await emitAttemptEntryPageView({
      test_id: "test-demo",
      session_id: "session-123",
      attempt_token: "token-123",
      page_type: "attempt_entry",
      page_url: "/t/test-demo/run"
    });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, options] = fetchSpy.mock.calls[0] as [
      string,
      { method?: string; headers?: { [key: string]: string }; body?: string }
    ];
    expect(url).toBe("/api/page/view");
    expect(options?.method).toBe("POST");
    expect(options?.headers).toEqual({
      "content-type": "application/json"
    });
    const body = JSON.parse(options?.body as string);
    expect(body).toEqual({
      test_id: "test-demo",
      session_id: "session-123",
      attempt_token: "token-123",
      page_type: "attempt_entry",
      page_url: "/t/test-demo/run"
    });
  });

  it("posts report pdf download payload", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }));

    await emitReportPdfDownload({
      test_id: "test-demo",
      purchase_id: "purchase-123"
    });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, options] = fetchSpy.mock.calls[0] as [
      string,
      { method?: string; headers?: { [key: string]: string }; body?: string }
    ];
    expect(url).toBe("/api/report/pdf");
    expect(options?.method).toBe("POST");
    expect(options?.headers).toEqual({
      "content-type": "application/json"
    });
    const body = JSON.parse(options?.body as string);
    expect(body).toEqual({
      test_id: "test-demo",
      purchase_id: "purchase-123"
    });
  });

  it("posts test_complete payload", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }));

    await completeAttempt({
      test_id: "test-demo",
      session_id: "session-123",
      attempt_token: "token-123"
    });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, options] = fetchSpy.mock.calls[0] as [
      string,
      { method?: string; headers?: { [key: string]: string }; body?: string }
    ];
    expect(url).toBe("/api/test/complete");
    expect(options?.method).toBe("POST");
    expect(options?.headers).toEqual({
      "content-type": "application/json"
    });
    const body = JSON.parse(options?.body as string);
    expect(body).toEqual({
      test_id: "test-demo",
      session_id: "session-123",
      attempt_token: "token-123"
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runAlertRules: vi.fn()
}));

vi.mock("../../../../../lib/alerts/engine", () => ({
  runAlertRules: (...args: unknown[]) => mocks.runAlertRules(...args)
}));

import { POST } from "./route";

describe("POST /api/internal/alerts/run", () => {
  beforeEach(() => {
    mocks.runAlertRules.mockReset();
    process.env.ALERTS_RUNNER_SECRET = "alerts-secret";
  });

  it("returns 401 when secret header is missing", async () => {
    const response = await POST(
      new Request("https://tenant.example.com/api/internal/alerts/run", {
        method: "POST"
      })
    );

    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload.error).toBe("Unauthorized.");
  });

  it("returns 401 when secret header does not match", async () => {
    const response = await POST(
      new Request("https://tenant.example.com/api/internal/alerts/run", {
        method: "POST",
        headers: {
          "x-alerts-runner-secret": "wrong-secret"
        }
      })
    );

    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload.error).toBe("Unauthorized.");
  });

  it("runs alerts when the secret is valid", async () => {
    mocks.runAlertRules.mockResolvedValue({
      rule_id: "rule-1",
      dry_run: true,
      evaluated: 1,
      triggered: 1,
      inserted: 0,
      results: []
    });

    const response = await POST(
      new Request(
        "https://tenant.example.com/api/internal/alerts/run?rule_id=rule-1&dry_run=true",
        {
          method: "POST",
          headers: {
            "x-alerts-runner-secret": "alerts-secret"
          }
        }
      )
    );

    expect(response.status).toBe(200);
    expect(mocks.runAlertRules).toHaveBeenCalledWith({
      rule_id: "rule-1",
      dry_run: true
    });
  });
});

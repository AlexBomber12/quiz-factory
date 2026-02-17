import { beforeEach, describe, expect, it, vi } from "vitest";

const csrfToken = "csrf-token-01234567890123456789";
let sessionRole: "admin" | "editor" | null = "admin";

const mocks = vi.hoisted(() => ({
  getAlertInstanceWithRuleById: vi.fn(),
  getAlertAiInsightByInstanceId: vi.fn(),
  upsertAlertAiInsight: vi.fn(),
  buildAlertInsightPrompt: vi.fn(),
  generateAlertInsightFromPrompt: vi.fn(),
  logAdminEvent: vi.fn()
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      if (name === "admin_csrf") {
        return { value: csrfToken };
      }

      if (name === "admin_session") {
        return { value: "session-cookie" };
      }

      return undefined;
    }
  })
}));

vi.mock("../../../../../../lib/admin/session", () => ({
  ADMIN_SESSION_COOKIE: "admin_session",
  verifyAdminSession: vi.fn(async () => {
    if (!sessionRole) {
      return null;
    }

    return {
      role: sessionRole,
      expires_at: new Date(Date.now() + 60_000).toISOString()
    };
  })
}));

vi.mock("../../../../../../lib/alerts/repo", () => ({
  getAlertInstanceWithRuleById: (...args: unknown[]) => mocks.getAlertInstanceWithRuleById(...args),
  getAlertAiInsightByInstanceId: (...args: unknown[]) => mocks.getAlertAiInsightByInstanceId(...args),
  upsertAlertAiInsight: (...args: unknown[]) => mocks.upsertAlertAiInsight(...args)
}));

vi.mock("../../../../../../lib/alerts/insight", () => ({
  buildAlertInsightPrompt: (...args: unknown[]) => mocks.buildAlertInsightPrompt(...args),
  buildAlertInsightMarkdown: vi.fn(() => "## Insight"),
  generateAlertInsightFromPrompt: (...args: unknown[]) => mocks.generateAlertInsightFromPrompt(...args)
}));

vi.mock("../../../../../../lib/admin/audit", () => ({
  logAdminEvent: (...args: unknown[]) => mocks.logAdminEvent(...args)
}));

import { GET, POST } from "./route";

describe("admin alert insight route", () => {
  beforeEach(() => {
    sessionRole = "admin";
    process.env.OPENAI_API_KEY = "test-openai-api-key";

    mocks.getAlertInstanceWithRuleById.mockReset();
    mocks.getAlertAiInsightByInstanceId.mockReset();
    mocks.upsertAlertAiInsight.mockReset();
    mocks.buildAlertInsightPrompt.mockReset();
    mocks.generateAlertInsightFromPrompt.mockReset();
    mocks.logAdminEvent.mockReset();

    mocks.logAdminEvent.mockResolvedValue(undefined);
    mocks.getAlertInstanceWithRuleById.mockResolvedValue({
      id: "instance-1",
      rule_id: "rule-1",
      rule_name: "Conversion drop",
      rule_type: "conversion_drop",
      status: "open",
      severity: "critical",
      fired_at: "2026-02-17T10:15:00.000Z",
      context_json: {},
      fingerprint: "fingerprint-1",
      created_at: "2026-02-17T10:15:00.000Z",
      scope_json: {
        tenant_id: "tenant-alpha",
        content_type: "test",
        content_key: "focus-rhythm"
      },
      params_json: {
        threshold_pct: 0.3
      }
    });
    mocks.buildAlertInsightPrompt.mockReturnValue({
      system: "system",
      user: "user",
      prompt_hash: "hash-1"
    });
    mocks.generateAlertInsightFromPrompt.mockResolvedValue({
      summary: "Summary",
      root_cause_hypotheses: ["Cause 1"],
      actions: [
        {
          title: "Action 1",
          steps: ["Step 1"],
          expected_effect: "Effect 1",
          risk_level: "low"
        },
        {
          title: "Action 2",
          steps: ["Step 2"],
          expected_effect: "Effect 2",
          risk_level: "medium"
        },
        {
          title: "Action 3",
          steps: ["Step 3"],
          expected_effect: "Effect 3",
          risk_level: "high"
        }
      ]
    });
    mocks.upsertAlertAiInsight.mockResolvedValue({
      alert_instance_id: "instance-1",
      model: "gpt-4o",
      prompt_hash: "hash-1",
      insight_md: "## Insight",
      actions_json: { summary: "Summary", root_cause_hypotheses: ["Cause 1"], actions: [] },
      created_at: "2026-02-17T10:20:00.000Z"
    });
  });

  it("returns 401 when session is missing", async () => {
    sessionRole = null;

    const response = await GET(new Request("https://tenant.example.com/api/admin/alerts/instance-1/insight"), {
      params: { id: "instance-1" }
    });

    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload.error).toBe("unauthorized");
  });

  it("returns cached insight on POST when prompt hash matches and force is false", async () => {
    mocks.getAlertAiInsightByInstanceId.mockResolvedValue({
      alert_instance_id: "instance-1",
      model: "gpt-4o",
      prompt_hash: "hash-1",
      insight_md: "Cached",
      actions_json: { summary: "Cached", root_cause_hypotheses: ["Cause"], actions: [] },
      created_at: "2026-02-17T10:20:00.000Z"
    });

    const response = await POST(
      new Request("https://tenant.example.com/api/admin/alerts/instance-1/insight", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-admin-csrf-token": csrfToken
        },
        body: JSON.stringify({
          csrf_token: csrfToken,
          force: false
        })
      }),
      {
        params: { id: "instance-1" }
      }
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.cached).toBe(true);
    expect(mocks.generateAlertInsightFromPrompt).not.toHaveBeenCalled();
    expect(mocks.upsertAlertAiInsight).not.toHaveBeenCalled();
  });

  it("regenerates on POST when cached prompt hash is stale and force is false", async () => {
    mocks.getAlertAiInsightByInstanceId.mockResolvedValue({
      alert_instance_id: "instance-1",
      model: "gpt-4o",
      prompt_hash: "hash-stale",
      insight_md: "Stale",
      actions_json: { summary: "Stale", root_cause_hypotheses: ["Cause"], actions: [] },
      created_at: "2026-02-17T10:20:00.000Z"
    });

    const response = await POST(
      new Request("https://tenant.example.com/api/admin/alerts/instance-1/insight", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-admin-csrf-token": csrfToken
        },
        body: JSON.stringify({
          csrf_token: csrfToken,
          force: false
        })
      }),
      {
        params: { id: "instance-1" }
      }
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.cached).toBe(false);
    expect(mocks.generateAlertInsightFromPrompt).toHaveBeenCalledTimes(1);
    expect(mocks.upsertAlertAiInsight).toHaveBeenCalledTimes(1);
  });

  it("regenerates and upserts insight when force is true", async () => {
    mocks.getAlertAiInsightByInstanceId.mockResolvedValue({
      alert_instance_id: "instance-1",
      model: "gpt-4o",
      prompt_hash: "hash-0",
      insight_md: "Old",
      actions_json: { summary: "Old", root_cause_hypotheses: ["Old"], actions: [] },
      created_at: "2026-02-17T10:10:00.000Z"
    });

    const response = await POST(
      new Request("https://tenant.example.com/api/admin/alerts/instance-1/insight", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-admin-csrf-token": csrfToken
        },
        body: JSON.stringify({
          csrf_token: csrfToken,
          force: true
        })
      }),
      {
        params: { id: "instance-1" }
      }
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.cached).toBe(false);
    expect(mocks.generateAlertInsightFromPrompt).toHaveBeenCalledTimes(1);
    expect(mocks.upsertAlertAiInsight).toHaveBeenCalledTimes(1);
  });
});

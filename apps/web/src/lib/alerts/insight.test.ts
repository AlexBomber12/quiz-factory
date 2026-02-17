import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AlertInstanceWithRuleRecord } from "./types";

const mocks = vi.hoisted(() => ({
  createStructuredJsonResponse: vi.fn()
}));

vi.mock("../llm/openai_client", () => ({
  createStructuredJsonResponse: (...args: unknown[]) => mocks.createStructuredJsonResponse(...args)
}));

import {
  ALERT_INSIGHT_SCHEMA_NAME,
  buildAlertInsightPrompt,
  generateAlertInsightFromPrompt,
  normalizeAlertInsightPayload
} from "./insight";

const ALERT_INSTANCE: AlertInstanceWithRuleRecord = {
  id: "instance-1",
  rule_id: "rule-1",
  rule_name: "Conversion drop critical",
  rule_type: "conversion_drop",
  status: "open",
  severity: "critical",
  fired_at: "2026-02-17T10:15:00.000Z",
  context_json: {
    tenant_id: "tenant-alpha",
    content_type: "test",
    content_key: "focus-rhythm",
    current_window: {
      start: "2026-02-16",
      end: "2026-02-16"
    },
    baseline_window: {
      start: "2026-02-09",
      end: "2026-02-15"
    },
    threshold_pct: 0.3,
    current: {
      visits: 120,
      purchases: 6,
      conversion_rate: 0.05
    },
    baseline: {
      visits: 790,
      purchases: 158,
      conversion_rate: 0.2
    },
    drop_ratio: 0.75
  },
  fingerprint: "fingerprint-1",
  created_at: "2026-02-17T10:15:00.000Z",
  scope_json: {
    tenant_id: "tenant-alpha",
    content_type: "test",
    content_key: "focus-rhythm"
  },
  params_json: {
    lookback_days: 1,
    baseline_days: 7,
    threshold_pct: 0.3,
    min_visits: 50
  }
};

describe("alerts insight", () => {
  beforeEach(() => {
    mocks.createStructuredJsonResponse.mockReset();
  });

  it("builds deterministic prompt with alert metadata and schema reference", () => {
    const prompt = buildAlertInsightPrompt({
      instance: ALERT_INSTANCE,
      model: "gpt-4o"
    });

    expect(prompt.system).toContain(ALERT_INSIGHT_SCHEMA_NAME);
    expect(prompt.user).toContain("\"rule\":");
    expect(prompt.user).toContain("\"threshold_pct\": 0.3");
    expect(prompt.user).toContain("\"windows\":");
    expect(prompt.prompt_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("validates generated payload returned by the LLM client", async () => {
    mocks.createStructuredJsonResponse.mockResolvedValue({
      summary: "Conversion dropped sharply versus baseline.",
      root_cause_hypotheses: [
        "Traffic quality shifted to lower-intent sources.",
        "Checkout friction increased after a copy change."
      ],
      actions: [
        {
          title: "Check campaign mix",
          steps: ["Compare yesterday traffic sources to baseline", "Pause high-bounce campaigns"],
          expected_effect: "Remove low-intent sessions and recover conversion rate.",
          risk_level: "low"
        },
        {
          title: "Review checkout events",
          steps: ["Inspect drop-off at payment step", "Verify payment provider status"],
          expected_effect: "Identify and resolve conversion blockers quickly.",
          risk_level: "medium"
        },
        {
          title: "Launch controlled rollback",
          steps: ["Revert recent checkout copy change", "Track conversion for 24h"],
          expected_effect: "Validate whether recent changes caused the regression.",
          risk_level: "medium"
        }
      ]
    });

    const payload = await generateAlertInsightFromPrompt({
      model: "gpt-4o",
      prompt: buildAlertInsightPrompt({
        instance: ALERT_INSTANCE,
        model: "gpt-4o"
      })
    });

    expect(payload.actions).toHaveLength(3);
    expect(payload.root_cause_hypotheses[0]).toContain("Traffic quality");
    expect(mocks.createStructuredJsonResponse).toHaveBeenCalledTimes(1);
  });

  it("rejects payload fields that contain external links", () => {
    expect(() =>
      normalizeAlertInsightPayload({
        summary: "See https://example.com for details.",
        root_cause_hypotheses: ["One hypothesis"],
        actions: [
          {
            title: "Do it",
            steps: ["Run check"],
            expected_effect: "Improve conversion.",
            risk_level: "low"
          },
          {
            title: "Do it 2",
            steps: ["Run check 2"],
            expected_effect: "Improve conversion.",
            risk_level: "medium"
          },
          {
            title: "Do it 3",
            steps: ["Run check 3"],
            expected_effect: "Improve conversion.",
            risk_level: "high"
          }
        ]
      })
    ).toThrow(/forbidden/i);
  });
});

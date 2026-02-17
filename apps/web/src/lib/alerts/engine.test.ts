import { describe, expect, it } from "vitest";

import { evaluateAlertRule } from "./engine";
import type { AlertsProvider } from "./provider";
import type { AlertRuleRecord, AlertRuleType } from "./types";

const NOW = new Date("2026-02-17T12:00:00.000Z");

type MetricsPoint = {
  date: string;
  visits: number;
  purchases: number;
  gross_revenue_eur: number;
  refunds_eur: number;
  net_revenue_eur: number;
};

const buildRule = (
  ruleType: AlertRuleType,
  params: Record<string, unknown> = {}
): AlertRuleRecord => {
  return {
    id: `rule-${ruleType}`,
    name: `Rule ${ruleType}`,
    enabled: true,
    rule_type: ruleType,
    scope_json: {
      tenant_id: "tenant-alpha",
      content_type: "test",
      content_key: "test-focus-rhythm"
    },
    params_json: params,
    created_at: "2026-02-01T00:00:00.000Z",
    updated_at: "2026-02-01T00:00:00.000Z"
  };
};

const buildProvider = (input: {
  dailyMetrics?: MetricsPoint[];
  freshness?: { analytics_last_event_at: string | null; revenue_last_event_at: string | null };
}): AlertsProvider => {
  return {
    async getDailyMetrics() {
      return input.dailyMetrics ?? [];
    },
    async getFreshnessSnapshot() {
      return (
        input.freshness ?? {
          analytics_last_event_at: null,
          revenue_last_event_at: null
        }
      );
    }
  };
};

describe("evaluateAlertRule", () => {
  it("triggers conversion_drop when conversion rate falls below threshold", async () => {
    const baselineDays = [
      "2026-02-09",
      "2026-02-10",
      "2026-02-11",
      "2026-02-12",
      "2026-02-13",
      "2026-02-14",
      "2026-02-15"
    ];

    const dailyMetrics: MetricsPoint[] = [
      ...baselineDays.map((date) => ({
        date,
        visits: 100,
        purchases: 20,
        gross_revenue_eur: 500,
        refunds_eur: 10,
        net_revenue_eur: 450
      })),
      {
        date: "2026-02-16",
        visits: 100,
        purchases: 5,
        gross_revenue_eur: 120,
        refunds_eur: 4,
        net_revenue_eur: 100
      }
    ];

    const provider = buildProvider({ dailyMetrics });
    const rule = buildRule("conversion_drop");

    const result = await evaluateAlertRule(provider, rule, NOW);

    expect(result.triggered).toBe(true);
    expect(result.severity).toBe("critical");
    expect(result.reason).toBe("conversion_drop");
  });

  it("does not trigger traffic_spike when the multiplier is below threshold", async () => {
    const baselineDays = [
      "2026-02-09",
      "2026-02-10",
      "2026-02-11",
      "2026-02-12",
      "2026-02-13",
      "2026-02-14",
      "2026-02-15"
    ];

    const dailyMetrics: MetricsPoint[] = [
      ...baselineDays.map((date) => ({
        date,
        visits: 100,
        purchases: 10,
        gross_revenue_eur: 300,
        refunds_eur: 5,
        net_revenue_eur: 260
      })),
      {
        date: "2026-02-16",
        visits: 130,
        purchases: 12,
        gross_revenue_eur: 320,
        refunds_eur: 6,
        net_revenue_eur: 270
      }
    ];

    const provider = buildProvider({ dailyMetrics });
    const rule = buildRule("traffic_spike");

    const result = await evaluateAlertRule(provider, rule, NOW);

    expect(result.triggered).toBe(false);
    expect(result.reason).toBe("traffic_within_threshold");
  });

  it("triggers data_freshness_fail when analytics freshness is missing", async () => {
    const provider = buildProvider({
      freshness: {
        analytics_last_event_at: null,
        revenue_last_event_at: "2026-02-17T11:45:00.000Z"
      }
    });

    const rule = buildRule("data_freshness_fail", {
      freshness_minutes: 30
    });

    const result = await evaluateAlertRule(provider, rule, NOW);

    expect(result.triggered).toBe(true);
    expect(result.severity).toBe("critical");
    expect(result.reason).toBe("freshness_threshold_exceeded");
  });
});

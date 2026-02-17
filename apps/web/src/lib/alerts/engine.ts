import { createHash } from "crypto";

import { getAlertsProvider, type AlertsProvider } from "./provider";
import { insertAlertInstance, listAlertRules } from "./repo";
import {
  type AlertInstanceSeverity,
  type AlertRuleRecord,
  type AlertRuleScope,
  type AlertRuleType
} from "./types";

type AggregatedMetrics = {
  visits: number;
  purchases: number;
  gross_revenue_eur: number;
  refunds_eur: number;
  net_revenue_eur: number;
};

type RuleWindow = {
  start: string;
  end: string;
};

type NormalizedRuleParams = {
  lookback_days: number;
  baseline_days: number;
  threshold_pct: number;
  threshold_rate: number;
  multiplier: number;
  min_visits: number;
  min_purchases: number;
  min_revenue_eur: number;
  freshness_minutes: number;
  dedupe_window_hours: number;
};

type AlertEvaluationResult = {
  triggered: boolean;
  severity: AlertInstanceSeverity;
  reason: string;
  context_json: Record<string, unknown>;
};

export type EvaluatedAlertRule = {
  rule_id: string;
  rule_name: string;
  rule_type: AlertRuleType;
  triggered: boolean;
  severity: AlertInstanceSeverity;
  reason: string;
  fingerprint: string | null;
  inserted: boolean;
  context_json: Record<string, unknown>;
};

export type RunAlertRulesInput = {
  rule_id?: string | null;
  dry_run?: boolean;
  now?: Date;
  provider?: AlertsProvider;
};

export type RunAlertRulesResult = {
  rule_id: string | null;
  dry_run: boolean;
  evaluated: number;
  triggered: number;
  inserted: number;
  results: EvaluatedAlertRule[];
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const normalizeNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toUtcDateOnly = (value: Date): Date => {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
};

const addUtcDays = (value: Date, offsetDays: number): Date => {
  return new Date(value.getTime() + offsetDays * DAY_IN_MS);
};

const toDateString = (value: Date): string => {
  return value.toISOString().slice(0, 10);
};

const parseDateString = (value: string): Date => {
  return new Date(`${value}T00:00:00.000Z`);
};

const safeRatio = (numerator: number, denominator: number): number => {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
};

const readNumericParam = (
  params: Record<string, unknown>,
  key: string,
  fallback: number,
  options?: { min?: number; max?: number }
): number => {
  const raw = params[key];
  const min = options?.min;
  const max = options?.max;

  const normalizeCandidate = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  };

  const candidate = normalizeCandidate(raw);
  if (candidate === null) {
    return fallback;
  }

  if (typeof min === "number" && candidate < min) {
    return min;
  }

  if (typeof max === "number" && candidate > max) {
    return max;
  }

  return candidate;
};

const normalizeRuleScope = (scope: AlertRuleScope): AlertRuleScope => {
  const tenantId = normalizeNonEmptyString(scope.tenant_id);
  const contentType = normalizeNonEmptyString(scope.content_type)?.toLowerCase() ?? null;
  const contentKey = normalizeNonEmptyString(scope.content_key);

  return {
    tenant_id: tenantId,
    content_type: contentType,
    content_key: contentKey
  };
};

const normalizeRuleParams = (
  ruleType: AlertRuleType,
  params: Record<string, unknown>
): NormalizedRuleParams => {
  const defaultsByRule: Record<AlertRuleType, Partial<NormalizedRuleParams>> = {
    conversion_drop: {
      lookback_days: 1,
      baseline_days: 7,
      threshold_pct: 0.3,
      min_visits: 50
    },
    revenue_drop: {
      lookback_days: 1,
      baseline_days: 7,
      threshold_pct: 0.3,
      min_revenue_eur: 50
    },
    refund_spike: {
      lookback_days: 1,
      baseline_days: 7,
      threshold_rate: 0.05,
      min_purchases: 5,
      multiplier: 1.5
    },
    traffic_spike: {
      lookback_days: 1,
      baseline_days: 7,
      multiplier: 1.8,
      min_visits: 30
    },
    data_freshness_fail: {
      freshness_minutes: 30
    }
  };

  const defaults = defaultsByRule[ruleType];

  return {
    lookback_days: Math.floor(
      readNumericParam(params, "lookback_days", defaults.lookback_days ?? 1, {
        min: 1,
        max: 30
      })
    ),
    baseline_days: Math.floor(
      readNumericParam(params, "baseline_days", defaults.baseline_days ?? 7, {
        min: 1,
        max: 90
      })
    ),
    threshold_pct: readNumericParam(params, "threshold_pct", defaults.threshold_pct ?? 0.3, {
      min: 0.01,
      max: 1
    }),
    threshold_rate: readNumericParam(params, "threshold_rate", defaults.threshold_rate ?? 0.05, {
      min: 0.01,
      max: 1
    }),
    multiplier: readNumericParam(params, "multiplier", defaults.multiplier ?? 1.5, {
      min: 1,
      max: 20
    }),
    min_visits: Math.floor(
      readNumericParam(params, "min_visits", defaults.min_visits ?? 0, {
        min: 0,
        max: 1_000_000
      })
    ),
    min_purchases: Math.floor(
      readNumericParam(params, "min_purchases", defaults.min_purchases ?? 0, {
        min: 0,
        max: 1_000_000
      })
    ),
    min_revenue_eur: readNumericParam(
      params,
      "min_revenue_eur",
      defaults.min_revenue_eur ?? 0,
      {
        min: 0,
        max: 10_000_000
      }
    ),
    freshness_minutes: Math.floor(
      readNumericParam(params, "freshness_minutes", defaults.freshness_minutes ?? 30, {
        min: 1,
        max: 10_080
      })
    ),
    dedupe_window_hours: Math.floor(
      readNumericParam(params, "dedupe_window_hours", 24, {
        min: 1,
        max: 720
      })
    )
  };
};

const sumMetricsInWindow = (
  rows: Array<{ date: string } & AggregatedMetrics>,
  window: RuleWindow
): AggregatedMetrics => {
  const start = window.start;
  const end = window.end;

  return rows.reduce<AggregatedMetrics>(
    (accumulator, row) => {
      if (row.date < start || row.date > end) {
        return accumulator;
      }

      return {
        visits: accumulator.visits + row.visits,
        purchases: accumulator.purchases + row.purchases,
        gross_revenue_eur: accumulator.gross_revenue_eur + row.gross_revenue_eur,
        refunds_eur: accumulator.refunds_eur + row.refunds_eur,
        net_revenue_eur: accumulator.net_revenue_eur + row.net_revenue_eur
      };
    },
    {
      visits: 0,
      purchases: 0,
      gross_revenue_eur: 0,
      refunds_eur: 0,
      net_revenue_eur: 0
    }
  );
};

const createFingerprint = (
  ruleId: string,
  scope: AlertRuleScope,
  now: Date,
  dedupeWindowHours: number
): string => {
  const bucketSizeMs = dedupeWindowHours * 60 * 60 * 1000;
  const bucketStartMs = Math.floor(now.getTime() / bucketSizeMs) * bucketSizeMs;
  const bucketStartIso = new Date(bucketStartMs).toISOString();

  const fingerprintPayload = {
    rule_id: ruleId,
    bucket_start_utc: bucketStartIso,
    tenant_id: scope.tenant_id,
    content_type: scope.content_type,
    content_key: scope.content_key
  };

  return createHash("sha256")
    .update(JSON.stringify(fingerprintPayload))
    .digest("hex");
};

const windowForRule = (
  now: Date,
  lookbackDays: number,
  baselineDays: number
): { current: RuleWindow; baseline: RuleWindow } => {
  const endDate = addUtcDays(toUtcDateOnly(now), -1);
  const currentEnd = toDateString(endDate);
  const currentStart = toDateString(addUtcDays(endDate, -(lookbackDays - 1)));
  const baselineEndDate = addUtcDays(parseDateString(currentStart), -1);
  const baselineEnd = toDateString(baselineEndDate);
  const baselineStart = toDateString(addUtcDays(baselineEndDate, -(baselineDays - 1)));

  return {
    current: {
      start: currentStart,
      end: currentEnd
    },
    baseline: {
      start: baselineStart,
      end: baselineEnd
    }
  };
};

const ageMinutesFromTimestamp = (timestamp: string | null, now: Date): number | null => {
  if (!timestamp) {
    return null;
  }

  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const deltaMs = now.getTime() - parsed;
  if (deltaMs <= 0) {
    return 0;
  }

  return Math.floor(deltaMs / 60_000);
};

const evaluateDataFreshnessRule = async (
  provider: AlertsProvider,
  rule: AlertRuleRecord,
  scope: AlertRuleScope,
  params: NormalizedRuleParams,
  now: Date
): Promise<AlertEvaluationResult> => {
  const freshness = await provider.getFreshnessSnapshot(scope);
  const analyticsLag = ageMinutesFromTimestamp(freshness.analytics_last_event_at, now);
  const revenueLag = ageMinutesFromTimestamp(freshness.revenue_last_event_at, now);
  const threshold = params.freshness_minutes;

  const analyticsStale = analyticsLag === null || analyticsLag > threshold;
  const revenueStale = revenueLag === null || revenueLag > threshold;
  const triggered = analyticsStale || revenueStale;

  const maxLag = Math.max(analyticsLag ?? threshold * 3, revenueLag ?? threshold * 3);
  const severity: AlertInstanceSeverity = triggered
    ? maxLag >= threshold * 3
      ? "critical"
      : "warn"
    : "info";

  return {
    triggered,
    severity,
    reason: triggered ? "freshness_threshold_exceeded" : "freshness_ok",
    context_json: {
      tenant_id: scope.tenant_id,
      content_type: scope.content_type,
      content_key: scope.content_key,
      rule_id: rule.id,
      rule_name: rule.name,
      rule_type: rule.rule_type,
      threshold_minutes: threshold,
      analytics_last_event_at: freshness.analytics_last_event_at,
      revenue_last_event_at: freshness.revenue_last_event_at,
      analytics_lag_minutes: analyticsLag,
      revenue_lag_minutes: revenueLag,
      evaluated_at_utc: now.toISOString()
    }
  };
};

const buildContextBase = (
  rule: AlertRuleRecord,
  scope: AlertRuleScope,
  now: Date,
  windows: { current: RuleWindow; baseline: RuleWindow }
): Record<string, unknown> => {
  return {
    tenant_id: scope.tenant_id,
    content_type: scope.content_type,
    content_key: scope.content_key,
    rule_id: rule.id,
    rule_name: rule.name,
    rule_type: rule.rule_type,
    current_window: windows.current,
    baseline_window: windows.baseline,
    evaluated_at_utc: now.toISOString()
  };
};

const evaluateConversionDropRule = (
  rule: AlertRuleRecord,
  scope: AlertRuleScope,
  params: NormalizedRuleParams,
  now: Date,
  windows: { current: RuleWindow; baseline: RuleWindow },
  current: AggregatedMetrics,
  baseline: AggregatedMetrics
): AlertEvaluationResult => {
  const currentRate = safeRatio(current.purchases, current.visits);
  const baselineRate = safeRatio(baseline.purchases, baseline.visits);
  const dropRatio = baselineRate > 0 ? 1 - currentRate / baselineRate : 0;

  const triggered =
    baseline.visits >= params.min_visits &&
    current.visits >= params.min_visits &&
    baselineRate > 0 &&
    dropRatio >= params.threshold_pct;

  const severity: AlertInstanceSeverity = triggered
    ? dropRatio >= params.threshold_pct * 1.5
      ? "critical"
      : "warn"
    : "info";

  return {
    triggered,
    severity,
    reason: triggered ? "conversion_drop" : "conversion_within_threshold",
    context_json: {
      ...buildContextBase(rule, scope, now, windows),
      threshold_pct: params.threshold_pct,
      min_visits: params.min_visits,
      current: {
        visits: current.visits,
        purchases: current.purchases,
        conversion_rate: currentRate
      },
      baseline: {
        visits: baseline.visits,
        purchases: baseline.purchases,
        conversion_rate: baselineRate
      },
      drop_ratio: dropRatio
    }
  };
};

const evaluateRevenueDropRule = (
  rule: AlertRuleRecord,
  scope: AlertRuleScope,
  params: NormalizedRuleParams,
  now: Date,
  windows: { current: RuleWindow; baseline: RuleWindow },
  current: AggregatedMetrics,
  baseline: AggregatedMetrics
): AlertEvaluationResult => {
  const currentAvgDaily = current.net_revenue_eur / params.lookback_days;
  const baselineAvgDaily = baseline.net_revenue_eur / params.baseline_days;
  const dropRatio = baselineAvgDaily > 0 ? 1 - currentAvgDaily / baselineAvgDaily : 0;

  const triggered =
    baselineAvgDaily >= params.min_revenue_eur &&
    baselineAvgDaily > 0 &&
    dropRatio >= params.threshold_pct;

  const severity: AlertInstanceSeverity = triggered
    ? dropRatio >= params.threshold_pct * 1.5
      ? "critical"
      : "warn"
    : "info";

  return {
    triggered,
    severity,
    reason: triggered ? "revenue_drop" : "revenue_within_threshold",
    context_json: {
      ...buildContextBase(rule, scope, now, windows),
      threshold_pct: params.threshold_pct,
      min_revenue_eur: params.min_revenue_eur,
      current: {
        net_revenue_eur: current.net_revenue_eur,
        avg_daily_net_revenue_eur: currentAvgDaily
      },
      baseline: {
        net_revenue_eur: baseline.net_revenue_eur,
        avg_daily_net_revenue_eur: baselineAvgDaily
      },
      drop_ratio: dropRatio
    }
  };
};

const evaluateRefundSpikeRule = (
  rule: AlertRuleRecord,
  scope: AlertRuleScope,
  params: NormalizedRuleParams,
  now: Date,
  windows: { current: RuleWindow; baseline: RuleWindow },
  current: AggregatedMetrics,
  baseline: AggregatedMetrics
): AlertEvaluationResult => {
  const currentRate = safeRatio(current.refunds_eur, current.gross_revenue_eur);
  const baselineRate = safeRatio(baseline.refunds_eur, baseline.gross_revenue_eur);

  const exceedsRelativeThreshold =
    baselineRate <= 0 || currentRate >= baselineRate * Math.max(params.multiplier, 1);

  const triggered =
    current.purchases >= params.min_purchases &&
    currentRate >= params.threshold_rate &&
    exceedsRelativeThreshold;

  const severity: AlertInstanceSeverity = triggered
    ? currentRate >= params.threshold_rate * 2
      ? "critical"
      : "warn"
    : "info";

  return {
    triggered,
    severity,
    reason: triggered ? "refund_spike" : "refund_rate_within_threshold",
    context_json: {
      ...buildContextBase(rule, scope, now, windows),
      threshold_rate: params.threshold_rate,
      relative_multiplier: params.multiplier,
      min_purchases: params.min_purchases,
      current: {
        purchases: current.purchases,
        gross_revenue_eur: current.gross_revenue_eur,
        refunds_eur: current.refunds_eur,
        refund_rate: currentRate
      },
      baseline: {
        purchases: baseline.purchases,
        gross_revenue_eur: baseline.gross_revenue_eur,
        refunds_eur: baseline.refunds_eur,
        refund_rate: baselineRate
      }
    }
  };
};

const evaluateTrafficSpikeRule = (
  rule: AlertRuleRecord,
  scope: AlertRuleScope,
  params: NormalizedRuleParams,
  now: Date,
  windows: { current: RuleWindow; baseline: RuleWindow },
  current: AggregatedMetrics,
  baseline: AggregatedMetrics
): AlertEvaluationResult => {
  const currentAvgDailyVisits = current.visits / params.lookback_days;
  const baselineAvgDailyVisits = baseline.visits / params.baseline_days;
  const spikeMultiplier =
    baselineAvgDailyVisits > 0 ? currentAvgDailyVisits / baselineAvgDailyVisits : 0;

  const triggered =
    baselineAvgDailyVisits >= params.min_visits && spikeMultiplier >= params.multiplier;

  const severity: AlertInstanceSeverity = triggered
    ? spikeMultiplier >= params.multiplier * 1.75
      ? "critical"
      : "warn"
    : "info";

  return {
    triggered,
    severity,
    reason: triggered ? "traffic_spike" : "traffic_within_threshold",
    context_json: {
      ...buildContextBase(rule, scope, now, windows),
      multiplier: params.multiplier,
      min_visits: params.min_visits,
      current: {
        visits: current.visits,
        avg_daily_visits: currentAvgDailyVisits
      },
      baseline: {
        visits: baseline.visits,
        avg_daily_visits: baselineAvgDailyVisits
      },
      spike_multiplier: spikeMultiplier
    }
  };
};

export const evaluateAlertRule = async (
  provider: AlertsProvider,
  rule: AlertRuleRecord,
  now: Date = new Date()
): Promise<AlertEvaluationResult> => {
  const scope = normalizeRuleScope(rule.scope_json);
  const params = normalizeRuleParams(rule.rule_type, rule.params_json);

  if (rule.rule_type === "data_freshness_fail") {
    return evaluateDataFreshnessRule(provider, rule, scope, params, now);
  }

  const windows = windowForRule(now, params.lookback_days, params.baseline_days);
  const rows = await provider.getDailyMetrics({
    scope,
    start_date: windows.baseline.start,
    end_date: windows.current.end
  });

  const normalizedRows = rows.map((row) => ({
    date: row.date,
    visits: row.visits,
    purchases: row.purchases,
    gross_revenue_eur: row.gross_revenue_eur,
    refunds_eur: row.refunds_eur,
    net_revenue_eur: row.net_revenue_eur
  }));

  const current = sumMetricsInWindow(normalizedRows, windows.current);
  const baseline = sumMetricsInWindow(normalizedRows, windows.baseline);

  switch (rule.rule_type) {
    case "conversion_drop":
      return evaluateConversionDropRule(rule, scope, params, now, windows, current, baseline);
    case "revenue_drop":
      return evaluateRevenueDropRule(rule, scope, params, now, windows, current, baseline);
    case "refund_spike":
      return evaluateRefundSpikeRule(rule, scope, params, now, windows, current, baseline);
    case "traffic_spike":
      return evaluateTrafficSpikeRule(rule, scope, params, now, windows, current, baseline);
    default:
      return {
        triggered: false,
        severity: "info",
        reason: "unsupported_rule_type",
        context_json: {
          tenant_id: scope.tenant_id,
          content_type: scope.content_type,
          content_key: scope.content_key,
          rule_id: rule.id,
          rule_name: rule.name,
          rule_type: rule.rule_type,
          evaluated_at_utc: now.toISOString()
        }
      };
  }
};

export const runAlertRules = async (
  input: RunAlertRulesInput = {}
): Promise<RunAlertRulesResult> => {
  const now = input.now ?? new Date();
  const dryRun = Boolean(input.dry_run);
  const ruleId = normalizeNonEmptyString(input.rule_id);
  const provider = input.provider ?? getAlertsProvider();

  const rules = await listAlertRules({
    enabled_only: !ruleId,
    rule_id: ruleId
  });

  const results: EvaluatedAlertRule[] = [];
  let triggeredCount = 0;
  let insertedCount = 0;

  for (const rule of rules) {
    const evaluation = await evaluateAlertRule(provider, rule, now);
    const params = normalizeRuleParams(rule.rule_type, rule.params_json);
    let inserted = false;
    let fingerprint: string | null = null;

    if (evaluation.triggered) {
      triggeredCount += 1;
      fingerprint = createFingerprint(
        rule.id,
        normalizeRuleScope(rule.scope_json),
        now,
        params.dedupe_window_hours
      );

      if (!dryRun) {
        const insertion = await insertAlertInstance({
          rule_id: rule.id,
          status: "open",
          severity: evaluation.severity,
          fired_at: now.toISOString(),
          context_json: evaluation.context_json,
          fingerprint
        });

        inserted = insertion.inserted;
        if (inserted) {
          insertedCount += 1;
        }
      }
    }

    results.push({
      rule_id: rule.id,
      rule_name: rule.name,
      rule_type: rule.rule_type,
      triggered: evaluation.triggered,
      severity: evaluation.severity,
      reason: evaluation.reason,
      fingerprint,
      inserted,
      context_json: evaluation.context_json
    });
  }

  return {
    rule_id: ruleId,
    dry_run: dryRun,
    evaluated: rules.length,
    triggered: triggeredCount,
    inserted: insertedCount,
    results
  };
};

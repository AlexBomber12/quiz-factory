import { createHash } from "crypto";

import { createStructuredJsonResponse } from "../llm/openai_client";

import type { AlertInstanceWithRuleRecord } from "./types";
import { normalizeString } from "@/lib/utils/strings";

export const ALERT_INSIGHT_SCHEMA_NAME = "alert_insight_v1";
const MAX_OUTPUT_TOKENS = 1_400;

const RISK_LEVELS = ["low", "medium", "high"] as const;
const RISK_LEVEL_SET = new Set<string>(RISK_LEVELS);

type RuleWindow = {
  start: string;
  end: string;
};

export type AlertInsightRiskLevel = (typeof RISK_LEVELS)[number];

export type AlertInsightAction = {
  title: string;
  steps: string[];
  expected_effect: string;
  risk_level: AlertInsightRiskLevel;
};

export type AlertInsightPayload = {
  summary: string;
  root_cause_hypotheses: string[];
  actions: AlertInsightAction[];
};

export type AlertInsightPrompt = {
  system: string;
  user: string;
  prompt_hash: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);


const hasForbiddenKey = (key: string): boolean => {
  return /(email|phone|name|person|customer|token|session|distinct|ip|address|street)/i.test(key);
};

const sanitizeString = (value: string): string => {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length === 0) {
    return "";
  }

  const noUrls = compact.replace(/https?:\/\/\S+/gi, "[redacted-link]");
  const noEmails = noUrls.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]");
  return noEmails.slice(0, 280);
};

const sanitizeJsonValue = (value: unknown, depth = 0): unknown => {
  if (depth > 6) {
    return null;
  }

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeJsonValue(item, depth + 1));
  }

  if (!isRecord(value)) {
    return null;
  }

  const output: Record<string, unknown> = {};
  const keys = Object.keys(value).sort((left, right) => left.localeCompare(right));
  for (const key of keys) {
    if (hasForbiddenKey(key)) {
      continue;
    }
    output[key] = sanitizeJsonValue(value[key], depth + 1);
  }
  return output;
};

const readNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const readRuleWindow = (value: unknown): RuleWindow | null => {
  if (!isRecord(value)) {
    return null;
  }
  const start = normalizeString(value.start);
  const end = normalizeString(value.end);
  if (!start || !end) {
    return null;
  }
  return { start, end };
};

const extractThresholds = (
  context: Record<string, unknown>,
  params: Record<string, unknown>
): Record<string, unknown> => {
  const output: Record<string, unknown> = {};
  const keys = [
    "lookback_days",
    "baseline_days",
    "threshold_pct",
    "threshold_rate",
    "multiplier",
    "min_visits",
    "min_purchases",
    "min_revenue_eur",
    "freshness_minutes"
  ];

  for (const key of keys) {
    const contextValue = readNumber(context[key]);
    if (contextValue !== null) {
      output[key] = contextValue;
      continue;
    }

    const paramsValue = readNumber(params[key]);
    if (paramsValue !== null) {
      output[key] = paramsValue;
    }
  }

  return output;
};

const extractMetricsSnapshot = (context: Record<string, unknown>): Record<string, unknown> => {
  const current = isRecord(context.current) ? sanitizeJsonValue(context.current) : null;
  const baseline = isRecord(context.baseline) ? sanitizeJsonValue(context.baseline) : null;
  const metrics: Record<string, unknown> = {
    current,
    baseline
  };

  const keys = [
    "drop_ratio",
    "spike_multiplier",
    "analytics_lag_minutes",
    "revenue_lag_minutes",
    "analytics_last_event_at",
    "revenue_last_event_at"
  ];

  for (const key of keys) {
    if (key in context) {
      metrics[key] = sanitizeJsonValue(context[key]);
    }
  }

  return metrics;
};

const buildPromptInput = (instance: AlertInstanceWithRuleRecord): Record<string, unknown> => {
  const context = sanitizeJsonValue(instance.context_json);
  const params = sanitizeJsonValue(instance.params_json);
  const safeContext = isRecord(context) ? context : {};
  const safeParams = isRecord(params) ? params : {};

  return {
    alert_instance: {
      id: instance.id,
      fired_at: instance.fired_at,
      severity: instance.severity,
      status: instance.status
    },
    rule: {
      id: instance.rule_id,
      name: instance.rule_name,
      type: instance.rule_type,
      scope: sanitizeJsonValue(instance.scope_json),
      thresholds: extractThresholds(safeContext, safeParams),
      windows: {
        current: readRuleWindow(safeContext.current_window),
        baseline: readRuleWindow(safeContext.baseline_window)
      }
    },
    metrics_snapshot: extractMetricsSnapshot(safeContext),
    constraints: {
      pii: "never include personal data, direct identifiers, or user-entered text",
      links: "do not require external links",
      output: "prioritize concise, operationally actionable recommendations"
    }
  };
};

const createPromptHash = (model: string, system: string, user: string): string => {
  return createHash("sha256").update(model).update("\n").update(system).update("\n").update(user).digest("hex");
};

const hasUnsafeOutputText = (value: string): boolean => {
  if (/https?:\/\//i.test(value)) {
    return true;
  }
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value)) {
    return true;
  }
  return false;
};

const normalizeOutputText = (value: unknown, fieldName: string, maxLength: number): string => {
  const normalized = normalizeString(value);
  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  if (hasUnsafeOutputText(normalized)) {
    throw new Error(`${fieldName} contains forbidden content.`);
  }

  const safe = sanitizeString(normalized);
  if (!safe || safe === "[redacted-link]" || safe === "[redacted-email]") {
    throw new Error(`${fieldName} is invalid.`);
  }

  return safe.slice(0, maxLength);
};

export const ALERT_INSIGHT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "root_cause_hypotheses", "actions"],
  properties: {
    summary: { type: "string" },
    root_cause_hypotheses: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: { type: "string" }
    },
    actions: {
      type: "array",
      minItems: 3,
      maxItems: 7,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "steps", "expected_effect", "risk_level"],
        properties: {
          title: { type: "string" },
          steps: {
            type: "array",
            minItems: 1,
            maxItems: 5,
            items: { type: "string" }
          },
          expected_effect: { type: "string" },
          risk_level: {
            type: "string",
            enum: [...RISK_LEVELS]
          }
        }
      }
    }
  }
} as const;

export const normalizeAlertInsightPayload = (value: unknown): AlertInsightPayload => {
  if (!isRecord(value)) {
    throw new Error("Alert insight payload is invalid.");
  }

  const summary = normalizeOutputText(value.summary, "summary", 500);

  if (!Array.isArray(value.root_cause_hypotheses) || value.root_cause_hypotheses.length === 0) {
    throw new Error("root_cause_hypotheses is required.");
  }

  const rootCauseHypotheses = value.root_cause_hypotheses
    .slice(0, 5)
    .map((item, index) => normalizeOutputText(item, `root_cause_hypotheses[${index}]`, 220));

  if (!Array.isArray(value.actions) || value.actions.length < 3 || value.actions.length > 7) {
    throw new Error("actions must include 3-7 items.");
  }

  const actions: AlertInsightAction[] = value.actions.map((candidate, index) => {
    if (!isRecord(candidate)) {
      throw new Error(`actions[${index}] is invalid.`);
    }

    const title = normalizeOutputText(candidate.title, `actions[${index}].title`, 160);
    const expectedEffect = normalizeOutputText(
      candidate.expected_effect,
      `actions[${index}].expected_effect`,
      240
    );
    const riskLevel = normalizeString(candidate.risk_level)?.toLowerCase();
    if (!riskLevel || !RISK_LEVEL_SET.has(riskLevel)) {
      throw new Error(`actions[${index}].risk_level is invalid.`);
    }

    if (!Array.isArray(candidate.steps) || candidate.steps.length === 0) {
      throw new Error(`actions[${index}].steps is required.`);
    }

    const steps = candidate.steps
      .slice(0, 5)
      .map((step, stepIndex) => normalizeOutputText(step, `actions[${index}].steps[${stepIndex}]`, 220));

    return {
      title,
      steps,
      expected_effect: expectedEffect,
      risk_level: riskLevel as AlertInsightRiskLevel
    };
  });

  return {
    summary,
    root_cause_hypotheses: rootCauseHypotheses,
    actions
  };
};

export const buildAlertInsightPrompt = (input: {
  instance: AlertInstanceWithRuleRecord;
  model: string;
}): AlertInsightPrompt => {
  const model = normalizeString(input.model);
  if (!model) {
    throw new Error("model is required.");
  }

  const promptInput = buildPromptInput(input.instance);

  const system = [
    "You are an operations analyst for alerts in a quiz SaaS platform.",
    "Explain why the alert fired and recommend practical follow-up actions.",
    "Do not include PII, direct identifiers, user-entered text, or external links.",
    "Use only the provided structured input.",
    `Return JSON that matches schema ${ALERT_INSIGHT_SCHEMA_NAME}.`,
    "Keep output concise and concrete."
  ].join("\n");

  const user = [
    "Analyze this alert instance and return structured output.",
    `schema_name: ${ALERT_INSIGHT_SCHEMA_NAME}`,
    "alert_input_json:",
    JSON.stringify(promptInput, null, 2)
  ].join("\n");

  return {
    system,
    user,
    prompt_hash: createPromptHash(model, system, user)
  };
};

export const buildAlertInsightMarkdown = (payload: AlertInsightPayload): string => {
  const lines = [
    "### Why this alert fired",
    payload.summary,
    "",
    "### Root-cause hypotheses",
    ...payload.root_cause_hypotheses.map((item) => `- ${item}`)
  ];
  return lines.join("\n");
};

export const generateAlertInsightFromPrompt = async (input: {
  model: string;
  prompt: AlertInsightPrompt;
}): Promise<AlertInsightPayload> => {
  const model = normalizeString(input.model);
  if (!model) {
    throw new Error("model is required.");
  }

  const parsed = await createStructuredJsonResponse<unknown>({
    model,
    system: input.prompt.system,
    user: input.prompt.user,
    schemaName: ALERT_INSIGHT_SCHEMA_NAME,
    schema: ALERT_INSIGHT_SCHEMA as unknown as Record<string, unknown>,
    maxOutputTokens: MAX_OUTPUT_TOKENS
  });

  return normalizeAlertInsightPayload(parsed);
};

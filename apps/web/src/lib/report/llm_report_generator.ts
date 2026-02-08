import { createStructuredJsonResponse } from "../llm/openai_client";

import { buildLlmPrompt } from "./llm_prompt";
import { LLM_REPORT_SCHEMA, LLM_REPORT_SCHEMA_NAME } from "./llm_report_schema";
import type { ReportBrief } from "./report_brief";

const DEFAULT_MAX_OUTPUT_TOKENS = 1_600;

type LlmReportSummary = {
  headline: string;
  bullets: string[];
};

type LlmReportSection = {
  id: string;
  title: string;
  body: string;
  bullets: string[];
};

type LlmReportActionPlanItem = {
  title: string;
  steps: string[];
};

export type LlmReportJson = {
  report_title: string;
  summary: LlmReportSummary;
  sections: LlmReportSection[];
  action_plan: LlmReportActionPlanItem[];
  disclaimers: string[];
};

type GenerateLlmReportInput = {
  brief: ReportBrief;
  styleId: string;
  model: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const hasOnlyKeys = (value: Record<string, unknown>, expected: string[]): boolean => {
  const keys = Object.keys(value);
  return (
    keys.length === expected.length &&
    expected.every((key) => Object.prototype.hasOwnProperty.call(value, key)) &&
    keys.every((key) => expected.includes(key))
  );
};

const isLlmReportSummary = (value: unknown): value is LlmReportSummary => {
  if (!isRecord(value)) {
    return false;
  }

  if (!hasOnlyKeys(value, ["headline", "bullets"])) {
    return false;
  }

  return typeof value.headline === "string" && isStringArray(value.bullets);
};

const isLlmReportSection = (value: unknown): value is LlmReportSection => {
  if (!isRecord(value)) {
    return false;
  }

  if (!hasOnlyKeys(value, ["id", "title", "body", "bullets"])) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.body === "string" &&
    isStringArray(value.bullets)
  );
};

const isLlmReportActionPlanItem = (value: unknown): value is LlmReportActionPlanItem => {
  if (!isRecord(value)) {
    return false;
  }

  if (!hasOnlyKeys(value, ["title", "steps"])) {
    return false;
  }

  return typeof value.title === "string" && isStringArray(value.steps);
};

const isLlmReportJson = (value: unknown): value is LlmReportJson => {
  if (!isRecord(value)) {
    return false;
  }

  if (!hasOnlyKeys(value, ["report_title", "summary", "sections", "action_plan", "disclaimers"])) {
    return false;
  }

  if (typeof value.report_title !== "string" || !isLlmReportSummary(value.summary)) {
    return false;
  }

  if (!Array.isArray(value.sections) || !value.sections.every((section) => isLlmReportSection(section))) {
    return false;
  }

  if (
    !Array.isArray(value.action_plan) ||
    !value.action_plan.every((item) => isLlmReportActionPlanItem(item))
  ) {
    return false;
  }

  return isStringArray(value.disclaimers);
};

export const generateLlmReport = async ({
  brief,
  styleId,
  model
}: GenerateLlmReportInput): Promise<LlmReportJson> => {
  const prompt = buildLlmPrompt({
    brief,
    style_id: styleId
  });

  const parsed = await createStructuredJsonResponse<unknown>({
    model,
    system: prompt.system,
    user: prompt.user,
    schemaName: LLM_REPORT_SCHEMA_NAME,
    schema: LLM_REPORT_SCHEMA as unknown as Record<string, unknown>,
    maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS
  });

  if (!isLlmReportJson(parsed)) {
    throw new Error("Structured report payload is invalid.");
  }

  return parsed;
};

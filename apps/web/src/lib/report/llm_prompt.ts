import type { ReportBrief } from "./report_brief";
import { LLM_REPORT_SCHEMA_NAME } from "./llm_report_schema";

type BuildLlmPromptInput = {
  brief: ReportBrief;
  style_id: string;
};

export type LlmPrompt = {
  system: string;
  user: string;
};

const normalizeStyleId = (value: string): string => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "neutral";
};

export const buildLlmPrompt = ({ brief, style_id }: BuildLlmPromptInput): LlmPrompt => {
  const styleId = normalizeStyleId(style_id);

  const system = [
    "You generate quiz result reports from structured input.",
    "Use the provided brief only.",
    "Do not invent user identity, history, or personal data.",
    "Do not use medical diagnosis, treatment, or clinical language.",
    `Respond in the same language as brief.locale (${brief.locale}).`,
    `Output must be valid JSON matching schema ${LLM_REPORT_SCHEMA_NAME}.`,
    "Keep writing concise, specific, and actionable.",
    `Apply style_id ${styleId}.`,
    "Return JSON only."
  ].join("\n");

  const user = [
    "Generate a report JSON object for this brief.",
    `schema_name: ${LLM_REPORT_SCHEMA_NAME}`,
    `test_id: ${brief.test_id}`,
    `locale: ${brief.locale}`,
    `style_id: ${styleId}`,
    "brief_json:",
    JSON.stringify(brief, null, 2)
  ].join("\n");

  return {
    system,
    user
  };
};

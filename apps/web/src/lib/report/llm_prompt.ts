import type { ReportBrief } from "./report_brief";
import { LLM_REPORT_SCHEMA_NAME } from "./llm_report_schema";
import { DEFAULT_STYLE_ID, STYLE_CARDS, type StyleCard } from "./style_cards";

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
  return trimmed.length > 0 ? trimmed.toLowerCase() : DEFAULT_STYLE_ID;
};

export const buildLlmPrompt = ({ brief, style_id }: BuildLlmPromptInput): LlmPrompt => {
  const styleId = normalizeStyleId(style_id);
  const fallbackStyleCard = STYLE_CARDS[DEFAULT_STYLE_ID];
  const styleCard: StyleCard = STYLE_CARDS[styleId] ?? fallbackStyleCard;

  const system = [
    "You generate quiz result reports from structured input.",
    "Use the provided brief only.",
    "Do not invent user identity, history, or personal data.",
    "Do not use medical diagnosis, treatment, or clinical language.",
    `Respond in the same language as brief.locale (${brief.locale}).`,
    `Output must be valid JSON matching schema ${LLM_REPORT_SCHEMA_NAME}.`,
    "Keep writing concise, specific, and actionable.",
    `Apply style_id ${styleCard.id}.`,
    `tone_guidance: ${styleCard.tone_guidance}`,
    `structure_guidance: ${styleCard.structure_guidance}`,
    "do_list:",
    ...styleCard.do_list.map((item) => `- ${item}`),
    "dont_list:",
    ...styleCard.dont_list.map((item) => `- ${item}`),
    "Return JSON only."
  ].join("\n");

  const user = [
    "Generate a report JSON object for this brief.",
    `schema_name: ${LLM_REPORT_SCHEMA_NAME}`,
    `test_id: ${brief.test_id}`,
    `locale: ${brief.locale}`,
    `style_id: ${styleCard.id}`,
    "brief_json:",
    JSON.stringify(brief, null, 2)
  ].join("\n");

  return {
    system,
    user
  };
};

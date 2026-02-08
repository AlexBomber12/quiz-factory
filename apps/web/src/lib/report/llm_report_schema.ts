export const LLM_REPORT_SCHEMA_NAME = "quiz_report_v1";
export const PROMPT_VERSION = "v1";

export const LLM_REPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["report_title", "summary", "sections", "action_plan", "disclaimers"],
  properties: {
    report_title: {
      type: "string"
    },
    summary: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "bullets"],
      properties: {
        headline: {
          type: "string"
        },
        bullets: {
          type: "array",
          items: {
            type: "string"
          }
        }
      }
    },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "body", "bullets"],
        properties: {
          id: {
            type: "string"
          },
          title: {
            type: "string"
          },
          body: {
            type: "string"
          },
          bullets: {
            type: "array",
            items: {
              type: "string"
            }
          }
        }
      }
    },
    action_plan: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "steps"],
        properties: {
          title: {
            type: "string"
          },
          steps: {
            type: "array",
            items: {
              type: "string"
            }
          }
        }
      }
    },
    disclaimers: {
      type: "array",
      items: {
        type: "string"
      }
    }
  }
} as const;

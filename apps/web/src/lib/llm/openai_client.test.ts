import { describe, expect, it } from "vitest";

import { extractOutputText } from "./openai_client";

describe("openai client", () => {
  it("concatenates output_text fragments in order", () => {
    const fixtureResponse = {
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              output_text: "{\"report_title\":\"Focus\""
            },
            {
              type: "reasoning",
              text: "hidden reasoning"
            }
          ]
        },
        {
          type: "message",
          content: [
            {
              type: "output_text",
              output_text: ",\"summary\":{\"headline\":\"Headline\"}}"
            }
          ]
        }
      ]
    };

    const outputText = extractOutputText(fixtureResponse);
    expect(outputText).toBe("{\"report_title\":\"Focus\",\"summary\":{\"headline\":\"Headline\"}}");
  });
});

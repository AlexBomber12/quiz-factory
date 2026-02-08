import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import GeneratedReport, { type GeneratedReportJson } from "./generated-report";

const fixture: GeneratedReportJson = {
  report_title: "Values Compass Report",
  summary: {
    headline: "You lead with grounded consistency.",
    bullets: ["You prioritize reliable commitments.", "You balance planning and flexibility."]
  },
  sections: [
    {
      id: "patterns",
      title: "Patterns in your decisions",
      body: "Your strongest responses favor clarity and practical momentum.",
      bullets: ["You prefer concrete next steps.", "You avoid unnecessary complexity."]
    }
  ],
  action_plan: [
    {
      title: "Try this week",
      steps: ["Set one clear priority per day.", "Review progress every evening."]
    }
  ],
  disclaimers: ["This report is educational and not clinical advice."]
};

describe("GeneratedReport", () => {
  it("renders summary, sections, and disclaimers", () => {
    const html = renderToStaticMarkup(<GeneratedReport reportJson={fixture} />);

    expect(html).toContain("You lead with grounded consistency.");
    expect(html).toContain("Patterns in your decisions");
    expect(html).toContain("This report is educational and not clinical advice.");
  });
});

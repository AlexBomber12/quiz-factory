import { describe, expect, it } from "vitest";

import {
  computeEstimatedMinutesFromQuestionCount,
  getEstimatedMinutes
} from "./estimated_minutes";

describe("estimated minutes helper", () => {
  it("uses spec estimated_minutes when present and valid", () => {
    expect(
      getEstimatedMinutes({
        estimated_minutes: 17,
        questions: [{ id: "q1" }]
      })
    ).toBe(17);
  });

  it("falls back to a deterministic value when estimated_minutes is missing", () => {
    expect(
      getEstimatedMinutes({
        questions: [{ id: "q1" }, { id: "q2" }, { id: "q3" }, { id: "q4" }]
      })
    ).toBe(2);
  });

  it("falls back when estimated_minutes is invalid", () => {
    expect(
      getEstimatedMinutes({
        estimated_minutes: 999,
        questions: [{ id: "q1" }, { id: "q2" }, { id: "q3" }, { id: "q4" }, { id: "q5" }]
      })
    ).toBe(3);
  });

  it("clamps computed values to the safe fallback range", () => {
    expect(computeEstimatedMinutesFromQuestionCount(0)).toBe(2);
    expect(computeEstimatedMinutesFromQuestionCount(200)).toBe(20);
  });
});

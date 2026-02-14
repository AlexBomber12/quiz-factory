import { describe, expect, it } from "vitest";

import {
  combineHealthStatus,
  evaluateFreshnessStatus,
  resolveFreshnessThresholds
} from "./data_health";

describe("evaluateFreshnessStatus", () => {
  it("returns ok when lag is below warn threshold", () => {
    const thresholds = resolveFreshnessThresholds("raw_stripe", "purchases");
    expect(evaluateFreshnessStatus(thresholds.warn_after_minutes - 1, thresholds)).toBe("ok");
  });

  it("returns warn when lag reaches warn threshold", () => {
    const thresholds = resolveFreshnessThresholds("raw_stripe", "purchases");
    expect(evaluateFreshnessStatus(thresholds.warn_after_minutes, thresholds)).toBe("warn");
  });

  it("returns error when lag reaches error threshold", () => {
    const thresholds = resolveFreshnessThresholds("raw_stripe", "purchases");
    expect(evaluateFreshnessStatus(thresholds.error_after_minutes, thresholds)).toBe("error");
  });

  it("returns error when lag is null", () => {
    const thresholds = resolveFreshnessThresholds("marts", "mart_funnel_daily");
    expect(evaluateFreshnessStatus(null, thresholds)).toBe("error");
  });
});

describe("combineHealthStatus", () => {
  it("prioritizes error over warn and ok", () => {
    expect(combineHealthStatus(["ok", "warn", "error"])).toBe("error");
  });

  it("returns warn when there are warnings and no errors", () => {
    expect(combineHealthStatus(["ok", "warn"])).toBe("warn");
  });

  it("returns ok when all statuses are ok", () => {
    expect(combineHealthStatus(["ok", "ok"])).toBe("ok");
  });
});

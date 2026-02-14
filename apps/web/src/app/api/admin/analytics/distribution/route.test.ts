import { describe, expect, it } from "vitest";

import { parseDistributionOptions } from "./route";

describe("parseDistributionOptions", () => {
  it("returns defaults when top_tenants/top_tests are omitted", () => {
    const parsed = parseDistributionOptions(new URLSearchParams());

    expect(parsed).toEqual({
      ok: true,
      value: {
        top_tenants: 20,
        top_tests: 20
      }
    });
  });

  it("accepts valid bounded integer overrides", () => {
    const parsed = parseDistributionOptions(
      new URLSearchParams({
        top_tenants: "50",
        top_tests: "7"
      })
    );

    expect(parsed).toEqual({
      ok: true,
      value: {
        top_tenants: 50,
        top_tests: 7
      }
    });
  });

  it("rejects non-integer and out-of-range values", () => {
    const parsed = parseDistributionOptions(
      new URLSearchParams({
        top_tenants: "3.2",
        top_tests: "51"
      })
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      return;
    }

    expect(parsed.errors).toEqual([
      {
        field: "top_tenants",
        message: "must be an integer between 1 and 50"
      },
      {
        field: "top_tests",
        message: "must be an integer between 1 and 50"
      }
    ]);
  });
});

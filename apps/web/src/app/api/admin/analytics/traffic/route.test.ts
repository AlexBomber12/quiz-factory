import { describe, expect, it } from "vitest";

import { parseTrafficOptions } from "./route";

describe("parseTrafficOptions", () => {
  it("returns default top_n when omitted", () => {
    const parsed = parseTrafficOptions(new URLSearchParams());

    expect(parsed).toEqual({
      ok: true,
      value: {
        top_n: 50
      }
    });
  });

  it("accepts valid bounded integer top_n", () => {
    const parsed = parseTrafficOptions(
      new URLSearchParams({
        top_n: "200"
      })
    );

    expect(parsed).toEqual({
      ok: true,
      value: {
        top_n: 200
      }
    });
  });

  it("rejects non-integer and out-of-range top_n", () => {
    const notInteger = parseTrafficOptions(
      new URLSearchParams({
        top_n: "3.5"
      })
    );
    const outOfRange = parseTrafficOptions(
      new URLSearchParams({
        top_n: "201"
      })
    );

    expect(notInteger.ok).toBe(false);
    if (!notInteger.ok) {
      expect(notInteger.errors).toEqual([
        {
          field: "top_n",
          message: "must be an integer between 1 and 200"
        }
      ]);
    }

    expect(outOfRange.ok).toBe(false);
    if (!outOfRange.ok) {
      expect(outOfRange.errors).toEqual([
        {
          field: "top_n",
          message: "must be an integer between 1 and 200"
        }
      ]);
    }
  });
});

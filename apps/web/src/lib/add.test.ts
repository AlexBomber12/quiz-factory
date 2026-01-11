import { describe, expect, it } from "vitest";

import { add } from "./add";

describe("add", () => {
  it("adds numbers", () => {
    expect(add(2, 2)).toBe(4);
  });
});

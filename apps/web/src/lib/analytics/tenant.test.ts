import { describe, expect, it } from "vitest";

import { resolveTenantId } from "./tenant";

describe("resolveTenantId", () => {
  it("creates tenant ids from hostnames", () => {
    expect(resolveTenantId("Quiz.Example.com")).toBe("tenant-quiz-example-com");
  });

  it("strips ports from hostnames", () => {
    expect(resolveTenantId("tenant.example.com:3000")).toBe(
      "tenant-tenant-example-com"
    );
  });

  it("handles missing hosts", () => {
    expect(resolveTenantId(null)).toBe("tenant-unknown");
  });
});

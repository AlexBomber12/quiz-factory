import { describe, expect, it } from "vitest";

import { loadTenantCatalog, resolveTenantTestBySlug } from "./catalog";

const TENANT_ID = "tenant-tenant-example-com";

describe("catalog loader", () => {
  it("returns tests for the example tenant", () => {
    const tests = loadTenantCatalog(TENANT_ID, "en");

    expect(tests.length).toBeGreaterThan(0);
    expect(tests[0]?.test_id).toBe("test-focus-rhythm");
    expect(tests[0]?.estimated_minutes).toBeTypeOf("number");
    expect(Number.isInteger(tests[0]?.estimated_minutes)).toBe(true);
  });

  it("throws when catalog metadata is missing", () => {
    expect(() =>
      loadTenantCatalog(TENANT_ID, "en", {
        catalog: {
          tenants: {
            [TENANT_ID]: ["test-missing-metadata"]
          }
        },
        testIndex: {
          tests: []
        }
      })
    ).toThrow(/Catalog metadata missing for test test-missing-metadata/);
  });

  it("resolves a test by slug with a non-empty title", () => {
    const test = resolveTenantTestBySlug(TENANT_ID, "en", "focus-rhythm");

    expect(test).not.toBeNull();
    expect(test?.title).toBeTypeOf("string");
    expect(test?.title.trim().length).toBeGreaterThan(0);
  });
});

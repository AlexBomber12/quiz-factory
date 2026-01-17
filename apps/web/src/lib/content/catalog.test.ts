import { describe, expect, it } from "vitest";

import { loadTenantCatalog, resolveTestIdBySlug } from "./catalog";

const TENANT_ID = "tenant-tenant-example-com";

describe("content catalog", () => {
  it("maps catalog entries to localized content", () => {
    const tests = loadTenantCatalog(TENANT_ID, "en");
    const focusRhythm = tests.find((test) => test.test_id === "test-focus-rhythm");

    expect(focusRhythm).toBeTruthy();
    expect(focusRhythm?.slug).toBe("focus-rhythm");
    expect(focusRhythm?.title).toBe("Focus Rhythm");
    expect(focusRhythm?.short_description).toBeTruthy();
  });

  it("resolves /t/[slug] loader test id", () => {
    const testId = resolveTestIdBySlug("focus-rhythm");

    expect(testId).toBe("test-focus-rhythm");
  });
});

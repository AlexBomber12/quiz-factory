import { describe, expect, it } from "vitest";

import {
  buildOgImagePath,
  resolveSeoTestContext,
  resolveTenantSeoContext
} from "./metadata";

const TENANT_ID = "tenant-tenant-example-com";
const TEST_ID = "test-focus-rhythm";

describe("seo metadata helpers", () => {
  it("produces stable lastmod values for the same inputs", () => {
    const first = resolveTenantSeoContext({ tenantId: TENANT_ID });
    const second = resolveTenantSeoContext({ tenantId: TENANT_ID });

    expect(first.lastmod).toBe(second.lastmod);
    expect(first.token).toBe(second.token);
  });

  it("updates tenant lastmod when the catalog changes", () => {
    const base = resolveTenantSeoContext({ tenantId: TENANT_ID });
    const changed = resolveTenantSeoContext({
      tenantId: TENANT_ID,
      catalog: {
        tenants: {
          [TENANT_ID]: [TEST_ID, "test-nonexistent"]
        }
      }
    });

    expect(base.lastmod).not.toBe(changed.lastmod);
    expect(base.token).not.toBe(changed.token);
  });

  it("updates test lastmod when the catalog changes", () => {
    const base = resolveSeoTestContext({ tenantId: TENANT_ID, testId: TEST_ID });
    const changed = resolveSeoTestContext({
      tenantId: TENANT_ID,
      testId: TEST_ID,
      catalog: {
        tenants: {
          [TENANT_ID]: [TEST_ID, "test-nonexistent"]
        }
      }
    });

    expect(base.lastmod).not.toBe(changed.lastmod);
    expect(base.token).not.toBe(changed.token);
  });

  it("adds a cache-busting token to OG image paths", () => {
    expect(buildOgImagePath("/t/focus-rhythm/opengraph-image", "token-123")).toBe(
      "/t/focus-rhythm/opengraph-image?v=token-123"
    );
  });
});


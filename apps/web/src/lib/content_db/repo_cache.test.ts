import { describe, expect, it } from "vitest";

import {
  buildPublishedTestCacheKey,
  buildTenantCatalogCacheKey,
  createContentRepoCache
} from "./repo_cache";

describe("content repository cache", () => {
  it("serves values until ttl expires", () => {
    let currentTime = 1_000;
    const cache = createContentRepoCache({
      ttlMs: 1_000,
      now: () => currentTime
    });
    const key = buildTenantCatalogCacheKey("tenant-example");

    cache.write({
      key,
      tenantId: "tenant-example",
      testIds: ["test-focus-rhythm"],
      value: { count: 1 }
    });

    expect(cache.read<{ count: number }>(key)).toEqual({ count: 1 });

    currentTime += 1_001;
    expect(cache.read<{ count: number }>(key)).toBeNull();
  });

  it("invalidates all keys for a tenant", () => {
    let currentTime = 0;
    const cache = createContentRepoCache({
      ttlMs: 60_000,
      now: () => currentTime
    });

    const tenantCatalogKey = buildTenantCatalogCacheKey("tenant-a");
    const tenantPublishedKey = buildPublishedTestCacheKey("tenant-a", "focus-rhythm", "en");
    const otherTenantKey = buildTenantCatalogCacheKey("tenant-b");

    cache.write({
      key: tenantCatalogKey,
      tenantId: "tenant-a",
      testIds: ["test-focus-rhythm"],
      value: ["catalog"]
    });
    cache.write({
      key: tenantPublishedKey,
      tenantId: "tenant-a",
      testIds: ["test-focus-rhythm"],
      value: { slug: "focus-rhythm" }
    });
    cache.write({
      key: otherTenantKey,
      tenantId: "tenant-b",
      testIds: ["test-other"],
      value: ["other"]
    });

    cache.invalidateTenant("tenant-a");

    expect(cache.read(tenantCatalogKey)).toBeNull();
    expect(cache.read(tenantPublishedKey)).toBeNull();
    expect(cache.read(otherTenantKey)).toEqual(["other"]);

    currentTime += 1;
    expect(cache.read(otherTenantKey)).toEqual(["other"]);
  });

  it("invalidates all keys linked to a test id", () => {
    const cache = createContentRepoCache({
      ttlMs: 60_000,
      now: () => 100
    });

    const catalogWithTargetTest = buildTenantCatalogCacheKey("tenant-a");
    const publishedWithTargetTest = buildPublishedTestCacheKey(
      "tenant-a",
      "focus-rhythm",
      "en"
    );
    const unaffectedKey = buildTenantCatalogCacheKey("tenant-b");

    cache.write({
      key: catalogWithTargetTest,
      tenantId: "tenant-a",
      testIds: ["test-focus-rhythm", "test-other"],
      value: ["tenant-a-catalog"]
    });
    cache.write({
      key: publishedWithTargetTest,
      tenantId: "tenant-a",
      testIds: ["test-focus-rhythm"],
      value: { test_id: "test-focus-rhythm" }
    });
    cache.write({
      key: unaffectedKey,
      tenantId: "tenant-b",
      testIds: ["test-unaffected"],
      value: ["tenant-b-catalog"]
    });

    cache.invalidateTest("test-focus-rhythm");

    expect(cache.read(catalogWithTargetTest)).toBeNull();
    expect(cache.read(publishedWithTargetTest)).toBeNull();
    expect(cache.read(unaffectedKey)).toEqual(["tenant-b-catalog"]);
  });
});

import { describe, expect, it } from "vitest";

import { createSitemapCache } from "./sitemap_cache";

describe("sitemap cache", () => {
  it("serves entries until ttl expires", () => {
    let currentTime = 1_000;
    const cache = createSitemapCache({
      ttlMs: 1_000,
      now: () => currentTime
    });

    cache.write("tenant-a", [{ url: "https://tenant.example.com/" }]);

    expect(cache.read<{ url: string }[]>("tenant-a")).toEqual([
      { url: "https://tenant.example.com/" }
    ]);

    currentTime += 1_001;
    expect(cache.read("tenant-a")).toBeNull();
  });

  it("invalidates tenant entries", () => {
    const cache = createSitemapCache({
      ttlMs: 60_000,
      now: () => 100
    });

    cache.write("tenant-a", [{ url: "https://tenant.example.com/" }]);
    cache.write("tenant-b", [{ url: "https://other.example.com/" }]);

    cache.invalidateTenant("tenant-a");

    expect(cache.read("tenant-a")).toBeNull();
    expect(cache.read<{ url: string }[]>("tenant-b")).toEqual([
      { url: "https://other.example.com/" }
    ]);
  });
});

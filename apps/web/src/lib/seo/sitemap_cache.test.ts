import { describe, expect, it } from "vitest";

import { createSitemapCache } from "./sitemap_cache";

describe("sitemap cache", () => {
  it("serves entries until ttl expires", () => {
    let currentTime = 1_000;
    const cache = createSitemapCache({
      ttlMs: 1_000,
      now: () => currentTime
    });

    cache.write(
      {
        tenantId: "tenant-a",
        host: "tenant.example.com",
        requestHost: "tenant.example.com",
        protocol: "https"
      },
      [{ url: "https://tenant.example.com/" }]
    );

    expect(
      cache.read<{ url: string }[]>({
        tenantId: "tenant-a",
        host: "tenant.example.com",
        requestHost: "tenant.example.com",
        protocol: "https"
      })
    ).toEqual([{ url: "https://tenant.example.com/" }]);

    currentTime += 1_001;
    expect(
      cache.read({
        tenantId: "tenant-a",
        host: "tenant.example.com",
        requestHost: "tenant.example.com",
        protocol: "https"
      })
    ).toBeNull();
  });

  it("invalidates tenant entries", () => {
    const cache = createSitemapCache({
      ttlMs: 60_000,
      now: () => 100
    });

    cache.write(
      {
        tenantId: "tenant-a",
        host: "tenant.example.com",
        requestHost: "tenant.example.com",
        protocol: "https"
      },
      [{ url: "https://tenant.example.com/" }]
    );
    cache.write(
      {
        tenantId: "tenant-a",
        host: "localhost",
        requestHost: "localhost:3000",
        protocol: "http"
      },
      [{ url: "http://localhost:3000/" }]
    );
    cache.write(
      {
        tenantId: "tenant-b",
        host: "other.example.com",
        requestHost: "other.example.com",
        protocol: "https"
      },
      [{ url: "https://other.example.com/" }]
    );

    cache.invalidateTenant("tenant-a");

    expect(
      cache.read({
        tenantId: "tenant-a",
        host: "tenant.example.com",
        requestHost: "tenant.example.com",
        protocol: "https"
      })
    ).toBeNull();
    expect(
      cache.read({
        tenantId: "tenant-a",
        host: "localhost",
        requestHost: "localhost:3000",
        protocol: "http"
      })
    ).toBeNull();
    expect(
      cache.read<{ url: string }[]>({
        tenantId: "tenant-b",
        host: "other.example.com",
        requestHost: "other.example.com",
        protocol: "https"
      })
    ).toEqual([{ url: "https://other.example.com/" }]);
  });
});

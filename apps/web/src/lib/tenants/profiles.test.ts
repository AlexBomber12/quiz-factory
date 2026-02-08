import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getTenantProfile,
  resolveHomepageCopy,
  resolveTenantKind
} from "./profiles";

let fixtureDir = "";

const writeProfilesFixture = async (data: unknown): Promise<string> => {
  const fixturePath = path.join(fixtureDir, "tenant_profiles.json");
  await fs.writeFile(fixturePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
  return fixturePath;
};

beforeEach(async () => {
  fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), "tenant-profiles-"));
});

afterEach(async () => {
  if (fixtureDir) {
    await fs.rm(fixtureDir, { recursive: true, force: true });
  }

  fixtureDir = "";
});

describe("tenant profiles loader", () => {
  it("returns null for unknown tenants and defaults kind to hub", async () => {
    const filePath = await writeProfilesFixture({
      profiles: [
        {
          tenant_id: "tenant-known",
          tenant_kind: "hub",
          label: "Known Tenant",
          home_headline: "Known headline",
          home_subheadline: "Known subheadline",
          featured_test_slugs: ["focus-rhythm"]
        }
      ]
    });

    expect(getTenantProfile("tenant-unknown", { filePath })).toBeNull();
    expect(resolveTenantKind("tenant-unknown", { filePath })).toBe("hub");
    expect(resolveHomepageCopy("tenant-unknown", { filePath })).toEqual({
      headline: "",
      subheadline: "Browse the available tests and start when ready."
    });
  });

  it("provides featured slugs for niche tenant filtering in profile order", async () => {
    const filePath = await writeProfilesFixture({
      profiles: [
        {
          tenant_id: "tenant-niche",
          tenant_kind: "niche",
          label: "Niche Tenant",
          home_headline: "Focused picks",
          home_subheadline: "Start with the recommended tests.",
          featured_test_slugs: ["focus-rhythm", "universal-mini"]
        }
      ]
    });

    const profile = getTenantProfile("tenant-niche", { filePath });
    expect(profile).not.toBeNull();
    expect(resolveTenantKind("tenant-niche", { filePath })).toBe("niche");

    const catalogSlugs = ["universal-mini", "focus-rhythm", "other-test"];
    const filteredSlugs = (profile?.featured_test_slugs ?? [])
      .map((slug) => catalogSlugs.find((catalogSlug) => catalogSlug === slug))
      .filter((slug): slug is string => Boolean(slug));

    expect(filteredSlugs).toEqual(["focus-rhythm", "universal-mini"]);
  });

  it("returns cached values for the same file during the ttl window", async () => {
    const filePath = await writeProfilesFixture({
      profiles: [
        {
          tenant_id: "tenant-cache",
          tenant_kind: "hub",
          label: "Cache Tenant",
          home_headline: "Original headline",
          home_subheadline: "Original subheadline",
          featured_test_slugs: ["focus-rhythm"]
        }
      ]
    });

    const firstRead = getTenantProfile("tenant-cache", {
      filePath,
      now: () => 1_000
    });
    expect(firstRead?.home_headline).toBe("Original headline");

    await writeProfilesFixture({
      profiles: [
        {
          tenant_id: "tenant-cache",
          tenant_kind: "hub",
          label: "Cache Tenant",
          home_headline: "Updated headline",
          home_subheadline: "Updated subheadline",
          featured_test_slugs: ["focus-rhythm"]
        }
      ]
    });

    const cachedRead = getTenantProfile("tenant-cache", {
      filePath,
      now: () => 1_010
    });
    expect(cachedRead?.home_headline).toBe("Original headline");

    const refreshedRead = getTenantProfile("tenant-cache", {
      filePath,
      now: () => 61_005
    });
    expect(refreshedRead?.home_headline).toBe("Updated headline");
  });
});

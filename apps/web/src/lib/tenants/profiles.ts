import fs from "node:fs";
import path from "node:path";
import { logger } from "@/lib/logger";

export type TenantProfile = {
  tenant_id: string;
  tenant_kind: "hub" | "niche";
  label: string;
  home_headline: string;
  home_subheadline: string;
  featured_test_slugs: string[];
};

type TenantProfilesLoadOptions = {
  filePath?: string;
  now?: () => number;
};

type TenantProfilesCacheEntry = {
  profilesByTenant: Map<string, TenantProfile> | null;
  expiresAtMs: number;
};

type TenantProfilesDocument = {
  profiles?: unknown;
};

const TENANT_PROFILE_CACHE_TTL_MS = 60_000;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PROFILE_KEYS = [
  "tenant_id",
  "tenant_kind",
  "label",
  "home_headline",
  "home_subheadline",
  "featured_test_slugs"
] as const;
const PROFILE_KEY_SET = new Set<string>(PROFILE_KEYS);
const profileCache = new Map<string, TenantProfilesCacheEntry>();

let defaultProfilesPath: string | null = null;

const DEFAULT_HOMEPAGE_COPY = {
  headline: "",
  subheadline: "Browse the available tests and start when ready."
};

const normalizeTenantId = (value: string): string => {
  return value.trim().toLowerCase();
};

const resolveDefaultProfilesPath = (): string => {
  if (defaultProfilesPath) {
    return defaultProfilesPath;
  }

  const start = process.cwd();
  let current = start;

  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = path.join(current, "config", "tenant_profiles.json");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      defaultProfilesPath = candidate;
      return candidate;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }

    current = parent;
  }

  defaultProfilesPath = path.join(start, "config", "tenant_profiles.json");
  return defaultProfilesPath;
};

const resolveProfilesPath = (overridePath?: string): string => {
  if (overridePath) {
    return path.resolve(overridePath);
  }

  return resolveDefaultProfilesPath();
};

const parseSlugList = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const slugs: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      return null;
    }

    const normalized = entry.trim().toLowerCase();
    if (entry !== normalized || !SLUG_PATTERN.test(normalized)) {
      return null;
    }

    slugs.push(normalized);
  }

  return slugs;
};

const parseProfile = (value: unknown): TenantProfile | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== PROFILE_KEYS.length) {
    return null;
  }

  for (const key of keys) {
    if (!PROFILE_KEY_SET.has(key)) {
      return null;
    }
  }

  const tenantId = typeof record.tenant_id === "string" ? record.tenant_id.trim() : "";
  const tenantKind = record.tenant_kind;
  const label = typeof record.label === "string" ? record.label.trim() : "";
  const homeHeadline =
    typeof record.home_headline === "string" ? record.home_headline.trim() : "";
  const homeSubheadline =
    typeof record.home_subheadline === "string"
      ? record.home_subheadline.trim()
      : "";
  const featuredTestSlugs = parseSlugList(record.featured_test_slugs);

  if (
    !tenantId ||
    !label ||
    !homeHeadline ||
    !homeSubheadline ||
    featuredTestSlugs === null
  ) {
    return null;
  }

  if (tenantKind !== "hub" && tenantKind !== "niche") {
    return null;
  }

  return {
    tenant_id: tenantId,
    tenant_kind: tenantKind,
    label,
    home_headline: homeHeadline,
    home_subheadline: homeSubheadline,
    featured_test_slugs: featuredTestSlugs
  };
};

const parseProfilesDocument = (rawText: string): Map<string, TenantProfile> | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    logger.warn({ error }, "lib/tenants/profiles.ts fallback handling failed");
    return null;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const profiles = (parsed as TenantProfilesDocument).profiles;
  if (!Array.isArray(profiles)) {
    return null;
  }

  const profilesByTenant = new Map<string, TenantProfile>();
  for (const entry of profiles) {
    const profile = parseProfile(entry);
    if (!profile) {
      return null;
    }

    const normalizedTenantId = normalizeTenantId(profile.tenant_id);
    if (!normalizedTenantId || profilesByTenant.has(normalizedTenantId)) {
      return null;
    }

    profilesByTenant.set(normalizedTenantId, profile);
  }

  return profilesByTenant;
};

const loadProfiles = (
  options: TenantProfilesLoadOptions = {}
): Map<string, TenantProfile> | null => {
  const now = options.now ?? Date.now;
  const profilesPath = resolveProfilesPath(options.filePath);

  const cached = profileCache.get(profilesPath);
  if (cached && cached.expiresAtMs > now()) {
    return cached.profilesByTenant;
  }

  let profilesByTenant: Map<string, TenantProfile> | null = null;
  if (fs.existsSync(profilesPath)) {
    try {
      const rawText = fs.readFileSync(profilesPath, "utf-8");
      profilesByTenant = parseProfilesDocument(rawText);
    } catch (error) {
      logger.warn({ error }, "lib/tenants/profiles.ts fallback handling failed");
      profilesByTenant = null;
    }
  }

  profileCache.set(profilesPath, {
    profilesByTenant,
    expiresAtMs: now() + TENANT_PROFILE_CACHE_TTL_MS
  });

  return profilesByTenant;
};

const cloneProfile = (profile: TenantProfile): TenantProfile => {
  return {
    ...profile,
    featured_test_slugs: [...profile.featured_test_slugs]
  };
};

export const getTenantProfile = (
  tenantId: string,
  options: TenantProfilesLoadOptions = {}
): TenantProfile | null => {
  const normalizedTenantId = normalizeTenantId(tenantId);
  if (!normalizedTenantId) {
    return null;
  }

  const profilesByTenant = loadProfiles(options);
  if (!profilesByTenant) {
    return null;
  }

  const profile = profilesByTenant.get(normalizedTenantId);
  if (!profile) {
    return null;
  }

  return cloneProfile(profile);
};

export const resolveTenantKind = (
  tenantId: string,
  options: TenantProfilesLoadOptions = {}
): "hub" | "niche" => {
  return getTenantProfile(tenantId, options)?.tenant_kind ?? "hub";
};

export const resolveHomepageCopy = (
  tenantId: string,
  options: TenantProfilesLoadOptions = {}
): { headline: string; subheadline: string } => {
  const profile = getTenantProfile(tenantId, options);
  if (!profile) {
    return { ...DEFAULT_HOMEPAGE_COPY };
  }

  return {
    headline: profile.home_headline,
    subheadline: profile.home_subheadline
  };
};

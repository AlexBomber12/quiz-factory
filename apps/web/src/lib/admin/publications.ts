import tenantsConfig from "../../../../../config/tenants.json";

import { getContentDbPool } from "../content_db/pool";

type TimestampValue = Date | string;

type TenantRegistryEntryRaw = {
  tenant_id: string;
  domains?: string[];
};

type TenantRegistryRaw = {
  tenants?: TenantRegistryEntryRaw[];
};

type PublicationStateRow = {
  tenant_id: string | null;
  test_id: string | null;
  slug: string | null;
  published_version_id: string | null;
  is_enabled: boolean | null;
  updated_at: TimestampValue | null;
};

type PublicationState = {
  published_version_id: string | null;
  is_enabled: boolean;
  updated_at: string | null;
};

type PublicationTest = {
  test_id: string;
  slug: string;
};

export type AdminPublicationRow = {
  tenant_id: string;
  domains: string[];
  test_id: string;
  slug: string;
  published_version_id: string | null;
  is_enabled: boolean;
  updated_at: string | null;
};

export type ListAdminPublicationsFilters = {
  q?: string | null;
  tenant_id?: string | null;
  test_id?: string | null;
  only_published?: boolean | null;
  only_enabled?: boolean | null;
};

const MAX_FILTER_TEXT_LENGTH = 120;
const TRUE_BOOLEAN_VALUES = new Set(["1", "true", "yes", "on"]);

const normalizeNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeFilterText = (value: unknown): string | null => {
  const normalized = normalizeNonEmptyString(value);
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, MAX_FILTER_TEXT_LENGTH);
};

const normalizeBooleanFilter = (value: unknown): boolean => {
  if (value === true) {
    return true;
  }

  if (typeof value !== "string") {
    return false;
  }

  return TRUE_BOOLEAN_VALUES.has(value.trim().toLowerCase());
};

const toIsoString = (value: TimestampValue | null): string | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
};

const tenantRegistry = ((tenantsConfig as TenantRegistryRaw).tenants ?? [])
  .map((entry) => {
    const tenantId = normalizeNonEmptyString(entry.tenant_id);
    if (!tenantId) {
      return null;
    }

    const domains = Array.isArray(entry.domains)
      ? entry.domains
          .map((domain) => normalizeNonEmptyString(domain))
          .filter((domain): domain is string => domain !== null)
      : [];

    return {
      tenant_id: tenantId,
      domains
    };
  })
  .filter((entry): entry is { tenant_id: string; domains: string[] } => entry !== null)
  .sort((left, right) => left.tenant_id.localeCompare(right.tenant_id));

const knownTenantIds = new Set<string>(tenantRegistry.map((tenant) => tenant.tenant_id));

const buildPublicationKey = (tenantId: string, testId: string): string => {
  return `${tenantId}::${testId}`;
};

const buildTenantDomainsById = (): Map<string, string[]> => {
  const domainsById = new Map<string, string[]>();
  for (const tenant of tenantRegistry) {
    domainsById.set(tenant.tenant_id, [...tenant.domains]);
  }
  return domainsById;
};

const matchesQuery = (row: AdminPublicationRow, queryText: string): boolean => {
  const normalizedQuery = queryText.toLowerCase();

  if (row.tenant_id.toLowerCase().includes(normalizedQuery)) {
    return true;
  }
  if (row.test_id.toLowerCase().includes(normalizedQuery)) {
    return true;
  }
  if (row.slug.toLowerCase().includes(normalizedQuery)) {
    return true;
  }

  return row.domains.some((domain) => domain.toLowerCase().includes(normalizedQuery));
};

const comparePublicationRows = (left: AdminPublicationRow, right: AdminPublicationRow): number => {
  const tenantCompare = left.tenant_id.localeCompare(right.tenant_id);
  if (tenantCompare !== 0) {
    return tenantCompare;
  }

  const slugCompare = left.slug.localeCompare(right.slug);
  if (slugCompare !== 0) {
    return slugCompare;
  }

  return left.test_id.localeCompare(right.test_id);
};

export const listAdminPublications = async (
  filters?: ListAdminPublicationsFilters
): Promise<AdminPublicationRow[]> => {
  const queryText = normalizeFilterText(filters?.q);
  const tenantFilter = normalizeFilterText(filters?.tenant_id);
  const testFilter = normalizeFilterText(filters?.test_id);
  const onlyPublished = normalizeBooleanFilter(filters?.only_published);
  const onlyEnabled = normalizeBooleanFilter(filters?.only_enabled);

  const pool = getContentDbPool();
  let rows: PublicationStateRow[];

  try {
    const result = await pool.query<PublicationStateRow>(
      `
        SELECT
          tt.tenant_id,
          t.test_id,
          t.slug,
          tt.published_version_id,
          tt.is_enabled,
          tt.published_at AS updated_at
        FROM tests t
        LEFT JOIN tenant_tests tt
          ON tt.test_id = t.id
        ORDER BY t.slug ASC, t.test_id ASC, tt.tenant_id ASC
      `
    );
    rows = result.rows;
  } catch {
    throw new Error("Unable to load publications.");
  }

  const testsById = new Map<string, PublicationTest>();
  const stateByPublication = new Map<string, PublicationState>();
  const tenantIds = new Set<string>(knownTenantIds);

  for (const row of rows) {
    const testId = normalizeNonEmptyString(row.test_id);
    const slug = normalizeNonEmptyString(row.slug);
    if (testId && slug && !testsById.has(testId)) {
      testsById.set(testId, {
        test_id: testId,
        slug
      });
    }

    const tenantId = normalizeNonEmptyString(row.tenant_id);
    if (!tenantId || !testId) {
      continue;
    }

    if (!knownTenantIds.has(tenantId)) {
      continue;
    }

    stateByPublication.set(buildPublicationKey(tenantId, testId), {
      published_version_id: normalizeNonEmptyString(row.published_version_id),
      is_enabled: row.is_enabled ?? false,
      updated_at: toIsoString(row.updated_at)
    });
  }

  const tests = Array.from(testsById.values()).sort((left, right) => {
    const slugCompare = left.slug.localeCompare(right.slug);
    if (slugCompare !== 0) {
      return slugCompare;
    }
    return left.test_id.localeCompare(right.test_id);
  });
  if (tests.length === 0) {
    return [];
  }

  const domainsByTenant = buildTenantDomainsById();
  const sortedTenantIds = Array.from(tenantIds).sort((left, right) => left.localeCompare(right));
  const publications: AdminPublicationRow[] = [];

  for (const tenantId of sortedTenantIds) {
    for (const test of tests) {
      const publicationState = stateByPublication.get(buildPublicationKey(tenantId, test.test_id));
      const row: AdminPublicationRow = {
        tenant_id: tenantId,
        domains: [...(domainsByTenant.get(tenantId) ?? [])],
        test_id: test.test_id,
        slug: test.slug,
        published_version_id: publicationState?.published_version_id ?? null,
        is_enabled: publicationState?.is_enabled ?? false,
        updated_at: publicationState?.updated_at ?? null
      };

      if (tenantFilter && row.tenant_id !== tenantFilter) {
        continue;
      }
      if (testFilter && row.test_id !== testFilter) {
        continue;
      }
      if (onlyPublished && row.published_version_id === null) {
        continue;
      }
      if (onlyEnabled && !row.is_enabled) {
        continue;
      }
      if (queryText && !matchesQuery(row, queryText)) {
        continue;
      }

      publications.push(row);
    }
  }

  publications.sort(comparePublicationRows);
  return publications;
};

import tenantsConfig from "../../../../../config/tenants.json";

import { getContentDbPool } from "../content_db/pool";

type TenantRegistryEntryRaw = {
  tenant_id: string;
  domains?: string[];
  default_locale?: string;
};

type TenantRegistryRaw = {
  tenants?: TenantRegistryEntryRaw[];
};

type TenantPublishedCountRow = {
  tenant_id: string | null;
  published_count: number | null;
};

type TenantPublishedTestRow = {
  test_id: string | null;
  slug: string | null;
  published_version_id: string | null;
  is_enabled: boolean | null;
};

export type AdminTenantWithCount = {
  tenant_id: string;
  domains: string[];
  default_locale: string;
  published_count: number;
};

export type AdminTenantPublishedTest = {
  test_id: string;
  slug: string;
  published_version_id: string;
  enabled: boolean;
};

export type AdminTenantDetail = {
  tenant: AdminTenantWithCount | null;
  published_tests: AdminTenantPublishedTest[];
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeCount = (value: number | null | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
};

const tenantRegistry: AdminTenantWithCount[] = ((tenantsConfig as TenantRegistryRaw).tenants ?? [])
  .map((entry) => {
    const tenantId = normalizeString(entry.tenant_id);
    if (!tenantId) {
      return null;
    }

    const domains = Array.isArray(entry.domains)
      ? entry.domains
          .map((domain) => normalizeString(domain))
          .filter((domain): domain is string => domain !== null)
      : [];

    return {
      tenant_id: tenantId,
      domains,
      default_locale: normalizeString(entry.default_locale) ?? "en",
      published_count: 0
    };
  })
  .filter((entry): entry is AdminTenantWithCount => entry !== null)
  .sort((left, right) => left.tenant_id.localeCompare(right.tenant_id));

export const listAdminTenantsWithCounts = async (): Promise<AdminTenantWithCount[]> => {
  const pool = getContentDbPool();
  let rows: TenantPublishedCountRow[] = [];

  try {
    const result = await pool.query<TenantPublishedCountRow>(
      `
        SELECT
          tt.tenant_id,
          COUNT(*)::int AS published_count
        FROM tenant_tests tt
        WHERE tt.is_enabled = TRUE
        GROUP BY tt.tenant_id
      `
    );
    rows = result.rows;
  } catch {
    throw new Error("Unable to load tenants.");
  }

  const countsByTenant = new Map<string, number>();
  for (const row of rows) {
    const tenantId = normalizeString(row.tenant_id);
    if (!tenantId) {
      continue;
    }
    countsByTenant.set(tenantId, normalizeCount(row.published_count));
  }

  return tenantRegistry.map((tenant) => ({
    tenant_id: tenant.tenant_id,
    domains: [...tenant.domains],
    default_locale: tenant.default_locale,
    published_count: countsByTenant.get(tenant.tenant_id) ?? 0
  }));
};

export const getAdminTenantDetail = async (tenantIdInput: string): Promise<AdminTenantDetail> => {
  const tenantId = normalizeString(tenantIdInput);
  if (!tenantId) {
    return {
      tenant: null,
      published_tests: []
    };
  }

  const registryEntry = tenantRegistry.find((entry) => entry.tenant_id === tenantId);
  if (!registryEntry) {
    return {
      tenant: null,
      published_tests: []
    };
  }

  const pool = getContentDbPool();
  let countRow: TenantPublishedCountRow | null = null;
  let testRows: TenantPublishedTestRow[] = [];

  try {
    const [countResult, testsResult] = await Promise.all([
      pool.query<TenantPublishedCountRow>(
        `
          SELECT
            $1::text AS tenant_id,
            COUNT(*)::int AS published_count
          FROM tenant_tests tt
          WHERE tt.tenant_id = $1
            AND tt.is_enabled = TRUE
        `,
        [tenantId]
      ),
      pool.query<TenantPublishedTestRow>(
        `
          SELECT
            t.test_id,
            t.slug,
            tt.published_version_id,
            tt.is_enabled
          FROM tenant_tests tt
          JOIN tests t
            ON t.id = tt.test_id
          WHERE tt.tenant_id = $1
            AND tt.published_version_id IS NOT NULL
          ORDER BY t.slug ASC, t.test_id ASC
        `,
        [tenantId]
      )
    ]);

    countRow = countResult.rows[0] ?? null;
    testRows = testsResult.rows;
  } catch {
    throw new Error("Unable to load tenant detail.");
  }

  const publishedTests = testRows
    .map((row) => {
      const testId = normalizeString(row.test_id);
      const slug = normalizeString(row.slug);
      const publishedVersionId = normalizeString(row.published_version_id);

      if (!testId || !slug || !publishedVersionId) {
        return null;
      }

      return {
        test_id: testId,
        slug,
        published_version_id: publishedVersionId,
        enabled: row.is_enabled ?? false
      };
    })
    .filter((row): row is AdminTenantPublishedTest => row !== null);

  return {
    tenant: {
      tenant_id: registryEntry.tenant_id,
      domains: [...registryEntry.domains],
      default_locale: registryEntry.default_locale,
      published_count: normalizeCount(countRow?.published_count)
    },
    published_tests: publishedTests
  };
};

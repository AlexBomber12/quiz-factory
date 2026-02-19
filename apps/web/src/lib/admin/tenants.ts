import tenantsConfig from "../../../../../config/tenants.json";

import { normalizeLocaleTag, type LocaleTag } from "../content/types";
import { getContentDbPool } from "../content_db/pool";
import { normalizeHostname } from "../security/request_host";
import { invalidateTenantRuntimeCache } from "../tenants/runtime_db";
import { getTenantsSource, type TenantsSource } from "../tenants/source";
import { normalizeString } from "@/lib/utils/strings";

type TenantRegistryEntryRaw = {
  tenant_id: string;
  domains?: string[];
  default_locale?: string;
  enabled?: boolean;
};

type TenantRegistryRaw = {
  tenants?: TenantRegistryEntryRaw[];
};

type TenantPublishedCountRow = {
  tenant_id: string | null;
  published_count: number | null;
};

type TenantPublishedTestRow = {
  content_type: string | null;
  content_key: string | null;
  slug: string | null;
  published_version_id: string | null;
  enabled: boolean | null;
};

type TenantRow = {
  tenant_id: string | null;
  default_locale: string | null;
  enabled: boolean | null;
};

type DomainRow = {
  tenant_id: string | null;
  domain: string | null;
};

export type AdminTenantWithCount = {
  tenant_id: string;
  domains: string[];
  default_locale: LocaleTag;
  enabled: boolean;
  published_count: number;
};

export type AdminTenantPublishedTest = {
  content_type: string;
  content_key: string;
  slug: string;
  published_version_id: string;
  enabled: boolean;
};

export type AdminTenantDetail = {
  tenant: AdminTenantWithCount | null;
  published_tests: AdminTenantPublishedTest[];
};

export type CreateAdminTenantInput = {
  tenant_id: string;
  default_locale: string;
  enabled?: boolean;
  domains: string[];
};

export type UpdateAdminTenantInput = {
  default_locale?: string;
  enabled?: boolean;
};

export type AdminTenantErrorCode =
  | "invalid_payload"
  | "not_found"
  | "conflict"
  | "source_not_db"
  | "db_error";

export class AdminTenantError extends Error {
  code: AdminTenantErrorCode;
  status: number;
  detail: string | null;

  constructor(code: AdminTenantErrorCode, status: number, detail?: string | null) {
    super(code);
    this.code = code;
    this.status = status;
    this.detail = detail ?? null;
  }
}

const TENANT_ID_PATTERN = /^tenant-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);


const normalizeCount = (value: number | null | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
};

const normalizeLocale = (value: unknown): LocaleTag | null => {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  return normalizeLocaleTag(normalized);
};

const normalizeTenantId = (value: unknown): string | null => {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  return TENANT_ID_PATTERN.test(normalized) ? normalized : null;
};

const normalizeDomain = (value: unknown): string | null => {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  if (normalized.includes("://") || normalized.includes("/") || /\s/.test(normalized)) {
    return null;
  }

  return normalizeHostname(normalized);
};

const normalizeBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) {
    return true;
  }

  if (FALSE_VALUES.has(normalized)) {
    return false;
  }

  return null;
};

const dedupeDomains = (domains: string[]): string[] => {
  return Array.from(new Set(domains)).sort((left, right) => left.localeCompare(right));
};

const requireDbSource = (): void => {
  if (getTenantsSource() !== "db") {
    throw new AdminTenantError(
      "source_not_db",
      409,
      "Set TENANTS_SOURCE=db to enable tenant registry writes."
    );
  }
};

const mapDatabaseError = (error: unknown): AdminTenantError => {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : null;

  if (code === "23505") {
    return new AdminTenantError(
      "conflict",
      409,
      "tenant_id or domain already exists."
    );
  }

  if (code === "23503") {
    return new AdminTenantError("not_found", 404, "Tenant not found.");
  }

  return new AdminTenantError("db_error", 500, "Unable to update tenant registry.");
};

const loadPublishedCountsByTenant = async (
  options?: { ignoreErrors?: boolean }
): Promise<Map<string, number>> => {
  try {
    const pool = getContentDbPool();
    const result = await pool.query<TenantPublishedCountRow>(
      `
        SELECT
          dp.tenant_id,
          COUNT(*)::int AS published_count
        FROM domain_publications dp
        WHERE dp.enabled = TRUE
        GROUP BY dp.tenant_id
      `
    );

    const output = new Map<string, number>();
    for (const row of result.rows) {
      const tenantId = normalizeString(row.tenant_id);
      if (!tenantId) {
        continue;
      }

      output.set(tenantId, normalizeCount(row.published_count));
    }

    return output;
  } catch (error) {
    if (options?.ignoreErrors) {
      return new Map<string, number>();
    }
    throw error;
  }
};

const loadPublishedTestsForTenant = async (
  tenantId: string,
  options?: { ignoreErrors?: boolean }
): Promise<AdminTenantPublishedTest[]> => {
  try {
    const pool = getContentDbPool();
    const result = await pool.query<TenantPublishedTestRow>(
      `
        SELECT
          ci.content_type,
          ci.content_key,
          ci.slug,
          dp.published_version_id,
          dp.enabled
        FROM domain_publications dp
        JOIN content_items ci
          ON ci.id = dp.content_item_id
        WHERE dp.tenant_id = $1
          AND dp.published_version_id IS NOT NULL
        ORDER BY ci.content_type ASC, ci.slug ASC, ci.content_key ASC
      `,
      [tenantId]
    );

    return result.rows
      .map((row) => {
        const contentType = normalizeString(row.content_type);
        const contentKey = normalizeString(row.content_key);
        const slug = normalizeString(row.slug);
        const publishedVersionId = normalizeString(row.published_version_id);
        if (!contentType || !contentKey || !slug || !publishedVersionId) {
          return null;
        }

        return {
          content_type: contentType,
          content_key: contentKey,
          slug,
          published_version_id: publishedVersionId,
          enabled: row.enabled ?? false
        };
      })
      .filter((row): row is AdminTenantPublishedTest => row !== null);
  } catch (error) {
    if (options?.ignoreErrors) {
      return [];
    }
    throw error;
  }
};

const loadTenantDomainsFromDb = async (): Promise<Map<string, string[]>> => {
  const pool = getContentDbPool();
  const result = await pool.query<DomainRow>(
    `
      SELECT
        tenant_id,
        domain
      FROM tenant_domains
      ORDER BY tenant_id ASC, domain ASC
    `
  );

  const domainsByTenant = new Map<string, string[]>();
  for (const row of result.rows) {
    const tenantId = normalizeString(row.tenant_id);
    const domain = normalizeDomain(row.domain);
    if (!tenantId || !domain) {
      continue;
    }

    const existing = domainsByTenant.get(tenantId);
    if (!existing) {
      domainsByTenant.set(tenantId, [domain]);
      continue;
    }

    if (!existing.includes(domain)) {
      existing.push(domain);
      existing.sort((left, right) => left.localeCompare(right));
    }
  }

  return domainsByTenant;
};

const loadTenantDomainsForTenant = async (tenantId: string): Promise<string[]> => {
  const pool = getContentDbPool();
  const result = await pool.query<DomainRow>(
    `
      SELECT
        tenant_id,
        domain
      FROM tenant_domains
      WHERE tenant_id = $1
      ORDER BY domain ASC
    `,
    [tenantId]
  );

  const domains = result.rows
    .map((row) => normalizeDomain(row.domain))
    .filter((domain): domain is string => domain !== null);

  return dedupeDomains(domains);
};

const fileTenantRegistry: Omit<AdminTenantWithCount, "published_count">[] = (
  (tenantsConfig as TenantRegistryRaw).tenants ?? []
)
  .map((entry) => {
    const tenantId = normalizeTenantId(entry.tenant_id);
    if (!tenantId) {
      return null;
    }

    const defaultLocale = normalizeLocale(entry.default_locale) ?? "en";
    const domains = Array.isArray(entry.domains)
      ? dedupeDomains(
          entry.domains
            .map((domain) => normalizeDomain(domain))
            .filter((domain): domain is string => domain !== null)
        )
      : [];

    return {
      tenant_id: tenantId,
      domains,
      default_locale: defaultLocale,
      enabled: typeof entry.enabled === "boolean" ? entry.enabled : true
    };
  })
  .filter((entry): entry is Omit<AdminTenantWithCount, "published_count"> => entry !== null)
  .sort((left, right) => left.tenant_id.localeCompare(right.tenant_id));

const toTenantFromRow = (
  row: TenantRow,
  domainsByTenant: Map<string, string[]>,
  countsByTenant: Map<string, number>
): AdminTenantWithCount | null => {
  const tenantId = normalizeTenantId(row.tenant_id);
  const defaultLocale = normalizeLocale(row.default_locale);
  if (!tenantId || !defaultLocale) {
    return null;
  }

  return {
    tenant_id: tenantId,
    domains: [...(domainsByTenant.get(tenantId) ?? [])],
    default_locale: defaultLocale,
    enabled: row.enabled ?? true,
    published_count: countsByTenant.get(tenantId) ?? 0
  };
};

const loadTenantRowById = async (tenantId: string): Promise<TenantRow | null> => {
  const pool = getContentDbPool();
  const result = await pool.query<TenantRow>(
    `
      SELECT
        tenant_id,
        default_locale,
        enabled
      FROM tenants
      WHERE tenant_id = $1
      LIMIT 1
    `,
    [tenantId]
  );

  return result.rows[0] ?? null;
};

export const getAdminTenantsSource = (): TenantsSource => getTenantsSource();

export const listAdminTenantsWithCounts = async (): Promise<AdminTenantWithCount[]> => {
  if (getTenantsSource() !== "db") {
    const countsByTenant = await loadPublishedCountsByTenant({ ignoreErrors: true });
    return fileTenantRegistry.map((tenant) => ({
      ...tenant,
      domains: [...tenant.domains],
      published_count: countsByTenant.get(tenant.tenant_id) ?? 0
    }));
  }

  const countsByTenant = await loadPublishedCountsByTenant();
  const pool = getContentDbPool();
  const [tenantsResult, domainsByTenant] = await Promise.all([
    pool.query<TenantRow>(
      `
        SELECT
          tenant_id,
          default_locale,
          enabled
        FROM tenants
        ORDER BY tenant_id ASC
      `
    ),
    loadTenantDomainsFromDb()
  ]);

  return tenantsResult.rows
    .map((row) => toTenantFromRow(row, domainsByTenant, countsByTenant))
    .filter((row): row is AdminTenantWithCount => row !== null);
};

export const getAdminTenantDetail = async (tenantIdInput: string): Promise<AdminTenantDetail> => {
  const tenantId = normalizeString(tenantIdInput);
  if (!tenantId) {
    return {
      tenant: null,
      published_tests: []
    };
  }

  if (getTenantsSource() !== "db") {
    const publishedTests = await loadPublishedTestsForTenant(tenantId, {
      ignoreErrors: true
    });
    const registryEntry = fileTenantRegistry.find((entry) => entry.tenant_id === tenantId);
    if (!registryEntry) {
      return {
        tenant: null,
        published_tests: []
      };
    }

    const countsByTenant = await loadPublishedCountsByTenant({ ignoreErrors: true });
    return {
      tenant: {
        ...registryEntry,
        domains: [...registryEntry.domains],
        published_count: countsByTenant.get(registryEntry.tenant_id) ?? 0
      },
      published_tests: publishedTests
    };
  }

  const publishedTests = await loadPublishedTestsForTenant(tenantId);
  const [tenantRow, domains, countsByTenant] = await Promise.all([
    loadTenantRowById(tenantId),
    loadTenantDomainsForTenant(tenantId),
    loadPublishedCountsByTenant()
  ]);

  if (!tenantRow) {
    return {
      tenant: null,
      published_tests: []
    };
  }

  const tenant = toTenantFromRow(
    tenantRow,
    new Map([[tenantId, domains]]),
    countsByTenant
  );

  return {
    tenant,
    published_tests: publishedTests
  };
};

const parseCreateInput = (input: CreateAdminTenantInput): {
  tenantId: string;
  defaultLocale: LocaleTag;
  enabled: boolean;
  domains: string[];
} => {
  const tenantId = normalizeTenantId(input.tenant_id);
  if (!tenantId) {
    throw new AdminTenantError("invalid_payload", 400, "tenant_id must match tenant-<slug>.");
  }

  const defaultLocale = normalizeLocale(input.default_locale);
  if (!defaultLocale) {
    throw new AdminTenantError("invalid_payload", 400, "default_locale must be en, es, or pt-BR.");
  }

  const enabled =
    typeof input.enabled === "boolean" ? input.enabled : normalizeBoolean(input.enabled) ?? true;

  const domains = dedupeDomains(
    input.domains
      .map((domain) => normalizeDomain(domain))
      .filter((domain): domain is string => domain !== null)
  );

  if (domains.length === 0) {
    throw new AdminTenantError("invalid_payload", 400, "At least one valid domain is required.");
  }

  return {
    tenantId,
    defaultLocale,
    enabled,
    domains
  };
};

export const createAdminTenant = async (
  input: CreateAdminTenantInput
): Promise<AdminTenantWithCount> => {
  requireDbSource();
  const parsed = parseCreateInput(input);
  const pool = getContentDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
        INSERT INTO tenants (
          tenant_id,
          default_locale,
          enabled
        )
        VALUES ($1, $2, $3)
      `,
      [parsed.tenantId, parsed.defaultLocale, parsed.enabled]
    );

    for (const domain of parsed.domains) {
      await client.query(
        `
          INSERT INTO tenant_domains (
            tenant_id,
            domain
          )
          VALUES ($1, $2)
        `,
        [parsed.tenantId, domain]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw mapDatabaseError(error);
  } finally {
    client.release();
  }

  invalidateTenantRuntimeCache();

  return {
    tenant_id: parsed.tenantId,
    default_locale: parsed.defaultLocale,
    enabled: parsed.enabled,
    domains: parsed.domains,
    published_count: 0
  };
};

const parseUpdateInput = (input: UpdateAdminTenantInput): {
  defaultLocale: LocaleTag | null;
  enabled: boolean | null;
} => {
  const defaultLocale =
    input.default_locale === undefined ? null : normalizeLocale(input.default_locale);
  if (input.default_locale !== undefined && !defaultLocale) {
    throw new AdminTenantError("invalid_payload", 400, "default_locale must be en, es, or pt-BR.");
  }

  const enabled =
    input.enabled === undefined
      ? null
      : typeof input.enabled === "boolean"
        ? input.enabled
        : normalizeBoolean(input.enabled);
  if (input.enabled !== undefined && enabled === null) {
    throw new AdminTenantError("invalid_payload", 400, "enabled must be true or false.");
  }

  if (defaultLocale === null && enabled === null) {
    throw new AdminTenantError("invalid_payload", 400, "No changes provided.");
  }

  return {
    defaultLocale,
    enabled
  };
};

export const updateAdminTenant = async (
  tenantIdInput: string,
  input: UpdateAdminTenantInput
): Promise<void> => {
  requireDbSource();
  const tenantId = normalizeTenantId(tenantIdInput);
  if (!tenantId) {
    throw new AdminTenantError("invalid_payload", 400, "tenant_id must match tenant-<slug>.");
  }

  const parsed = parseUpdateInput(input);
  const assignments: string[] = [];
  const values: unknown[] = [tenantId];

  if (parsed.defaultLocale !== null) {
    values.push(parsed.defaultLocale);
    assignments.push(`default_locale = $${values.length}`);
  }

  if (parsed.enabled !== null) {
    values.push(parsed.enabled);
    assignments.push(`enabled = $${values.length}`);
  }

  const pool = getContentDbPool();
  let rowCount = 0;

  try {
    const result = await pool.query(
      `
        UPDATE tenants
        SET ${assignments.join(", ")}
        WHERE tenant_id = $1
      `,
      values
    );
    rowCount = result.rowCount ?? 0;
  } catch (error) {
    throw mapDatabaseError(error);
  }

  if (rowCount === 0) {
    throw new AdminTenantError("not_found", 404, "Tenant not found.");
  }

  invalidateTenantRuntimeCache();
};

export const deleteAdminTenant = async (tenantIdInput: string): Promise<void> => {
  requireDbSource();
  const tenantId = normalizeTenantId(tenantIdInput);
  if (!tenantId) {
    throw new AdminTenantError("invalid_payload", 400, "tenant_id must match tenant-<slug>.");
  }

  const pool = getContentDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await client.query(
      `
        DELETE FROM tenants
        WHERE tenant_id = $1
      `,
      [tenantId]
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new AdminTenantError("not_found", 404, "Tenant not found.");
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof AdminTenantError) {
      throw error;
    }
    throw mapDatabaseError(error);
  } finally {
    client.release();
  }

  invalidateTenantRuntimeCache();
};

const ensureTenantExists = async (tenantId: string): Promise<void> => {
  const tenantRow = await loadTenantRowById(tenantId);
  if (!tenantRow) {
    throw new AdminTenantError("not_found", 404, "Tenant not found.");
  }
};

export const addAdminTenantDomain = async (
  tenantIdInput: string,
  domainInput: string
): Promise<string> => {
  requireDbSource();
  const tenantId = normalizeTenantId(tenantIdInput);
  if (!tenantId) {
    throw new AdminTenantError("invalid_payload", 400, "tenant_id must match tenant-<slug>.");
  }

  const domain = normalizeDomain(domainInput);
  if (!domain) {
    throw new AdminTenantError("invalid_payload", 400, "domain is invalid.");
  }

  await ensureTenantExists(tenantId);

  const pool = getContentDbPool();
  try {
    await pool.query(
      `
        INSERT INTO tenant_domains (
          tenant_id,
          domain
        )
        VALUES ($1, $2)
      `,
      [tenantId, domain]
    );
  } catch (error) {
    throw mapDatabaseError(error);
  }

  invalidateTenantRuntimeCache();
  return domain;
};

export const removeAdminTenantDomain = async (
  tenantIdInput: string,
  domainInput: string
): Promise<void> => {
  requireDbSource();
  const tenantId = normalizeTenantId(tenantIdInput);
  if (!tenantId) {
    throw new AdminTenantError("invalid_payload", 400, "tenant_id must match tenant-<slug>.");
  }

  const domain = normalizeDomain(domainInput);
  if (!domain) {
    throw new AdminTenantError("invalid_payload", 400, "domain is invalid.");
  }

  await ensureTenantExists(tenantId);

  const domains = await loadTenantDomainsForTenant(tenantId);
  if (!domains.includes(domain)) {
    throw new AdminTenantError("not_found", 404, "Domain not found.");
  }

  if (domains.length <= 1) {
    throw new AdminTenantError(
      "invalid_payload",
      400,
      "Tenant must keep at least one domain."
    );
  }

  const pool = getContentDbPool();
  try {
    await pool.query(
      `
        DELETE FROM tenant_domains
        WHERE tenant_id = $1
          AND domain = $2
      `,
      [tenantId, domain]
    );
  } catch (error) {
    throw mapDatabaseError(error);
  }

  invalidateTenantRuntimeCache();
};

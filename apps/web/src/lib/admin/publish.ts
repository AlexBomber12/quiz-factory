import tenantsConfig from "../../../../../config/tenants.json";
import type { PoolClient } from "pg";

import {
  publishDomainContent,
  rollbackDomainContent
} from "../content_db/domain_publications";
import { invalidateTenant, invalidateTest } from "../content_db/repo";
import { getContentDbPool } from "../content_db/pool";
import { invalidateTenant as invalidateTenantSitemap } from "../seo/sitemap_cache";
import { type AdminRole } from "./session";

type TimestampValue = Date | string;

type TenantRegistryEntryRaw = {
  tenant_id: string;
  domains?: string[];
  default_locale?: string;
};

type TenantRegistryRaw = {
  tenants?: TenantRegistryEntryRaw[];
};

type TestVersionListRow = {
  test_id: string;
  slug: string;
  version_id: string | null;
  version: number | null;
  status: "draft" | "archived" | null;
  created_at: TimestampValue | null;
  created_by: string | null;
};

type TenantPublishStateRow = {
  test_id: string;
  tenant_id: string | null;
  is_enabled: boolean | null;
  published_version_id: string | null;
  published_version: number | null;
  published_at: TimestampValue | null;
  published_by: string | null;
};

type ResolvedVersionRow = {
  version_id: string;
  version: number;
};

export type TenantRegistryEntry = {
  tenant_id: string;
  domains: string[];
  default_locale: string;
};

export type AdminTestVersion = {
  id: string;
  version: number;
  status: "draft" | "archived";
  created_at: string;
  created_by: string | null;
};

export type AdminTenantPublishState = {
  tenant_id: string;
  is_enabled: boolean;
  published_version_id: string | null;
  published_version: number | null;
  published_at: string | null;
  published_by: string | null;
};

export type AdminPublishTest = {
  test_id: string;
  slug: string;
  versions: AdminTestVersion[];
  tenant_states: AdminTenantPublishState[];
};

export type PublishMutationResult = {
  test_id: string;
  version_id: string;
  version: number;
  tenant_ids: string[];
  is_enabled: boolean;
};

export type PublishWorkflowErrorCode =
  | "forbidden"
  | "invalid_test_id"
  | "invalid_version_id"
  | "invalid_tenant_ids"
  | "invalid_tenant_id"
  | "invalid_is_enabled"
  | "unknown_tenant"
  | "test_version_not_found"
  | "staging_publish_required";

export class PublishWorkflowError extends Error {
  code: PublishWorkflowErrorCode;
  status: number;
  detail: string | null;

  constructor(code: PublishWorkflowErrorCode, status: number, detail?: string | null) {
    super(code);
    this.code = code;
    this.status = status;
    this.detail = detail ?? null;
  }
}

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
      default_locale: normalizeString(entry.default_locale) ?? "en"
    };
  })
  .filter((entry): entry is TenantRegistryEntry => entry !== null)
  .sort((left, right) => left.tenant_id.localeCompare(right.tenant_id));

const tenantIdSet = new Set(tenantRegistry.map((entry) => entry.tenant_id));
const tenantRegistryById = new Map(tenantRegistry.map((entry) => [entry.tenant_id, entry]));

const normalizeTenantDefaultLocale = (value: string): "en" | "es" | "pt-BR" => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "es") {
    return "es";
  }
  if (normalized === "pt-br") {
    return "pt-BR";
  }
  return "en";
};

const normalizeTenantIds = (tenantIds: string[]): string[] => {
  const unique = new Set<string>();

  for (const tenantId of tenantIds) {
    const normalized = normalizeString(tenantId);
    if (normalized) {
      unique.add(normalized);
    }
  }

  return Array.from(unique.values());
};

const parseBooleanEnv = (value: string | undefined): boolean => {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
};

const listStagingTenantAllowlist = (): Set<string> => {
  const allowlist = new Set<string>();
  const raw = normalizeString(process.env.ADMIN_STAGING_TENANT_ALLOWLIST);
  if (!raw) {
    return allowlist;
  }

  for (const token of raw.split(",")) {
    const normalized = normalizeString(token);
    if (normalized) {
      allowlist.add(normalized);
    }
  }

  return allowlist;
};

const isStagingTenantId = (tenantId: string): boolean => {
  if (tenantId.startsWith("staging-")) {
    return true;
  }

  return listStagingTenantAllowlist().has(tenantId);
};

const shouldRequireStagingPublish = (): boolean => {
  return parseBooleanEnv(process.env.ADMIN_REQUIRE_STAGING_PUBLISH);
};

const assertKnownTenantIds = (tenantIds: string[]): void => {
  for (const tenantId of tenantIds) {
    if (!tenantIdSet.has(tenantId)) {
      throw new PublishWorkflowError("unknown_tenant", 400, tenantId);
    }
  }
};

const requireAdminRole = (actorRole: AdminRole): void => {
  if (actorRole !== "admin") {
    throw new PublishWorkflowError("forbidden", 403, "Only admin can publish or rollback.");
  }
};

const ensureTenantRowsExist = async (client: PoolClient, tenantIds: string[]): Promise<void> => {
  if (tenantIds.length === 0) {
    return;
  }

  const locales = tenantIds.map((tenantId) =>
    normalizeTenantDefaultLocale(tenantRegistryById.get(tenantId)?.default_locale ?? "en")
  );

  await client.query(
    `
      INSERT INTO tenants (
        tenant_id,
        default_locale,
        enabled
      )
      SELECT
        tenant_id,
        default_locale,
        TRUE
      FROM unnest($1::text[], $2::text[]) AS seed(tenant_id, default_locale)
      ON CONFLICT (tenant_id) DO NOTHING
    `,
    [tenantIds, locales]
  );
};

const resolveTestVersion = async (
  client: PoolClient,
  testId: string,
  versionId: string
): Promise<ResolvedVersionRow> => {
  const { rows } = await client.query<ResolvedVersionRow>(
    `
      SELECT
        tv.id AS version_id,
        tv.version
      FROM tests t
      JOIN test_versions tv
        ON tv.test_id = t.id
      WHERE t.test_id = $1
        AND tv.id = $2
      LIMIT 1
    `,
    [testId, versionId]
  );

  const row = rows[0];
  if (!row) {
    throw new PublishWorkflowError(
      "test_version_not_found",
      404,
      `version_id '${versionId}' does not belong to test_id '${testId}'.`
    );
  }

  return row;
};

const assertStagingPublishPrerequisite = async (
  client: PoolClient,
  params: {
    testId: string;
    versionId: string;
    targetTenantIds: string[];
  }
): Promise<void> => {
  if (!shouldRequireStagingPublish()) {
    return;
  }

  const prodTenantIds = params.targetTenantIds.filter(
    (tenantId) => !isStagingTenantId(tenantId)
  );
  if (prodTenantIds.length === 0) {
    return;
  }

  const stagingTenantIds = tenantRegistry
    .map((entry) => entry.tenant_id)
    .filter((tenantId) => isStagingTenantId(tenantId));
  if (stagingTenantIds.length === 0) {
    throw new PublishWorkflowError(
      "staging_publish_required",
      409,
      "No staging tenants are configured for staging-first publish checks."
    );
  }

  const { rows } = await client.query<{ tenant_id: string }>(
    `
      SELECT dp.tenant_id
      FROM domain_publications dp
      JOIN content_items ci
        ON ci.id = dp.content_item_id
      WHERE ci.content_type = 'test'
        AND ci.content_key = $1
        AND dp.published_version_id = $2::uuid
        AND dp.tenant_id = ANY($3::text[])
      LIMIT 1
    `,
    [params.testId, params.versionId, stagingTenantIds]
  );

  if (rows.length > 0) {
    return;
  }

  throw new PublishWorkflowError(
    "staging_publish_required",
    409,
    `Publish to production tenants requires prior staging publish for this version. Target production tenants: ${prodTenantIds.join(
      ", "
    )}.`
  );
};

const invalidateCaches = (testId: string, tenantIds: string[]): void => {
  for (const tenantId of tenantIds) {
    invalidateTenant(tenantId);
    invalidateTenantSitemap(tenantId);
  }
  invalidateTest(testId);
};

export const isPublishWorkflowError = (error: unknown): error is PublishWorkflowError => {
  return (
    Boolean(error) &&
    typeof error === "object" &&
    typeof (error as { code?: unknown }).code === "string" &&
    typeof (error as { status?: unknown }).status === "number"
  );
};

export const listTenantRegistry = (): TenantRegistryEntry[] => {
  return tenantRegistry.map((entry) => ({
    tenant_id: entry.tenant_id,
    domains: [...entry.domains],
    default_locale: entry.default_locale
  }));
};

export const listPublishTests = async (): Promise<AdminPublishTest[]> => {
  const pool = getContentDbPool();
  const [versionsResult, tenantStateResult] = await Promise.all([
    pool.query<TestVersionListRow>(
      `
        SELECT
          t.test_id,
          t.slug,
          tv.id AS version_id,
          tv.version,
          tv.status,
          tv.created_at,
          tv.created_by
        FROM tests t
        LEFT JOIN test_versions tv
          ON tv.test_id = t.id
        ORDER BY t.slug ASC, tv.version DESC NULLS LAST
      `
    ),
    pool.query<TenantPublishStateRow>(
      `
        SELECT
          t.test_id,
          dp.tenant_id,
          dp.enabled AS is_enabled,
          dp.published_version_id,
          tv.version AS published_version,
          dp.published_at,
          NULL::text AS published_by
        FROM tests t
        LEFT JOIN content_items ci
          ON ci.content_type = 'test'
          AND ci.content_key = t.test_id
        LEFT JOIN domain_publications dp
          ON dp.content_item_id = ci.id
        LEFT JOIN test_versions tv
          ON tv.id = dp.published_version_id
        ORDER BY t.slug ASC, dp.tenant_id ASC
      `
    )
  ]);

  const testsById = new Map<string, AdminPublishTest>();

  for (const row of versionsResult.rows) {
    const testId = normalizeString(row.test_id);
    const slug = normalizeString(row.slug);
    if (!testId || !slug) {
      continue;
    }

    let record = testsById.get(testId);
    if (!record) {
      record = {
        test_id: testId,
        slug,
        versions: [],
        tenant_states: tenantRegistry.map((tenant) => ({
          tenant_id: tenant.tenant_id,
          is_enabled: false,
          published_version_id: null,
          published_version: null,
          published_at: null,
          published_by: null
        }))
      };
      testsById.set(testId, record);
    }

    if (!row.version_id || row.version === null || row.status === null || row.created_at === null) {
      continue;
    }

    record.versions.push({
      id: row.version_id,
      version: row.version,
      status: row.status,
      created_at: toIsoString(row.created_at) ?? "",
      created_by: row.created_by
    });
  }

  for (const row of tenantStateResult.rows) {
    const testId = normalizeString(row.test_id);
    const tenantId = normalizeString(row.tenant_id);
    if (!testId || !tenantId) {
      continue;
    }

    const record = testsById.get(testId);
    if (!record) {
      continue;
    }

    const tenantState = record.tenant_states.find((state) => state.tenant_id === tenantId);
    if (!tenantState) {
      continue;
    }

    tenantState.is_enabled = row.is_enabled ?? false;
    tenantState.published_version_id = row.published_version_id;
    tenantState.published_version = row.published_version;
    tenantState.published_at = toIsoString(row.published_at);
    tenantState.published_by = row.published_by;
  }

  return Array.from(testsById.values());
};

export const publishVersionToTenants = async (input: {
  actor_role: AdminRole;
  actor_hint?: string | null;
  test_id: string;
  version_id: string;
  tenant_ids: string[];
  is_enabled: boolean;
}): Promise<PublishMutationResult> => {
  requireAdminRole(input.actor_role);

  const testId = normalizeString(input.test_id);
  if (!testId) {
    throw new PublishWorkflowError("invalid_test_id", 400);
  }

  const versionId = normalizeString(input.version_id);
  if (!versionId) {
    throw new PublishWorkflowError("invalid_version_id", 400);
  }

  if (typeof input.is_enabled !== "boolean") {
    throw new PublishWorkflowError("invalid_is_enabled", 400);
  }

  const tenantIds = normalizeTenantIds(input.tenant_ids);
  if (tenantIds.length === 0) {
    throw new PublishWorkflowError("invalid_tenant_ids", 400, "At least one tenant_id is required.");
  }

  assertKnownTenantIds(tenantIds);

  const pool = getContentDbPool();
  const client = await pool.connect();
  let resolvedVersion: ResolvedVersionRow | null = null;

  try {
    await client.query("BEGIN");
    await ensureTenantRowsExist(client, tenantIds);
    resolvedVersion = await resolveTestVersion(client, testId, versionId);
    await assertStagingPublishPrerequisite(client, {
      testId,
      versionId: resolvedVersion.version_id,
      targetTenantIds: tenantIds
    });

    const publishedAt = new Date();
    for (const tenantId of tenantIds) {
      await publishDomainContent(
        tenantId,
        "test",
        testId,
        resolvedVersion.version_id,
        input.is_enabled,
        {
          client,
          publishedAt
        }
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  if (!resolvedVersion) {
    throw new PublishWorkflowError("test_version_not_found", 404);
  }

  invalidateCaches(testId, tenantIds);

  return {
    test_id: testId,
    version_id: resolvedVersion.version_id,
    version: resolvedVersion.version,
    tenant_ids: tenantIds,
    is_enabled: input.is_enabled
  };
};

export const rollbackVersionForTenant = async (input: {
  actor_role: AdminRole;
  actor_hint?: string | null;
  test_id: string;
  tenant_id: string;
  version_id: string;
}): Promise<PublishMutationResult> => {
  requireAdminRole(input.actor_role);

  const testId = normalizeString(input.test_id);
  if (!testId) {
    throw new PublishWorkflowError("invalid_test_id", 400);
  }

  const versionId = normalizeString(input.version_id);
  if (!versionId) {
    throw new PublishWorkflowError("invalid_version_id", 400);
  }

  const tenantId = normalizeString(input.tenant_id);
  if (!tenantId) {
    throw new PublishWorkflowError("invalid_tenant_id", 400);
  }

  assertKnownTenantIds([tenantId]);

  const pool = getContentDbPool();
  const client = await pool.connect();
  let resolvedVersion: ResolvedVersionRow | null = null;
  let effectiveIsEnabled = true;

  try {
    await client.query("BEGIN");
    await ensureTenantRowsExist(client, [tenantId]);
    resolvedVersion = await resolveTestVersion(client, testId, versionId);
    const publication = await rollbackDomainContent(
      tenantId,
      "test",
      testId,
      resolvedVersion.version_id,
      {
        client,
        publishedAt: new Date()
      }
    );
    effectiveIsEnabled = publication.enabled;

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  if (!resolvedVersion) {
    throw new PublishWorkflowError("test_version_not_found", 404);
  }

  invalidateCaches(testId, [tenantId]);

  return {
    test_id: testId,
    version_id: resolvedVersion.version_id,
    version: resolvedVersion.version,
    tenant_ids: [tenantId],
    is_enabled: effectiveIsEnabled
  };
};

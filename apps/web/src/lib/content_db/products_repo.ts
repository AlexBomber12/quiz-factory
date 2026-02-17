import type { PoolClient } from "pg";

import { publishDomainContent } from "./domain_publications";
import { getContentDbPool } from "./pool";

type TimestampValue = Date | string;
type PgError = Error & { code?: string };

type ProductRow = {
  product_id: string;
  slug: string;
  created_at: TimestampValue;
  updated_at: TimestampValue;
};

type ProductVersionRow = {
  version_id: string;
  product_id: string;
  version: number;
  status: "draft" | "published" | "archived";
  spec_json: unknown;
  created_at: TimestampValue;
  created_by: string | null;
};

type AdminProductListRow = {
  product_id: string;
  slug: string;
  latest_version_id: string | null;
  latest_version: number | null;
  published_tenants_count: number | null;
};

type AdminProductPublicationRow = {
  tenant_id: string | null;
  is_enabled: boolean | null;
  published_version_id: string | null;
  published_version: number | null;
  published_at: TimestampValue | null;
};

type TenantPublishedProductRow = {
  tenant_id: string;
  product_id: string;
  slug: string;
  published_version_id: string;
  published_version: number;
  published_at: TimestampValue | null;
  spec_json: unknown;
};

export type ProductVersionStatus = "draft" | "published" | "archived";

export type AdminProductListRecord = {
  product_id: string;
  slug: string;
  latest_version_id: string | null;
  latest_version: number | null;
  published_tenants_count: number;
};

export type AdminProductRecord = {
  product_id: string;
  slug: string;
};

export type AdminProductVersionRecord = {
  version_id: string;
  product_id: string;
  version: number;
  status: ProductVersionStatus;
  spec_json: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
};

export type AdminProductPublicationRecord = {
  tenant_id: string;
  is_enabled: boolean;
  published_version_id: string | null;
  published_version: number | null;
  published_at: string | null;
};

export type AdminProductDetailRecord = {
  product: AdminProductRecord | null;
  versions: AdminProductVersionRecord[];
  publications: AdminProductPublicationRecord[];
};

export type ProductRecord = {
  product_id: string;
  slug: string;
  created_at: string;
  updated_at: string;
};

export type TenantPublishedProductRecord = {
  tenant_id: string;
  product_id: string;
  slug: string;
  published_version_id: string;
  published_version: number;
  published_at: string | null;
  spec: Record<string, unknown>;
};

export type PublishProductVersionInput = {
  product_id: string;
  version_id: string;
  tenant_id: string;
  is_enabled: boolean;
  published_at?: Date | null;
};

export type PublishProductVersionResult = {
  product_id: string;
  slug: string;
  tenant_id: string;
  version_id: string;
  version: number;
  is_enabled: boolean;
  published_at: string | null;
};

export type ListAdminProductsOptions = {
  q?: string | null;
  limit?: number | null;
};

export type ProductRepoErrorCode =
  | "invalid_slug"
  | "invalid_product_id"
  | "invalid_version_id"
  | "invalid_tenant_id"
  | "invalid_is_enabled"
  | "invalid_spec_json"
  | "product_exists"
  | "product_not_found"
  | "version_not_found"
  | "db_error";

export class ProductRepoError extends Error {
  code: ProductRepoErrorCode;
  status: number;
  detail: string | null;

  constructor(code: ProductRepoErrorCode, status: number, detail?: string | null) {
    super(detail ?? code);
    this.code = code;
    this.status = status;
    this.detail = detail ?? null;
  }
}

const PRODUCT_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PRODUCT_ID_RE = /^product-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LIST_ADMIN_PRODUCTS_MAX_LIMIT = 300;

const normalizeNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeSlug = (value: unknown): string | null => {
  const normalized = normalizeNonEmptyString(value)?.toLowerCase() ?? null;
  if (!normalized || !PRODUCT_SLUG_RE.test(normalized)) {
    return null;
  }

  return normalized;
};

const normalizeProductId = (value: unknown): string | null => {
  const normalized = normalizeNonEmptyString(value)?.toLowerCase() ?? null;
  if (!normalized || !PRODUCT_ID_RE.test(normalized)) {
    return null;
  }

  return normalized;
};

const normalizeVersionId = (value: unknown): string | null => {
  const normalized = normalizeNonEmptyString(value);
  if (!normalized || !UUID_RE.test(normalized)) {
    return null;
  }

  return normalized;
};

const normalizeStatus = (value: unknown): ProductVersionStatus | null => {
  if (value === "draft" || value === "published" || value === "archived") {
    return value;
  }

  return null;
};

const normalizeLimit = (value: number | null | undefined): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.floor(value);
  if (rounded < 1) {
    return 1;
  }

  return Math.min(rounded, LIST_ADMIN_PRODUCTS_MAX_LIMIT);
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

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const coerceSpecJson = (value: unknown): Record<string, unknown> => {
  if (!isObjectRecord(value)) {
    return {};
  }

  return value;
};

const requireSpecJson = (value: unknown): Record<string, unknown> => {
  if (!isObjectRecord(value)) {
    throw new ProductRepoError("invalid_spec_json", 400, "spec_json must be a JSON object.");
  }

  return value;
};

const ensureTenantRow = async (client: PoolClient, tenantId: string): Promise<void> => {
  await client.query(
    `
      INSERT INTO tenants (
        tenant_id,
        default_locale,
        enabled
      )
      VALUES ($1, 'en', TRUE)
      ON CONFLICT (tenant_id) DO NOTHING
    `,
    [tenantId]
  );
};

const resolveProduct = async (
  client: PoolClient,
  productId: string
): Promise<{ product_id: string; slug: string }> => {
  const { rows } = await client.query<{ product_id: string; slug: string }>(
    `
      SELECT product_id, slug
      FROM products
      WHERE product_id = $1
      LIMIT 1
    `,
    [productId]
  );

  const row = rows[0];
  if (!row) {
    throw new ProductRepoError("product_not_found", 404, `product_id '${productId}' not found.`);
  }

  const resolvedProductId = normalizeProductId(row.product_id);
  const resolvedSlug = normalizeSlug(row.slug);
  if (!resolvedProductId || !resolvedSlug) {
    throw new ProductRepoError("db_error", 500, "Unable to resolve product row.");
  }

  return {
    product_id: resolvedProductId,
    slug: resolvedSlug
  };
};

const resolveVersion = async (
  client: PoolClient,
  productId: string,
  versionId: string
): Promise<{ version_id: string; version: number }> => {
  const { rows } = await client.query<{ version_id: string; version: number }>(
    `
      SELECT
        id AS version_id,
        version
      FROM product_versions
      WHERE product_id = $1
        AND id = $2::uuid
      LIMIT 1
    `,
    [productId, versionId]
  );

  const row = rows[0];
  if (!row) {
    throw new ProductRepoError(
      "version_not_found",
      404,
      `version_id '${versionId}' does not belong to product_id '${productId}'.`
    );
  }

  const resolvedVersionId = normalizeVersionId(row.version_id);
  if (!resolvedVersionId || typeof row.version !== "number" || !Number.isFinite(row.version)) {
    throw new ProductRepoError("db_error", 500, "Unable to resolve product version row.");
  }

  return {
    version_id: resolvedVersionId,
    version: row.version
  };
};

const normalizeCount = (value: number | null | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
};

const isUniqueViolation = (error: unknown): boolean => {
  return Boolean(error) && typeof error === "object" && (error as PgError).code === "23505";
};

export const listAdminProducts = async (
  options: ListAdminProductsOptions = {}
): Promise<AdminProductListRecord[]> => {
  const queryText = normalizeNonEmptyString(options.q ?? null);
  const limit = normalizeLimit(options.limit ?? null);
  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (queryText) {
    params.push(`%${queryText}%`);
    whereClauses.push(`(p.product_id ILIKE $${params.length} OR p.slug ILIKE $${params.length})`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  let limitSql = "";
  if (limit !== null) {
    params.push(limit);
    limitSql = `LIMIT $${params.length}`;
  }

  const pool = getContentDbPool();
  const { rows } = await pool.query<AdminProductListRow>(
    `
      SELECT
        p.product_id,
        p.slug,
        latest.version_id AS latest_version_id,
        latest.version AS latest_version,
        COALESCE(published.published_tenants_count, 0) AS published_tenants_count
      FROM products p
      LEFT JOIN LATERAL (
        SELECT
          pv.id AS version_id,
          pv.version,
          pv.created_at
        FROM product_versions pv
        WHERE pv.product_id = p.product_id
        ORDER BY pv.version DESC, pv.created_at DESC
        LIMIT 1
      ) AS latest ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS published_tenants_count
        FROM domain_publications dp
        JOIN content_items ci
          ON ci.id = dp.content_item_id
        WHERE ci.content_type = 'product'
          AND ci.content_key = p.product_id
          AND dp.published_version_id IS NOT NULL
      ) AS published ON TRUE
      ${whereSql}
      ORDER BY COALESCE(latest.created_at, p.updated_at, p.created_at) DESC, p.slug ASC
      ${limitSql}
    `,
    params
  );

  return rows
    .map((row) => {
      const productId = normalizeProductId(row.product_id);
      const slug = normalizeSlug(row.slug);
      if (!productId || !slug) {
        return null;
      }

      return {
        product_id: productId,
        slug,
        latest_version_id: normalizeVersionId(row.latest_version_id),
        latest_version:
          typeof row.latest_version === "number" && Number.isFinite(row.latest_version)
            ? row.latest_version
            : null,
        published_tenants_count: normalizeCount(row.published_tenants_count)
      };
    })
    .filter((record): record is AdminProductListRecord => record !== null);
};

export const getAdminProductDetail = async (
  productIdInput: string
): Promise<AdminProductDetailRecord> => {
  const productId = normalizeProductId(productIdInput);
  if (!productId) {
    return {
      product: null,
      versions: [],
      publications: []
    };
  }

  const pool = getContentDbPool();
  const { rows: productRows } = await pool.query<ProductRow>(
    `
      SELECT
        product_id,
        slug,
        created_at,
        updated_at
      FROM products
      WHERE product_id = $1
      LIMIT 1
    `,
    [productId]
  );

  const productRow = productRows[0];
  if (!productRow) {
    return {
      product: null,
      versions: [],
      publications: []
    };
  }

  const resolvedProductId = normalizeProductId(productRow.product_id);
  const resolvedSlug = normalizeSlug(productRow.slug);
  if (!resolvedProductId || !resolvedSlug) {
    throw new ProductRepoError("db_error", 500, "Unable to read product detail.");
  }

  const [versionRows, publicationRows] = await Promise.all([
    pool.query<ProductVersionRow>(
      `
        SELECT
          id AS version_id,
          product_id,
          version,
          status,
          spec_json,
          created_at,
          created_by
        FROM product_versions
        WHERE product_id = $1
        ORDER BY version DESC, created_at DESC
      `,
      [resolvedProductId]
    ),
    pool.query<AdminProductPublicationRow>(
      `
        SELECT
          dp.tenant_id,
          dp.enabled AS is_enabled,
          dp.published_version_id,
          pv.version AS published_version,
          dp.published_at
        FROM domain_publications dp
        JOIN content_items ci
          ON ci.id = dp.content_item_id
        LEFT JOIN product_versions pv
          ON pv.id = dp.published_version_id
        WHERE ci.content_type = 'product'
          AND ci.content_key = $1
        ORDER BY dp.tenant_id ASC
      `,
      [resolvedProductId]
    )
  ]);

  const versions = versionRows.rows
    .map((row) => {
      const versionId = normalizeVersionId(row.version_id);
      const status = normalizeStatus(row.status);
      const rowProductId = normalizeProductId(row.product_id);
      const createdAt = toIsoString(row.created_at);

      if (
        !versionId ||
        !status ||
        !rowProductId ||
        !createdAt ||
        typeof row.version !== "number" ||
        !Number.isFinite(row.version)
      ) {
        return null;
      }

      return {
        version_id: versionId,
        product_id: rowProductId,
        version: row.version,
        status,
        spec_json: coerceSpecJson(row.spec_json),
        created_at: createdAt,
        created_by: normalizeNonEmptyString(row.created_by)
      };
    })
    .filter((row): row is AdminProductVersionRecord => row !== null);

  const publications = publicationRows.rows
    .map((row) => {
      const tenantId = normalizeNonEmptyString(row.tenant_id);
      if (!tenantId) {
        return null;
      }

      return {
        tenant_id: tenantId,
        is_enabled: row.is_enabled ?? false,
        published_version_id: normalizeVersionId(row.published_version_id),
        published_version:
          typeof row.published_version === "number" && Number.isFinite(row.published_version)
            ? row.published_version
            : null,
        published_at: toIsoString(row.published_at)
      };
    })
    .filter((row): row is AdminProductPublicationRecord => row !== null);

  return {
    product: {
      product_id: resolvedProductId,
      slug: resolvedSlug
    },
    versions,
    publications
  };
};

export const createProduct = async (slugInput: string): Promise<ProductRecord> => {
  const slug = normalizeSlug(slugInput);
  if (!slug) {
    throw new ProductRepoError(
      "invalid_slug",
      400,
      "slug must match /^[a-z0-9]+(?:-[a-z0-9]+)*$/."
    );
  }

  const productId = `product-${slug}`;
  const pool = getContentDbPool();

  try {
    const { rows } = await pool.query<ProductRow>(
      `
        INSERT INTO products (
          product_id,
          slug
        )
        VALUES ($1, $2)
        RETURNING
          product_id,
          slug,
          created_at,
          updated_at
      `,
      [productId, slug]
    );

    const row = rows[0];
    if (!row) {
      throw new ProductRepoError("db_error", 500, "Unable to create product.");
    }

    const resolvedProductId = normalizeProductId(row.product_id);
    const resolvedSlug = normalizeSlug(row.slug);
    if (!resolvedProductId || !resolvedSlug) {
      throw new ProductRepoError("db_error", 500, "Unable to create product.");
    }

    return {
      product_id: resolvedProductId,
      slug: resolvedSlug,
      created_at: toIsoString(row.created_at) ?? "",
      updated_at: toIsoString(row.updated_at) ?? ""
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ProductRepoError("product_exists", 409, `product '${productId}' already exists.`);
    }

    throw error;
  }
};

export const createProductDraftVersion = async (
  productIdInput: string,
  specJsonInput: unknown,
  createdByInput?: string | null
): Promise<AdminProductVersionRecord> => {
  const productId = normalizeProductId(productIdInput);
  if (!productId) {
    throw new ProductRepoError("invalid_product_id", 400);
  }

  const specJson = requireSpecJson(specJsonInput);
  const createdBy = normalizeNonEmptyString(createdByInput ?? null);
  const pool = getContentDbPool();
  const { rows } = await pool.query<ProductVersionRow>(
    `
      WITH next_version AS (
        SELECT COALESCE(MAX(version), 0) + 1 AS version
        FROM product_versions
        WHERE product_id = $1
      )
      INSERT INTO product_versions (
        product_id,
        version,
        status,
        spec_json,
        created_by
      )
      SELECT
        p.product_id,
        next_version.version,
        'draft',
        $2::jsonb,
        $3
      FROM products p
      CROSS JOIN next_version
      WHERE p.product_id = $1
      RETURNING
        id AS version_id,
        product_id,
        version,
        status,
        spec_json,
        created_at,
        created_by
    `,
    [productId, specJson, createdBy]
  );

  const row = rows[0];
  if (!row) {
    throw new ProductRepoError("product_not_found", 404, `product_id '${productId}' not found.`);
  }

  const versionId = normalizeVersionId(row.version_id);
  const rowProductId = normalizeProductId(row.product_id);
  const status = normalizeStatus(row.status);
  const createdAt = toIsoString(row.created_at);
  if (
    !versionId ||
    !rowProductId ||
    !status ||
    !createdAt ||
    typeof row.version !== "number" ||
    !Number.isFinite(row.version)
  ) {
    throw new ProductRepoError("db_error", 500, "Unable to create product version.");
  }

  return {
    version_id: versionId,
    product_id: rowProductId,
    version: row.version,
    status,
    spec_json: coerceSpecJson(row.spec_json),
    created_at: createdAt,
    created_by: normalizeNonEmptyString(row.created_by)
  };
};

export const publishProductVersionToTenant = async (
  input: PublishProductVersionInput
): Promise<PublishProductVersionResult> => {
  const productId = normalizeProductId(input.product_id);
  if (!productId) {
    throw new ProductRepoError("invalid_product_id", 400);
  }

  const versionId = normalizeVersionId(input.version_id);
  if (!versionId) {
    throw new ProductRepoError("invalid_version_id", 400);
  }

  const tenantId = normalizeNonEmptyString(input.tenant_id);
  if (!tenantId) {
    throw new ProductRepoError("invalid_tenant_id", 400);
  }

  if (typeof input.is_enabled !== "boolean") {
    throw new ProductRepoError("invalid_is_enabled", 400);
  }

  const pool = getContentDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const product = await resolveProduct(client, productId);
    const version = await resolveVersion(client, productId, versionId);
    await ensureTenantRow(client, tenantId);

    const publication = await publishDomainContent(
      tenantId,
      "product",
      product.product_id,
      version.version_id,
      input.is_enabled,
      {
        client,
        slug: product.slug,
        publishedAt: input.published_at ?? new Date()
      }
    );

    await client.query(
      `
        UPDATE product_versions
        SET status = 'published'
        WHERE product_id = $1
          AND id = $2::uuid
      `,
      [product.product_id, version.version_id]
    );

    await client.query("COMMIT");

    return {
      product_id: product.product_id,
      slug: product.slug,
      tenant_id: tenantId,
      version_id: version.version_id,
      version: version.version,
      is_enabled: publication.enabled,
      published_at: publication.published_at
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const listTenantProducts = async (
  tenantIdInput: string
): Promise<TenantPublishedProductRecord[]> => {
  const tenantId = normalizeNonEmptyString(tenantIdInput);
  if (!tenantId) {
    return [];
  }

  const pool = getContentDbPool();
  const { rows } = await pool.query<TenantPublishedProductRow>(
    `
      SELECT
        dp.tenant_id,
        p.product_id,
        p.slug,
        dp.published_version_id,
        pv.version AS published_version,
        dp.published_at,
        pv.spec_json
      FROM domain_publications dp
      JOIN content_items ci
        ON ci.id = dp.content_item_id
      JOIN products p
        ON ci.content_type = 'product'
        AND ci.content_key = p.product_id
      JOIN product_versions pv
        ON pv.id = dp.published_version_id
      WHERE dp.tenant_id = $1
        AND dp.enabled = TRUE
      ORDER BY p.slug ASC
    `,
    [tenantId]
  );

  return rows
    .map((row) => {
      const productId = normalizeProductId(row.product_id);
      const slug = normalizeSlug(row.slug);
      const versionId = normalizeVersionId(row.published_version_id);

      if (
        !productId ||
        !slug ||
        !versionId ||
        typeof row.published_version !== "number" ||
        !Number.isFinite(row.published_version)
      ) {
        return null;
      }

      return {
        tenant_id: row.tenant_id,
        product_id: productId,
        slug,
        published_version_id: versionId,
        published_version: row.published_version,
        published_at: toIsoString(row.published_at),
        spec: coerceSpecJson(row.spec_json)
      };
    })
    .filter((row): row is TenantPublishedProductRecord => row !== null);
};

export const getPublishedProductBySlug = async (
  tenantIdInput: string,
  slugInput: string
): Promise<TenantPublishedProductRecord | null> => {
  const tenantId = normalizeNonEmptyString(tenantIdInput);
  const slug = normalizeSlug(slugInput);
  if (!tenantId || !slug) {
    return null;
  }

  const pool = getContentDbPool();
  const { rows } = await pool.query<TenantPublishedProductRow>(
    `
      SELECT
        dp.tenant_id,
        p.product_id,
        p.slug,
        dp.published_version_id,
        pv.version AS published_version,
        dp.published_at,
        pv.spec_json
      FROM domain_publications dp
      JOIN content_items ci
        ON ci.id = dp.content_item_id
      JOIN products p
        ON ci.content_type = 'product'
        AND ci.content_key = p.product_id
      JOIN product_versions pv
        ON pv.id = dp.published_version_id
      WHERE dp.tenant_id = $1
        AND p.slug = $2
        AND dp.enabled = TRUE
      LIMIT 1
    `,
    [tenantId, slug]
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  const productId = normalizeProductId(row.product_id);
  const versionId = normalizeVersionId(row.published_version_id);
  const resolvedSlug = normalizeSlug(row.slug);
  if (
    !productId ||
    !versionId ||
    !resolvedSlug ||
    typeof row.published_version !== "number" ||
    !Number.isFinite(row.published_version)
  ) {
    throw new ProductRepoError("db_error", 500, "Unable to read published product.");
  }

  return {
    tenant_id: row.tenant_id,
    product_id: productId,
    slug: resolvedSlug,
    published_version_id: versionId,
    published_version: row.published_version,
    published_at: toIsoString(row.published_at),
    spec: coerceSpecJson(row.spec_json)
  };
};

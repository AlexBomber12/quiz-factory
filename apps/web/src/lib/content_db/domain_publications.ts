import type { PoolClient } from "pg";

import { getContentDbPool } from "./pool";

type TimestampValue = Date | string;

type ContentItemRow = {
  id: string;
  content_type: string;
  content_key: string;
  slug: string;
  created_at: TimestampValue;
  updated_at: TimestampValue;
};

type DomainPublicationRow = {
  id: string;
  tenant_id: string;
  published_version_id: string | null;
  enabled: boolean;
  published_at: TimestampValue | null;
  created_at: TimestampValue;
  updated_at: TimestampValue;
};

type DomainPublicationJoinedRow = {
  id: string;
  tenant_id: string;
  content_type: string;
  content_key: string;
  slug: string;
  published_version_id: string | null;
  enabled: boolean;
  published_at: TimestampValue | null;
  created_at: TimestampValue;
  updated_at: TimestampValue;
};

type TestSlugRow = {
  slug: string;
};

type QueryRunner = {
  query: PoolClient["query"];
};

export type ContentItemRecord = {
  id: string;
  content_type: string;
  content_key: string;
  slug: string;
  created_at: string;
  updated_at: string;
};

export type DomainPublicationRecord = {
  id: string;
  tenant_id: string;
  content_type: string;
  content_key: string;
  slug: string;
  published_version_id: string | null;
  enabled: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ListDomainPublicationsFilters = {
  content_type?: string | null;
  content_key?: string | null;
  only_enabled?: boolean | null;
  only_published?: boolean | null;
};

type RepoOptions = {
  client?: PoolClient | null;
};

type MutationOptions = RepoOptions & {
  publishedAt?: TimestampValue | null;
  slug?: string | null;
};

type ListContentItemsFilters = {
  content_type?: string | null;
};

const normalizeNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeContentType = (value: unknown): string | null => {
  const normalized = normalizeNonEmptyString(value);
  if (!normalized) {
    return null;
  }

  return normalized.toLowerCase();
};

const normalizeContentKey = (value: unknown): string | null => {
  return normalizeNonEmptyString(value);
};

const normalizeSlug = (value: unknown): string | null => {
  const normalized = normalizeNonEmptyString(value);
  if (!normalized) {
    return null;
  }

  return normalized.toLowerCase();
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

const getQueryRunner = (options?: RepoOptions): QueryRunner => {
  return (options?.client ?? getContentDbPool()) as QueryRunner;
};

const toContentItemRecord = (row: ContentItemRow): ContentItemRecord => {
  return {
    id: row.id,
    content_type: row.content_type,
    content_key: row.content_key,
    slug: row.slug,
    created_at: toIsoString(row.created_at) ?? "",
    updated_at: toIsoString(row.updated_at) ?? ""
  };
};

const toDomainPublicationRecord = (
  row: DomainPublicationRow,
  contentItem: ContentItemRecord
): DomainPublicationRecord => {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    content_type: contentItem.content_type,
    content_key: contentItem.content_key,
    slug: contentItem.slug,
    published_version_id: row.published_version_id,
    enabled: row.enabled,
    published_at: toIsoString(row.published_at),
    created_at: toIsoString(row.created_at) ?? "",
    updated_at: toIsoString(row.updated_at) ?? ""
  };
};

const resolveSlugForContent = async (
  runner: QueryRunner,
  contentType: string,
  contentKey: string,
  slugHint?: string | null
): Promise<string> => {
  const normalizedHint = normalizeSlug(slugHint);
  if (normalizedHint) {
    return normalizedHint;
  }

  if (contentType === "test") {
    const { rows } = await runner.query<TestSlugRow>(
      `
        SELECT slug
        FROM tests
        WHERE test_id = $1
        LIMIT 1
      `,
      [contentKey]
    );
    const slug = normalizeSlug(rows[0]?.slug);
    if (!slug) {
      throw new Error(`Unable to resolve slug for test content_key '${contentKey}'.`);
    }
    return slug;
  }

  return contentKey.toLowerCase();
};

export const upsertContentItem = async (
  contentTypeInput: string,
  contentKeyInput: string,
  slugInput: string,
  options: RepoOptions = {}
): Promise<ContentItemRecord> => {
  const contentType = normalizeContentType(contentTypeInput);
  if (!contentType) {
    throw new Error("content_type is required.");
  }

  const contentKey = normalizeContentKey(contentKeyInput);
  if (!contentKey) {
    throw new Error("content_key is required.");
  }

  const slug = normalizeSlug(slugInput);
  if (!slug) {
    throw new Error("slug is required.");
  }

  const runner = getQueryRunner(options);
  const { rows } = await runner.query<ContentItemRow>(
    `
      INSERT INTO content_items (
        content_type,
        content_key,
        slug
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (content_type, content_key) DO UPDATE
      SET slug = EXCLUDED.slug
      RETURNING
        id,
        content_type,
        content_key,
        slug,
        created_at,
        updated_at
    `,
    [contentType, contentKey, slug]
  );

  const row = rows[0];
  if (!row) {
    throw new Error("Unable to upsert content item.");
  }

  return toContentItemRecord(row);
};

export const listContentItems = async (
  filters: ListContentItemsFilters = {},
  options: RepoOptions = {}
): Promise<ContentItemRecord[]> => {
  const contentType = normalizeContentType(filters.content_type);
  const values: unknown[] = [];
  const where: string[] = [];

  if (contentType) {
    values.push(contentType);
    where.push(`content_type = $${values.length}`);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const runner = getQueryRunner(options);
  const { rows } = await runner.query<ContentItemRow>(
    `
      SELECT
        id,
        content_type,
        content_key,
        slug,
        created_at,
        updated_at
      FROM content_items
      ${whereClause}
      ORDER BY content_type ASC, slug ASC, content_key ASC
    `,
    values
  );

  return rows.map((row) => toContentItemRecord(row));
};

export const listDomainPublications = async (
  tenantIdInput: string | null,
  filters: ListDomainPublicationsFilters = {},
  options: RepoOptions = {}
): Promise<DomainPublicationRecord[]> => {
  const tenantId = normalizeNonEmptyString(tenantIdInput);
  const contentType = normalizeContentType(filters.content_type);
  const contentKey = normalizeContentKey(filters.content_key);
  const values: unknown[] = [];
  const where: string[] = [];

  if (tenantId) {
    values.push(tenantId);
    where.push(`dp.tenant_id = $${values.length}`);
  }

  if (contentType) {
    values.push(contentType);
    where.push(`ci.content_type = $${values.length}`);
  }

  if (contentKey) {
    values.push(contentKey);
    where.push(`ci.content_key = $${values.length}`);
  }

  if (filters.only_enabled) {
    where.push("dp.enabled = TRUE");
  }

  if (filters.only_published) {
    where.push("dp.published_version_id IS NOT NULL");
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const runner = getQueryRunner(options);
  const { rows } = await runner.query<DomainPublicationJoinedRow>(
    `
      SELECT
        dp.id,
        dp.tenant_id,
        ci.content_type,
        ci.content_key,
        ci.slug,
        dp.published_version_id,
        dp.enabled,
        dp.published_at,
        dp.created_at,
        dp.updated_at
      FROM domain_publications dp
      JOIN content_items ci
        ON ci.id = dp.content_item_id
      ${whereClause}
      ORDER BY dp.tenant_id ASC, ci.content_type ASC, ci.slug ASC, ci.content_key ASC
    `,
    values
  );

  return rows.map((row) => ({
    id: row.id,
    tenant_id: row.tenant_id,
    content_type: row.content_type,
    content_key: row.content_key,
    slug: row.slug,
    published_version_id: row.published_version_id,
    enabled: row.enabled,
    published_at: toIsoString(row.published_at),
    created_at: toIsoString(row.created_at) ?? "",
    updated_at: toIsoString(row.updated_at) ?? ""
  }));
};

export const publishDomainContent = async (
  tenantIdInput: string,
  contentTypeInput: string,
  contentKeyInput: string,
  publishedVersionIdInput: string | null,
  enabled: boolean,
  options: MutationOptions = {}
): Promise<DomainPublicationRecord> => {
  const tenantId = normalizeNonEmptyString(tenantIdInput);
  if (!tenantId) {
    throw new Error("tenant_id is required.");
  }

  const contentType = normalizeContentType(contentTypeInput);
  if (!contentType) {
    throw new Error("content_type is required.");
  }

  const contentKey = normalizeContentKey(contentKeyInput);
  if (!contentKey) {
    throw new Error("content_key is required.");
  }

  if (typeof enabled !== "boolean") {
    throw new Error("enabled must be a boolean.");
  }

  const publishedVersionId = normalizeNonEmptyString(publishedVersionIdInput);
  const runner = getQueryRunner(options);
  const slug = await resolveSlugForContent(runner, contentType, contentKey, options.slug);
  const contentItem = await upsertContentItem(contentType, contentKey, slug, {
    client: options.client
  });

  const { rows } = await runner.query<DomainPublicationRow>(
    `
      INSERT INTO domain_publications (
        tenant_id,
        content_item_id,
        published_version_id,
        enabled,
        published_at
      )
      VALUES ($1, $2::uuid, $3::uuid, $4, COALESCE($5::timestamptz, now()))
      ON CONFLICT (tenant_id, content_item_id) DO UPDATE
      SET
        published_version_id = EXCLUDED.published_version_id,
        enabled = EXCLUDED.enabled,
        published_at = EXCLUDED.published_at
      RETURNING
        id,
        tenant_id,
        published_version_id,
        enabled,
        published_at,
        created_at,
        updated_at
    `,
    [tenantId, contentItem.id, publishedVersionId, enabled, options.publishedAt ?? null]
  );

  const row = rows[0];
  if (!row) {
    throw new Error("Unable to publish domain content.");
  }

  return toDomainPublicationRecord(row, contentItem);
};

export const rollbackDomainContent = async (
  tenantIdInput: string,
  contentTypeInput: string,
  contentKeyInput: string,
  previousVersionIdInput: string,
  options: MutationOptions = {}
): Promise<DomainPublicationRecord> => {
  const tenantId = normalizeNonEmptyString(tenantIdInput);
  if (!tenantId) {
    throw new Error("tenant_id is required.");
  }

  const contentType = normalizeContentType(contentTypeInput);
  if (!contentType) {
    throw new Error("content_type is required.");
  }

  const contentKey = normalizeContentKey(contentKeyInput);
  if (!contentKey) {
    throw new Error("content_key is required.");
  }

  const previousVersionId = normalizeNonEmptyString(previousVersionIdInput);
  if (!previousVersionId) {
    throw new Error("previous_version_id is required.");
  }

  const runner = getQueryRunner(options);
  const slug = await resolveSlugForContent(runner, contentType, contentKey, options.slug);
  const contentItem = await upsertContentItem(contentType, contentKey, slug, {
    client: options.client
  });

  const { rows } = await runner.query<DomainPublicationRow>(
    `
      WITH existing AS (
        SELECT enabled
        FROM domain_publications
        WHERE tenant_id = $1
          AND content_item_id = $2::uuid
      )
      INSERT INTO domain_publications (
        tenant_id,
        content_item_id,
        published_version_id,
        enabled,
        published_at
      )
      VALUES (
        $1,
        $2::uuid,
        $3::uuid,
        COALESCE((SELECT enabled FROM existing), TRUE),
        COALESCE($4::timestamptz, now())
      )
      ON CONFLICT (tenant_id, content_item_id) DO UPDATE
      SET
        published_version_id = EXCLUDED.published_version_id,
        published_at = EXCLUDED.published_at
      RETURNING
        id,
        tenant_id,
        published_version_id,
        enabled,
        published_at,
        created_at,
        updated_at
    `,
    [tenantId, contentItem.id, previousVersionId, options.publishedAt ?? null]
  );

  const row = rows[0];
  if (!row) {
    throw new Error("Unable to rollback domain content.");
  }

  return toDomainPublicationRecord(row, contentItem);
};

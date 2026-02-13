import { getContentDbPool } from "../content_db/pool";

type AdminTestsRow = {
  test_id: string;
  slug: string;
  latest_version_id: string | null;
  latest_version: number | null;
  locales: unknown;
  published_tenants_count: number | null;
};

export type AdminTestListRecord = {
  test_id: string;
  slug: string;
  latest_version_id: string | null;
  latest_version: number | null;
  locales: string[];
  published_tenants_count: number;
};

export type ListAdminTestsOptions = {
  q?: string | null;
  limit?: number | null;
};

const LIST_ADMIN_TESTS_MAX_LIMIT = 300;

const normalizeNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeLimit = (value: number | null | undefined): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.floor(value);
  if (rounded < 1) {
    return 1;
  }

  return Math.min(rounded, LIST_ADMIN_TESTS_MAX_LIMIT);
};

const normalizeLocales = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeNonEmptyString(entry))
    .filter((entry): entry is string => entry !== null)
    .sort((left, right) => left.localeCompare(right));
};

const normalizeCount = (value: number | null): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
};

export const listAdminTests = async (
  options?: ListAdminTestsOptions
): Promise<AdminTestListRecord[]> => {
  const queryText = normalizeNonEmptyString(options?.q ?? null);
  const limit = normalizeLimit(options?.limit ?? null);
  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (queryText) {
    params.push(`%${queryText}%`);
    whereClauses.push(`(t.test_id ILIKE $${params.length} OR t.slug ILIKE $${params.length})`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  let limitSql = "";
  if (limit !== null) {
    params.push(limit);
    limitSql = `LIMIT $${params.length}`;
  }

  const pool = getContentDbPool();
  let rows: AdminTestsRow[];

  try {
    const result = await pool.query<AdminTestsRow>(
      `
        SELECT
          t.test_id,
          t.slug,
          latest.version_id AS latest_version_id,
          latest.version AS latest_version,
          COALESCE(latest.locales, ARRAY[]::text[]) AS locales,
          COALESCE(published.published_tenants_count, 0) AS published_tenants_count
        FROM tests t
        LEFT JOIN LATERAL (
          SELECT
            latest_tv.id AS version_id,
            latest_tv.version,
            latest_tv.created_at,
            COALESCE(
              (
                SELECT ARRAY_AGG(locale.locale_key ORDER BY locale.locale_key)
                FROM jsonb_object_keys(
                  CASE
                    WHEN jsonb_typeof(latest_tv.spec_json -> 'locales') = 'object'
                      THEN latest_tv.spec_json -> 'locales'
                    ELSE '{}'::jsonb
                  END
                ) AS locale(locale_key)
              ),
              ARRAY[]::text[]
            ) AS locales
          FROM test_versions latest_tv
          WHERE latest_tv.test_id = t.id
          ORDER BY latest_tv.version DESC, latest_tv.created_at DESC
          LIMIT 1
        ) AS latest ON TRUE
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS published_tenants_count
          FROM tenant_tests tt
          WHERE tt.test_id = t.id
            AND tt.published_version_id IS NOT NULL
        ) AS published ON TRUE
        ${whereSql}
        ORDER BY COALESCE(latest.created_at, t.updated_at, t.created_at) DESC, t.slug ASC
        ${limitSql}
      `,
      params
    );
    rows = result.rows;
  } catch {
    throw new Error("Unable to load tests.");
  }

  return rows
    .map((row) => {
      const testId = normalizeNonEmptyString(row.test_id);
      const slug = normalizeNonEmptyString(row.slug);
      if (!testId || !slug) {
        return null;
      }

      return {
        test_id: testId,
        slug,
        latest_version_id: normalizeNonEmptyString(row.latest_version_id),
        latest_version:
          typeof row.latest_version === "number" && Number.isFinite(row.latest_version)
            ? row.latest_version
            : null,
        locales: normalizeLocales(row.locales),
        published_tenants_count: normalizeCount(row.published_tenants_count)
      };
    })
    .filter((record): record is AdminTestListRecord => record !== null);
};

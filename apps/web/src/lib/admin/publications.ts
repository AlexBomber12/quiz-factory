import {
  listContentItems,
  listDomainPublications,
  type ContentItemRecord
} from "../content_db/domain_publications";
import { getContentDbPool } from "../content_db/pool";

type TenantDomainRow = {
  tenant_id: string | null;
  domain: string | null;
};

type PublicationState = {
  published_version_id: string | null;
  is_enabled: boolean;
  updated_at: string | null;
};

export type AdminPublicationRow = {
  tenant_id: string;
  domains: string[];
  content_type: string;
  content_key: string;
  slug: string;
  published_version_id: string | null;
  is_enabled: boolean;
  updated_at: string | null;
};

export type ListAdminPublicationsFilters = {
  q?: string | null;
  tenant_id?: string | null;
  content_type?: string | null;
  content_key?: string | null;
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

const buildPublicationKey = (
  tenantId: string,
  contentType: string,
  contentKey: string
): string => {
  return `${tenantId}::${contentType}::${contentKey}`;
};

const loadTenantDomainsByTenant = async (): Promise<Map<string, string[]>> => {
  const pool = getContentDbPool();
  const result = await pool.query<TenantDomainRow>(
    `
      SELECT
        t.tenant_id,
        td.domain
      FROM tenants t
      LEFT JOIN tenant_domains td
        ON td.tenant_id = t.tenant_id
      ORDER BY t.tenant_id ASC, td.domain ASC
    `
  );

  const output = new Map<string, string[]>();
  for (const row of result.rows) {
    const tenantId = normalizeNonEmptyString(row.tenant_id);
    if (!tenantId) {
      continue;
    }

    if (!output.has(tenantId)) {
      output.set(tenantId, []);
    }

    const domain = normalizeNonEmptyString(row.domain);
    if (!domain) {
      continue;
    }

    const domains = output.get(tenantId);
    if (!domains) {
      continue;
    }

    if (!domains.includes(domain)) {
      domains.push(domain);
      domains.sort((left, right) => left.localeCompare(right));
    }
  }

  return output;
};

const matchesQuery = (row: AdminPublicationRow, queryText: string): boolean => {
  const normalizedQuery = queryText.toLowerCase();

  if (row.tenant_id.toLowerCase().includes(normalizedQuery)) {
    return true;
  }
  if (row.content_type.toLowerCase().includes(normalizedQuery)) {
    return true;
  }
  if (row.content_key.toLowerCase().includes(normalizedQuery)) {
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

  const contentTypeCompare = left.content_type.localeCompare(right.content_type);
  if (contentTypeCompare !== 0) {
    return contentTypeCompare;
  }

  const slugCompare = left.slug.localeCompare(right.slug);
  if (slugCompare !== 0) {
    return slugCompare;
  }

  return left.content_key.localeCompare(right.content_key);
};

const applyContentKeyFilter = (
  items: ContentItemRecord[],
  contentKeyFilter: string | null
): ContentItemRecord[] => {
  if (!contentKeyFilter) {
    return items;
  }

  return items.filter((item) => item.content_key === contentKeyFilter);
};

export const listAdminPublications = async (
  filters?: ListAdminPublicationsFilters
): Promise<AdminPublicationRow[]> => {
  const queryText = normalizeFilterText(filters?.q);
  const tenantFilter = normalizeFilterText(filters?.tenant_id);
  const contentTypeFilter = normalizeFilterText(filters?.content_type)?.toLowerCase() ?? null;
  const contentKeyFilter = normalizeFilterText(filters?.content_key ?? filters?.test_id);
  const onlyPublished = normalizeBooleanFilter(filters?.only_published);
  const onlyEnabled = normalizeBooleanFilter(filters?.only_enabled);

  const [tenantDomainsByTenant, contentItems, publicationRows] = await Promise.all([
    loadTenantDomainsByTenant(),
    listContentItems({
      content_type: contentTypeFilter
    }),
    listDomainPublications(tenantFilter, {
      content_type: contentTypeFilter,
      content_key: contentKeyFilter
    })
  ]);

  if (tenantFilter && !tenantDomainsByTenant.has(tenantFilter)) {
    return [];
  }

  const filteredContentItems = applyContentKeyFilter(contentItems, contentKeyFilter);
  if (filteredContentItems.length === 0) {
    return [];
  }

  const stateByPublication = new Map<string, PublicationState>();
  for (const row of publicationRows) {
    stateByPublication.set(
      buildPublicationKey(row.tenant_id, row.content_type, row.content_key),
      {
        published_version_id: row.published_version_id,
        is_enabled: row.enabled,
        updated_at: row.updated_at
      }
    );
  }

  const tenantIds = tenantFilter
    ? [tenantFilter]
    : Array.from(tenantDomainsByTenant.keys()).sort((left, right) => left.localeCompare(right));

  const publications: AdminPublicationRow[] = [];
  for (const tenantId of tenantIds) {
    const domains = [...(tenantDomainsByTenant.get(tenantId) ?? [])];
    for (const item of filteredContentItems) {
      const state = stateByPublication.get(
        buildPublicationKey(tenantId, item.content_type, item.content_key)
      );

      const row: AdminPublicationRow = {
        tenant_id: tenantId,
        domains,
        content_type: item.content_type,
        content_key: item.content_key,
        slug: item.slug,
        published_version_id: state?.published_version_id ?? null,
        is_enabled: state?.is_enabled ?? false,
        updated_at: state?.updated_at ?? null
      };

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

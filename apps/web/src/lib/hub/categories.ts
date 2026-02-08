import { getEstimatedMinutes } from "../content/estimated_minutes";
import {
  listCatalogForTenant,
  loadPublishedTestBySlug,
  type TenantCatalogRecord
} from "../content/provider";

export type HubTest = {
  test_id: string;
  slug: string;
  title: string;
  short_description: string;
  estimated_minutes: number;
  category: string;
  category_slug: string;
};

export type HubCategory = {
  slug: string;
  label: string;
  test_count: number;
};

const removeUnsupportedCharacters = (value: string): string => {
  return value.replace(/[^a-z0-9-]/g, "");
};

const collapseHyphens = (value: string): string => {
  return value.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
};

const normalizeCategoryLabel = (value: string): string | null => {
  const label = value.trim();
  return label.length > 0 ? label : null;
};

const decodeCategoryParam = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const toCategorySlug = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  const withHyphens = normalized.replace(/[\s_]+/g, "-");
  const filtered = removeUnsupportedCharacters(withHyphens);
  return collapseHyphens(filtered);
};

export const normalizeCategoryParam = (value: string): string => {
  return toCategorySlug(decodeCategoryParam(value));
};

const buildHubTestsFromCatalog = async (
  tenantId: string,
  locale: string,
  catalog: ReadonlyArray<TenantCatalogRecord>
): Promise<HubTest[]> => {
  if (catalog.length === 0) {
    return [];
  }

  const tests: HubTest[] = [];

  for (const entry of catalog) {
    const published = await loadPublishedTestBySlug(tenantId, entry.slug, locale);
    if (!published) {
      continue;
    }

    const categoryLabel =
      normalizeCategoryLabel(published.test.category) ??
      normalizeCategoryLabel(published.spec.category) ??
      "";

    tests.push({
      test_id: published.test_id,
      slug: published.slug,
      title: published.test.title,
      short_description: published.test.description,
      estimated_minutes: getEstimatedMinutes(published.spec),
      category: categoryLabel,
      category_slug: toCategorySlug(categoryLabel)
    });
  }

  return tests;
};

export const loadTenantHubTests = async (
  tenantId: string,
  locale: string
): Promise<HubTest[]> => {
  const catalog = await listCatalogForTenant(tenantId);
  return buildHubTestsFromCatalog(tenantId, locale, catalog);
};

const collectCategories = (tests: ReadonlyArray<HubTest>): HubCategory[] => {
  const categories = new Map<string, HubCategory>();

  for (const test of tests) {
    if (!test.category_slug || !test.category) {
      continue;
    }

    const existing = categories.get(test.category_slug);
    if (existing) {
      existing.test_count += 1;
      continue;
    }

    categories.set(test.category_slug, {
      slug: test.category_slug,
      label: test.category,
      test_count: 1
    });
  }

  return [...categories.values()].sort((left, right) => {
    const labelComparison = left.label.localeCompare(right.label);
    if (labelComparison !== 0) {
      return labelComparison;
    }

    return left.slug.localeCompare(right.slug);
  });
};

export const deriveTenantCategories = async (
  tenantId: string,
  locale: string
): Promise<HubCategory[]> => {
  const tests = await loadTenantHubTests(tenantId, locale);
  return collectCategories(tests);
};

export const deriveCategoriesFromCatalog = async (
  tenantId: string,
  locale: string,
  catalog: ReadonlyArray<TenantCatalogRecord>
): Promise<HubCategory[]> => {
  const tests = await buildHubTestsFromCatalog(tenantId, locale, catalog);
  return collectCategories(tests);
};

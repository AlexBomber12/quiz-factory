import { getEstimatedMinutes } from "../content/estimated_minutes";
import { listCatalogForTenant, loadPublishedTestBySlug } from "../content/provider";

export type CatalogTest = {
  test_id: string;
  slug: string;
  title: string;
  short_description: string;
  estimated_minutes: number;
};

export const loadTenantCatalog = async (
  tenantId: string,
  locale: string
): Promise<CatalogTest[]> => {
  const catalog = await listCatalogForTenant(tenantId);
  if (catalog.length === 0) {
    return [];
  }

  const tests: CatalogTest[] = [];

  for (const entry of catalog) {
    const published = await loadPublishedTestBySlug(tenantId, entry.slug, locale);
    if (!published) {
      continue;
    }

    tests.push({
      test_id: published.test_id,
      slug: published.slug,
      title: published.test.title,
      short_description: published.test.description,
      estimated_minutes: getEstimatedMinutes(published.spec)
    });
  }

  return tests;
};

export const resolveTenantTestBySlug = async (
  tenantId: string,
  locale: string,
  slug: string
): Promise<CatalogTest | null> => {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) {
    return null;
  }

  const tests = await loadTenantCatalog(tenantId, locale);
  return tests.find((test) => test.slug === normalizedSlug) ?? null;
};

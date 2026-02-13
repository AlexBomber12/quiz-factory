import type { Metadata } from "next";

import { TenantTestExplorer } from "../../components/public/TenantTestExplorer";
import {
  loadTenantHubTests,
  type HubCategory,
  type HubTest
} from "../../lib/hub/categories";
import { buildHubPageMetadata } from "../../lib/hub/metadata";
import { resolveTenantContext } from "../../lib/tenants/request";

type PageProps = {
  searchParams?:
    | {
        q?: string | string[];
      }
    | Promise<{
        q?: string | string[];
      }>;
};

const normalizeQueryParam = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
};

const deriveCategoriesFromTests = (tests: ReadonlyArray<HubTest>): HubCategory[] => {
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

export const generateMetadata = async (): Promise<Metadata> => {
  return buildHubPageMetadata({
    path: "/tests",
    title: "Tests",
    description: "Search and browse available tests."
  });
};

export default async function TestsPage({ searchParams }: PageProps) {
  const context = await resolveTenantContext();
  const tests = await loadTenantHubTests(context.tenantId, context.locale);
  const categories = deriveCategoriesFromTests(tests);
  const resolvedSearchParams = await searchParams;
  const query = normalizeQueryParam(resolvedSearchParams?.q);

  return (
    <section>
      <TenantTestExplorer
        tests={tests}
        categories={categories}
        heading="Tests"
        subheading="Explore self-assessments and start the one that fits your goals today."
        initialSearchValue={query}
        includeCategoryInSearch={false}
        sectionHeading="All Assessments"
        showViewAllLink={false}
      />
    </section>
  );
}

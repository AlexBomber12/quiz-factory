import type { Metadata } from "next";

import { TenantTestExplorer } from "../../components/public/TenantTestExplorer";
import { deriveTenantCategories, loadTenantHubTests } from "../../lib/hub/categories";
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

export const generateMetadata = async (): Promise<Metadata> => {
  return buildHubPageMetadata({
    path: "/tests",
    title: "Tests",
    description: "Search and browse available tests."
  });
};

export default async function TestsPage({ searchParams }: PageProps) {
  const context = await resolveTenantContext();
  const [tests, categories] = await Promise.all([
    loadTenantHubTests(context.tenantId, context.locale),
    deriveTenantCategories(context.tenantId, context.locale)
  ]);
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

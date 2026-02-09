import type { Metadata } from "next";

import { PublicNav } from "../components/public/PublicNav";
import {
  TenantTestExplorer,
  type TenantExplorerTest
} from "../components/public/TenantTestExplorer";
import { deriveTenantCategories, loadTenantHubTests } from "../lib/hub/categories";
import {
  buildCanonical,
  buildLocaleAlternatesForPath,
  buildOpenGraphLocales,
  buildTenantLabel,
  resolveTenantSeoContext
} from "../lib/seo/metadata";
import {
  getTenantProfile,
  resolveHomepageCopy,
  resolveTenantKind
} from "../lib/tenants/profiles";
import { resolveTenantContext } from "../lib/tenants/request";

export const generateMetadata = async (): Promise<Metadata> => {
  const context = await resolveTenantContext();
  const tenantSeo = resolveTenantSeoContext({ tenantId: context.tenantId });
  const tenantLabel = buildTenantLabel(context);
  const title = `${tenantLabel} | Quiz Factory`;
  const description = "Browse the available tests and start when ready.";
  const canonical = buildCanonical(context, "/");
  const ogImage = buildCanonical(context, "/og.png");
  const languages = buildLocaleAlternatesForPath(context, "/", tenantSeo.locales);
  const { ogLocale, alternateLocale } = buildOpenGraphLocales(context.locale, tenantSeo.locales);

  const metadata: Metadata = {
    title,
    description,
    openGraph: {
      title,
      description,
      locale: ogLocale,
      alternateLocale,
      url: canonical ?? undefined,
      images: ogImage ? [{ url: ogImage }] : undefined
    }
  };
  if (canonical) {
    metadata.alternates = {
      canonical,
      languages
    };
  }

  return metadata;
};

const orderTestsByFeaturedSlugs = (
  tests: ReadonlyArray<TenantExplorerTest>,
  featuredSlugs: ReadonlyArray<string>
): TenantExplorerTest[] => {
  const bySlug = new Map(tests.map((test) => [test.slug, test]));
  const ordered: TenantExplorerTest[] = [];
  const seen = new Set<string>();

  for (const rawSlug of featuredSlugs) {
    const slug = rawSlug.trim().toLowerCase();
    if (!slug || seen.has(slug)) {
      continue;
    }

    const test = bySlug.get(slug);
    if (!test) {
      continue;
    }

    seen.add(slug);
    ordered.push(test);
  }

  return ordered;
};

const deriveCategoriesForVisibleTests = (
  tests: ReadonlyArray<TenantExplorerTest>
): Array<{
  slug: string;
  label: string;
  test_count: number;
}> => {
  const categoriesBySlug = new Map<
    string,
    {
      slug: string;
      label: string;
      test_count: number;
    }
  >();

  for (const test of tests) {
    if (!test.category_slug || !test.category) {
      continue;
    }

    const existingCategory = categoriesBySlug.get(test.category_slug);
    if (existingCategory) {
      existingCategory.test_count += 1;
      continue;
    }

    categoriesBySlug.set(test.category_slug, {
      slug: test.category_slug,
      label: test.category,
      test_count: 1
    });
  }

  return [...categoriesBySlug.values()].sort((left, right) => {
    const labelComparison = left.label.localeCompare(right.label);
    if (labelComparison !== 0) {
      return labelComparison;
    }

    return left.slug.localeCompare(right.slug);
  });
};

export default async function HomePage() {
  const context = await resolveTenantContext();
  const [tests, categories] = await Promise.all([
    loadTenantHubTests(context.tenantId, context.locale),
    deriveTenantCategories(context.tenantId, context.locale)
  ]);
  const tenantProfile = getTenantProfile(context.tenantId);
  const tenantKind = resolveTenantKind(context.tenantId);
  const homepageCopy = resolveHomepageCopy(context.tenantId);
  const tenantLabel = context.requestHost ?? context.host ?? context.tenantId;
  const featuredSlugs = tenantProfile?.featured_test_slugs ?? [];
  const featuredTests =
    tenantKind === "niche" ? orderTestsByFeaturedSlugs(tests, featuredSlugs) : [];
  const useFocusedNicheHomepage =
    tenantKind === "niche" &&
    featuredSlugs.length > 0 &&
    featuredTests.length > 0;
  const visibleTests = useFocusedNicheHomepage ? featuredTests : tests;
  const visibleCategories = useFocusedNicheHomepage
    ? deriveCategoriesForVisibleTests(visibleTests)
    : categories;
  const heroHeadline = homepageCopy.headline || tenantLabel;
  const heroSubheadline =
    homepageCopy.subheadline?.trim() ||
    "Find a test, complete it quickly, and get your result.";
  const homepageLabel = useFocusedNicheHomepage ? "Niche homepage" : "Tenant homepage";
  const explorerSubheading = `${homepageLabel} for ${tenantLabel} (${context.locale}). ${heroSubheadline}`;

  return (
    <section className="flex flex-col gap-8">
      <PublicNav />
      <TenantTestExplorer
        tests={visibleTests}
        categories={visibleCategories}
        heading={heroHeadline}
        subheading={explorerSubheading}
      />
    </section>
  );
}

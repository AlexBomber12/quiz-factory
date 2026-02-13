import { resolveHomepageCopy } from "../tenants/profiles";
import {
  DEFAULT_TENANT_EXPLORER_COPY,
  type TenantExplorerCopy
} from "./explorer_copy";

export type PublicSectionHeadings = {
  featured: string;
  browse: string;
  howItWorks: string;
};

export type PublicPageContentPack = {
  heroHeadline: string;
  heroSubheadline: string;
  sectionHeadings: PublicSectionHeadings;
  explorer: TenantExplorerCopy;
};

const SECTION_HEADINGS: PublicSectionHeadings = Object.freeze({
  featured: "Featured Assessments",
  browse: "Browse Assessments",
  howItWorks: "How it works"
});

const DEFAULT_HOME_HEADLINE = "Discover your next self-assessment";
const DEFAULT_HOME_SUBHEADLINE =
  "Browse the available tests and start when you're ready.";
const TESTS_PAGE_HEADLINE = "Tests";
const TESTS_PAGE_SUBHEADLINE =
  "Explore self-assessments and start the one that fits your goals today.";

const asNonEmptyCopy = (value: string | undefined, fallback: string): string => {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : fallback;
};

const buildExplorerCopy = (
  sectionHeading: string,
  searchPlaceholder = DEFAULT_TENANT_EXPLORER_COPY.searchPlaceholder
): TenantExplorerCopy => {
  return {
    ...DEFAULT_TENANT_EXPLORER_COPY,
    sectionHeading,
    searchPlaceholder
  };
};

export const resolveHomePageContentPack = (tenantId: string): PublicPageContentPack => {
  const homepageCopy = resolveHomepageCopy(tenantId);

  return {
    heroHeadline: asNonEmptyCopy(homepageCopy.headline, DEFAULT_HOME_HEADLINE),
    heroSubheadline: asNonEmptyCopy(homepageCopy.subheadline, DEFAULT_HOME_SUBHEADLINE),
    sectionHeadings: SECTION_HEADINGS,
    explorer: buildExplorerCopy(SECTION_HEADINGS.featured)
  };
};

export const resolveTestsPageContentPack = (): PublicPageContentPack => {
  return {
    heroHeadline: TESTS_PAGE_HEADLINE,
    heroSubheadline: TESTS_PAGE_SUBHEADLINE,
    sectionHeadings: SECTION_HEADINGS,
    explorer: buildExplorerCopy(
      SECTION_HEADINGS.browse,
      "Search tests by title, outcome, or category..."
    )
  };
};

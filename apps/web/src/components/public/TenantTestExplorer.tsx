"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, BrainCircuit, Clock3, Play, Search } from "lucide-react";

import { resolveCategoryLabel } from "../../lib/public/category_label";
import {
  DEFAULT_TENANT_EXPLORER_COPY,
  type TenantExplorerCopy
} from "../../lib/public/explorer_copy";
import { Input } from "../ui/input";
import { cn } from "../../lib/ui/cn";

export type TenantExplorerTest = {
  test_id: string;
  slug: string;
  title: string;
  short_description: string;
  estimated_minutes: number;
  category: string;
  category_slug: string;
};

export type TenantExplorerCategory = {
  slug: string;
  label: string;
  test_count: number;
};

type TenantTestExplorerProps = {
  tests: ReadonlyArray<TenantExplorerTest>;
  categories: ReadonlyArray<TenantExplorerCategory>;
  heading: string;
  subheading: string;
  initialSearchValue?: string;
  includeCategoryInSearch?: boolean;
  showViewAllLink?: boolean;
  copy?: TenantExplorerCopy;
};

const TOP_NAV_LINKS = [
  { label: "All Tests", href: "/tests" },
  { label: "Categories", href: "/categories" },
  { label: "Resources", href: "/about" }
] as const;

const FOOTER_COLUMNS = [
  {
    title: "Platform",
    links: [
      { label: "All Assessments", href: "/tests" },
      { label: "Categories", href: "/categories" },
      { label: "Research Method", href: "/about" }
    ]
  },
  {
    title: "Support",
    links: [
      { label: "Contact Us", href: "/contact" },
      { label: "Help Center", href: "/about" },
      { label: "Cookie Policy", href: "/cookies" }
    ]
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Data Processing", href: "/privacy" }
    ]
  }
] as const;

const CARD_BANNER_CLASSES = [
  "from-[#ebe2d6] via-[#f6f1e7] to-[#dccdb9]",
  "from-[#e0d8cf] via-[#f4ede4] to-[#d0c3b4]",
  "from-[#e7e4de] via-[#f5f2ea] to-[#d8d2c8]",
  "from-[#e3ddd2] via-[#efe9dd] to-[#cabba8]"
] as const;

const normalizeSearchValue = (value: string): string => value.trim().toLowerCase();

const includesSearchValue = (value: string, query: string): boolean => {
  if (!query) {
    return true;
  }

  return value.toLowerCase().includes(query);
};

const formatMinutes = (minutes: number): string => {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return "Flexible";
  }
  if (minutes === 1) {
    return "1 min";
  }
  return `${minutes} min`;
};

const resolveGridClassName = (itemCount: number): string => {
  if (itemCount <= 1) {
    return "mx-auto grid max-w-[27rem] grid-cols-1 gap-8";
  }

  if (itemCount === 2) {
    return "mx-auto grid max-w-[56rem] grid-cols-1 gap-8 md:grid-cols-2";
  }

  return "grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3";
};

export function TenantTestExplorer({
  tests,
  categories,
  heading,
  subheading,
  initialSearchValue = "",
  includeCategoryInSearch = true,
  showViewAllLink = true,
  copy
}: TenantTestExplorerProps) {
  const [searchValue, setSearchValue] = useState(initialSearchValue);
  const [selectedCategorySlugs, setSelectedCategorySlugs] = useState<string[]>([]);
  const explorerCopy = {
    ...DEFAULT_TENANT_EXPLORER_COPY,
    ...copy
  };

  const searchQuery = normalizeSearchValue(searchValue);
  const searchValueLabel = searchValue.trim();
  const selectedCategorySet = useMemo(
    () => new Set(selectedCategorySlugs),
    [selectedCategorySlugs]
  );

  const filteredTests = useMemo(() => {
    return tests.filter((test) => {
      const matchesSearch =
        includesSearchValue(test.title, searchQuery) ||
        includesSearchValue(test.short_description, searchQuery) ||
        (includeCategoryInSearch && includesSearchValue(test.category, searchQuery));
      const matchesSelectedCategories =
        selectedCategorySet.size === 0 || selectedCategorySet.has(test.category_slug);
      return matchesSearch && matchesSelectedCategories;
    });
  }, [includeCategoryInSearch, searchQuery, selectedCategorySet, tests]);

  const hasActiveFilters = searchQuery.length > 0 || selectedCategorySlugs.length > 0;
  const shouldShowSmallCatalogGuidance =
    !hasActiveFilters && tests.length > 0 && tests.length <= 3;
  const allCategoriesSelected = selectedCategorySlugs.length === 0;
  const searchInputLabel = includeCategoryInSearch
    ? "Search tests by title, description, or category"
    : "Search tests by title or description";
  const hasSearchQuery = searchValueLabel.length > 0;
  const hasAnyTests = tests.length > 0;
  let emptyStateTitle = explorerCopy.emptyCatalogTitle;
  let emptyStateDescription = explorerCopy.emptyCatalogDescription;
  if (hasAnyTests && hasSearchQuery) {
    emptyStateTitle = "No matching tests";
    emptyStateDescription = `No tests matched "${searchValueLabel}". Try another search term.`;
  } else if (hasAnyTests) {
    emptyStateTitle = "No matching tests right now";
    emptyStateDescription = "Try a different search term or clear your category filters.";
  }

  const toggleCategory = (slug: string) => {
    setSelectedCategorySlugs((current) => {
      if (current.includes(slug)) {
        return current.filter((item) => item !== slug);
      }

      return [...current, slug];
    });
  };

  const handleReset = () => {
    setSearchValue("");
    setSelectedCategorySlugs([]);
  };

  useEffect(() => {
    document.body.setAttribute("data-tenant-home-shell", "true");
    return () => {
      document.body.removeAttribute("data-tenant-home-shell");
    };
  }, []);

  useEffect(() => {
    setSearchValue(initialSearchValue);
    setSelectedCategorySlugs([]);
  }, [initialSearchValue]);

  return (
    <div data-tenant-home-shell="true" className="min-h-screen bg-[#f6f7f8] text-[#3d3630]">
      <header className="sticky top-0 z-40 bg-[#18304b] text-white shadow-md">
        <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between px-4 lg:px-0">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 text-white no-underline">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/30 bg-white/20">
                <BrainCircuit className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="text-xl font-bold tracking-tight text-white">Quiz Factory</span>
            </Link>
            <nav className="hidden items-center gap-6 md:flex" aria-label="Homepage navigation">
              {TOP_NAV_LINKS.map((link, index) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "text-sm font-medium text-white/70 no-underline transition-colors hover:text-white",
                    index === 0 &&
                      "text-white underline decoration-white/30 underline-offset-4"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Notifications"
              className="rounded-md p-2 text-white/70 transition-colors hover:text-white"
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="hidden items-center gap-2 border-l border-white/20 pl-4 sm:flex">
              <div className="text-right">
                <p className="text-xs font-semibold text-white">Open Access</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">
                  No sign-in
                </p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/20 text-xs font-semibold text-white">
                QF
              </span>
            </div>
          </div>
        </div>
      </header>

      <section className="border-b border-[#e2ddd3] bg-[linear-gradient(135deg,#f9f7f2_0%,#f0ede4_100%)]">
        <div className="mx-auto w-full max-w-[1120px] px-4 py-16 text-center md:py-24 lg:px-0">
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-[#3d3630] md:text-5xl">
            {heading}
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-[#5f554c]">
            {subheading}
          </p>
          <div className="relative mx-auto max-w-2xl">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7f7368]"
            />
            <Input
              id="tenant-home-search"
              aria-label={searchInputLabel}
              value={searchValue}
              onChange={(event) => {
                setSearchValue(event.target.value);
              }}
              placeholder={explorerCopy.searchPlaceholder}
              autoComplete="off"
              className="h-14 rounded-xl border-2 border-[#e2ddd3] bg-white/70 pl-12 pr-32 text-[15px] text-[#3d3630] placeholder:text-[#7f7368] focus-visible:ring-[#18304b]"
            />
            <button
              type="button"
              className="absolute inset-y-2 right-2 rounded-lg bg-[#c68160] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#b86f4d]"
            >
              Search
            </button>
          </div>
        </div>
      </section>

      <div className="sticky top-16 z-30 border-b border-[#e2ddd3] bg-[#f6f7f8]">
        <div className="mx-auto w-full max-w-[1120px] px-4 lg:px-0">
          <div className="flex items-center gap-3 overflow-x-auto py-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => {
                setSelectedCategorySlugs([]);
              }}
              aria-pressed={allCategoriesSelected}
              className={cn(
                "whitespace-nowrap rounded-full px-5 py-2 text-sm font-semibold transition-colors",
                allCategoriesSelected
                  ? "bg-[#c68160] text-white"
                  : "bg-[#e9e4d9] text-[#665a4f] hover:bg-[#dfd9cc]"
              )}
            >
              All Categories
            </button>
            {categories.map((category) => {
              const isSelected = selectedCategorySet.has(category.slug);
              return (
                <button
                  key={category.slug}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    toggleCategory(category.slug);
                  }}
                  className={cn(
                    "whitespace-nowrap rounded-full px-5 py-2 text-sm font-medium transition-colors",
                    isSelected
                      ? "bg-[#c68160] text-white"
                      : "bg-[#e9e4d9] text-[#665a4f] hover:bg-[#dfd9cc]"
                  )}
                >
                  {resolveCategoryLabel(category.label, category.slug)}
                  <span className="ml-2 text-xs opacity-80">{category.test_count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <section
        aria-label="Assessments"
        className="mx-auto w-full max-w-[1120px] px-4 py-12 lg:px-0"
      >
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[#3d3630]">
              {explorerCopy.sectionHeading}
            </h2>
            <p className="mt-1 text-sm text-[#6f6459]">
              Showing {filteredTests.length} of {tests.length}{" "}
              {tests.length === 1 ? "assessment" : "assessments"}.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg border border-[#c68160] px-4 py-2 text-sm font-semibold text-[#c68160] transition-colors hover:bg-[#c68160] hover:text-white"
              >
                Reset filters
              </button>
            ) : null}
            {showViewAllLink ? (
              <Link
                href="/tests"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#c68160] no-underline hover:underline"
              >
                View all
              </Link>
            ) : null}
          </div>
        </div>

        {shouldShowSmallCatalogGuidance ? (
          <div className="mb-8 rounded-lg border border-[#dccfbf] bg-[#f4ede3] p-5">
            <h3 className="text-base font-semibold text-[#3d3630]">
              {explorerCopy.smallCatalogTitle}
            </h3>
            <p className="mt-1 text-sm text-[#6f6459]">
              {explorerCopy.smallCatalogDescription}
            </p>
          </div>
        ) : null}

        {filteredTests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#d7cec2] bg-white p-8 text-center">
            <h3 className="text-xl font-bold text-[#3d3630]">{emptyStateTitle}</h3>
            <p className="mt-2 text-sm text-[#6f6459]">{emptyStateDescription}</p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={handleReset}
                className="mt-4 rounded-lg bg-[#18304b] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#152a41]"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : (
          <div className={resolveGridClassName(filteredTests.length)}>
            {filteredTests.map((test, index) => {
              const categoryLabel = resolveCategoryLabel(
                test.category,
                test.category_slug
              );
              return (
                <article
                  key={test.test_id}
                  className="flex h-full flex-col overflow-hidden rounded-lg border border-[#e2ddd3] bg-white shadow-[0_4px_20px_-2px_rgba(61,54,48,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_24px_-6px_rgba(61,54,48,0.16)]"
                >
                  <div
                    className={cn(
                      "relative h-48 overflow-hidden bg-gradient-to-br",
                      CARD_BANNER_CLASSES[index % CARD_BANNER_CLASSES.length]
                    )}
                  >
                    <div className="absolute inset-0 bg-white/20" />
                    <div className="absolute -right-10 top-8 h-28 w-28 rounded-full bg-white/25 blur-md" />
                    <div className="absolute -left-8 bottom-0 h-20 w-20 rounded-full bg-[#18304b]/10 blur-sm" />
                    <span className="absolute left-4 top-4 rounded-md bg-white/90 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#3d3630]">
                      {categoryLabel}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="mb-2 text-xl font-bold tracking-tight text-[#3d3630]">
                      {test.title}
                    </h3>
                    <p className="mb-6 text-sm leading-relaxed text-[#5f554c] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                      {test.short_description}
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs text-[#6f6459]">
                        <Clock3 className="h-4 w-4" aria-hidden="true" />
                        <span>{formatMinutes(test.estimated_minutes)}</span>
                      </div>
                      <Link
                        href={`/t/${test.slug}`}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#18304b] px-5 py-2.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-[#152a41]"
                      >
                        Take test
                        <Play className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <footer className="border-t border-[#e2ddd3] bg-white py-12">
        <div className="mx-auto w-full max-w-[1120px] px-4 lg:px-0">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-4">
            <div>
              <div className="mb-6 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded bg-[#18304b]">
                  <BrainCircuit className="h-4 w-4 text-white" aria-hidden="true" />
                </span>
                <span className="text-lg font-bold tracking-tight text-[#3d3630]">
                  Quiz Factory
                </span>
              </div>
              <p className="text-sm leading-relaxed text-[#6f6459]">
                The leading platform for validated psychological testing and professional
                development analytics.
              </p>
            </div>
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.title}>
                <h4 className="mb-6 text-base font-bold text-[#3d3630]">{column.title}</h4>
                <ul className="space-y-4 text-sm text-[#6f6459]">
                  {column.links.map((link) => (
                    <li key={`${link.href}-${link.label}`}>
                      <Link
                        href={link.href}
                        className="text-[#6f6459] no-underline transition-colors hover:text-[#c68160]"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-[#e2ddd3] pt-8 md:flex-row">
            <p className="text-xs text-[#8a8074]">
              © 2026 Quiz Factory Intelligence Systems. All rights reserved.
            </p>
            <div className="flex gap-4">
              <span className="h-2 w-2 rounded-full bg-[#c68160]" />
              <span className="h-2 w-2 rounded-full bg-[#c68160]/80" />
              <span className="h-2 w-2 rounded-full bg-[#c68160]/60" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

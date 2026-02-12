"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "../ui/card";
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
};

const normalizeSearchValue = (value: string): string => value.trim().toLowerCase();

const includesSearchValue = (value: string, query: string): boolean => {
  if (!query) {
    return true;
  }

  return value.toLowerCase().includes(query);
};

const formatMinutes = (minutes: number): string => {
  const unit = minutes === 1 ? "minute" : "minutes";
  return `${minutes} ${unit}`;
};

const formatTestCount = (count: number): string => {
  return count === 1 ? "1 test" : `${count} tests`;
};

const getAverageMinutes = (tests: ReadonlyArray<TenantExplorerTest>): number => {
  if (tests.length === 0) {
    return 0;
  }

  const totalMinutes = tests.reduce((total, test) => total + test.estimated_minutes, 0);
  return Math.max(1, Math.round(totalMinutes / tests.length));
};

export function TenantTestExplorer({
  tests,
  categories,
  heading,
  subheading
}: TenantTestExplorerProps) {
  const [searchValue, setSearchValue] = useState("");
  const [selectedCategorySlugs, setSelectedCategorySlugs] = useState<string[]>([]);

  const searchQuery = normalizeSearchValue(searchValue);
  const selectedCategorySet = useMemo(
    () => new Set(selectedCategorySlugs),
    [selectedCategorySlugs]
  );

  const filteredTests = useMemo(() => {
    return tests.filter((test) => {
      const matchesSearch =
        includesSearchValue(test.title, searchQuery) ||
        includesSearchValue(test.short_description, searchQuery) ||
        includesSearchValue(test.category, searchQuery);
      const matchesSelectedCategories =
        selectedCategorySet.size === 0 || selectedCategorySet.has(test.category_slug);
      return matchesSearch && matchesSelectedCategories;
    });
  }, [searchQuery, selectedCategorySet, tests]);

  const hasActiveFilters = searchQuery.length > 0 || selectedCategorySlugs.length > 0;
  const averageMinutes = getAverageMinutes(tests);
  const showCompactStats = tests.length <= 1;

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

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-border/90 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_-16px_rgba(15,23,42,0.12)]">
        <CardHeader className="space-y-4">
          <Badge variant="secondary" className="w-fit uppercase tracking-[0.2em]">
            Discover tests
          </Badge>
          <div className="space-y-2">
            <CardTitle className="text-3xl">{heading}</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              {subheading}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="space-y-2">
              <label htmlFor="tenant-home-search" className="text-sm font-medium">
                Search tests
              </label>
              <Input
                id="tenant-home-search"
                aria-label="Search tests by title, description, or category"
                value={searchValue}
                onChange={(event) => {
                  setSearchValue(event.target.value);
                }}
                placeholder="Search by title, description, or category"
                autoComplete="off"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full md:w-auto"
              onClick={handleReset}
              disabled={!hasActiveFilters}
            >
              Reset
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const isSelected = selectedCategorySet.has(category.slug);
              return (
                <Button
                  key={category.slug}
                  type="button"
                  size="sm"
                  variant={isSelected ? "secondary" : "outline"}
                  aria-pressed={isSelected}
                  onClick={() => {
                    toggleCategory(category.slug);
                  }}
                  className={cn(
                    "rounded-full px-3",
                    isSelected && "bg-accent text-accent-foreground hover:bg-accent/90"
                  )}
                >
                  <span>{category.label}</span>
                  <Badge
                    variant={isSelected ? "default" : "secondary"}
                    className={cn(
                      "ml-1 h-5 rounded-full px-1.5 text-[10px]",
                      isSelected && "bg-accent-foreground/15 text-accent-foreground"
                    )}
                  >
                    {category.test_count}
                  </Badge>
                </Button>
              );
            })}
          </div>

          {showCompactStats ? (
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>{formatTestCount(tests.length)}</span>
              {averageMinutes > 0 ? <span>~{averageMinutes} min</span> : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {showCompactStats ? null : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="border-border/90 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_-16px_rgba(15,23,42,0.12)]">
            <CardHeader className="space-y-1 pb-2">
              <CardDescription className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Available tests
              </CardDescription>
              <CardTitle className="text-2xl">{tests.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-border/90 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_-16px_rgba(15,23,42,0.12)]">
            <CardHeader className="space-y-1 pb-2">
              <CardDescription className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Categories
              </CardDescription>
              <CardTitle className="text-2xl">{categories.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-border/90 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_-16px_rgba(15,23,42,0.12)]">
            <CardHeader className="space-y-1 pb-2">
              <CardDescription className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Average length
              </CardDescription>
              <CardTitle className="text-2xl">
                {averageMinutes > 0 ? `${averageMinutes} min` : "N/A"}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Available tests</h2>
          <p className="text-sm text-muted-foreground">
            Showing {filteredTests.length} of {tests.length}{" "}
            {tests.length === 1 ? "test" : "tests"}.
          </p>
        </div>
      </div>

      {filteredTests.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="space-y-2">
            <CardTitle>
              {tests.length === 0 ? "No tests yet" : "No matching tests right now"}
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              {tests.length === 0
                ? "This tenant does not have any published tests yet."
                : "Try a different search term or clear your category filters."}
            </CardDescription>
          </CardHeader>
          {hasActiveFilters ? (
            <CardFooter>
              <Button type="button" variant="outline" onClick={handleReset}>
                Clear filters
              </Button>
            </CardFooter>
          ) : null}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredTests.map((test) => {
            const categoryLabel = test.category || "General";
            return (
              <Card
                key={test.test_id}
                className="relative flex h-full flex-col border-border/90 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_-16px_rgba(15,23,42,0.12)]"
              >
                <Link
                  href={`/t/${test.slug}`}
                  aria-label={`Open ${test.title}`}
                  className="absolute inset-0 z-10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                <CardHeader className="space-y-2">
                  <CardTitle>{test.title}</CardTitle>
                  <CardDescription className="text-base text-muted-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:1] overflow-hidden">
                    {test.short_description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{formatMinutes(test.estimated_minutes)}</Badge>
                  <Badge variant="outline">{categoryLabel}</Badge>
                </CardContent>
                <CardFooter className="relative z-20 mt-auto">
                  <Button asChild className="no-underline">
                    <Link href={`/t/${test.slug}`}>Start test</Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

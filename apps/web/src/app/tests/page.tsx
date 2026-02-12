import type { Metadata } from "next";
import Link from "next/link";

import { PublicNav } from "../../components/public/PublicNav";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { loadTenantCatalog } from "../../lib/catalog/catalog";
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

const includesSearchTerm = (value: string, query: string): boolean => {
  return value.toLowerCase().includes(query.toLowerCase());
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
  const tests = await loadTenantCatalog(context.tenantId, context.locale);
  const resolvedSearchParams = await searchParams;
  const query = normalizeQueryParam(resolvedSearchParams?.q);

  const filteredTests = query
    ? tests.filter((test) => {
        return (
          includesSearchTerm(test.title, query) ||
          includesSearchTerm(test.short_description, query)
        );
      })
    : tests;
  const testLabel = tests.length === 1 ? "test" : "tests";
  const resultLabel = filteredTests.length === 1 ? "test" : "tests";
  const surfaceClassName =
    "border-border/90 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_-16px_rgba(15,23,42,0.12)]";

  return (
    <section className="flex flex-col gap-6">
      <PublicNav />

      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Tests</h1>
        <p className="text-base text-muted-foreground">
          Explore self-assessments and start the one that fits your goals today.
        </p>
        <p className="text-sm text-muted-foreground">
          Showing {filteredTests.length} of {tests.length} {testLabel} ready to start.
        </p>
      </header>

      <Card className={surfaceClassName}>
        <CardContent className="pt-6">
          <form
            method="get"
            action="/tests"
            className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end"
          >
            <div className="space-y-2">
              <label htmlFor="tests-search" className="text-sm font-medium">
                Search tests
              </label>
              <Input
                id="tests-search"
                name="q"
                defaultValue={query}
                placeholder="Search by title or description"
                autoComplete="off"
              />
            </div>
            <Button type="submit" className="w-full md:w-auto">
              Search
            </Button>
            <Button asChild type="button" variant="outline" className="w-full md:w-auto">
              <Link href="/tests">Clear</Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      {filteredTests.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="space-y-2">
            <CardTitle>No matching tests</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              {query
                ? `No ${resultLabel} matched "${query}". Try another search term.`
                : "This tenant does not have published tests yet."}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline">
              <Link href="/">Back to home</Link>
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredTests.map((test) => {
            const minutesLabel = test.estimated_minutes === 1 ? "minute" : "minutes";
            return (
              <Card
                key={test.test_id}
                className={`flex h-full flex-col ${surfaceClassName}`}
              >
                <CardHeader className="space-y-2">
                  <CardTitle>{test.title}</CardTitle>
                  <CardDescription className="text-base text-muted-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:1] overflow-hidden">
                    {test.short_description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline">
                    {test.estimated_minutes} {minutesLabel}
                  </Badge>
                </CardContent>
                <CardFooter className="mt-auto">
                  <Button asChild>
                    <Link href={`/t/${test.slug}`}>Start test</Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

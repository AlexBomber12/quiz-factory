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
import { loadTenantCatalog } from "../../lib/catalog/catalog";
import { buildHubPageMetadata } from "../../lib/hub/metadata";
import { resolveTenantContext } from "../../lib/tenants/request";

type PageProps = {
  searchParams?: {
    q?: string | string[];
  };
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
  const query = normalizeQueryParam(searchParams?.q);

  const filteredTests = query
    ? tests.filter((test) => {
        return (
          includesSearchTerm(test.title, query) ||
          includesSearchTerm(test.short_description, query)
        );
      })
    : tests;

  return (
    <section className="flex flex-col gap-6">
      <PublicNav />

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Tests</h1>
        <p className="text-sm text-muted-foreground">
          Search with <code>?q=</code> to quickly filter by title or description.
        </p>
        <p className="text-sm text-muted-foreground">
          Showing {filteredTests.length} of {tests.length} tests.
        </p>
      </header>

      {filteredTests.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="space-y-2">
            <CardTitle>No matching tests</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              {query
                ? `No tests matched "${query}". Try another search.`
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
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredTests.map((test) => {
            const minutesLabel = test.estimated_minutes === 1 ? "minute" : "minutes";
            return (
              <Card key={test.test_id} className="flex h-full flex-col">
                <CardHeader className="space-y-2">
                  <CardTitle>{test.title}</CardTitle>
                  <CardDescription className="text-base text-muted-foreground">
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
                    <Link href={`/t/${test.slug}`}>Open test</Link>
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

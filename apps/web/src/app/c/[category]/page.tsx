import type { Metadata } from "next";
import Link from "next/link";

import { PublicNav } from "@/components/public/PublicNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { loadTenantHubTests, normalizeCategoryParam } from "@/lib/hub/categories";
import { buildHubPageMetadata } from "@/lib/hub/metadata";
import { resolveRouteParams, safeTrim } from "@/lib/seo/metadata_safety";
import { resolveTenantContext } from "@/lib/tenants/request";

type CategoryParams = {
  category?: string;
};

type PageProps = {
  params: Promise<CategoryParams> | CategoryParams;
};

const toCategoryTitle = (value: string): string => {
  if (!value) {
    return "Category";
  }

  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const resolveCategoryParam = async (params: PageProps["params"]): Promise<string> => {
  const resolved = await resolveRouteParams(params);
  return safeTrim(resolved.category, "");
};

export const generateMetadata = async ({ params }: PageProps): Promise<Metadata> => {
  const categoryValue = await resolveCategoryParam(params);
  const categorySlug = normalizeCategoryParam(categoryValue);
  const categoryTitle = toCategoryTitle(categorySlug);
  const path = categorySlug ? `/c/${categorySlug}` : "/categories";

  return buildHubPageMetadata({
    path,
    title: `${categoryTitle} tests`,
    description: `Browse tests in the ${categoryTitle.toLowerCase()} category.`
  });
};

export default async function CategoryPage({ params }: PageProps) {
  const categoryValue = await resolveCategoryParam(params);
  const context = await resolveTenantContext();
  const categorySlug = normalizeCategoryParam(categoryValue);
  const tests = await loadTenantHubTests(context.tenantId, context.locale);
  const matchingTests = tests.filter((test) => test.category_slug === categorySlug);
  const categoryLabel = matchingTests[0]?.category ?? toCategoryTitle(categorySlug);

  return (
    <section className="flex flex-col gap-6">
      <PublicNav />

      <div className="flex flex-col gap-2">
        <Button asChild variant="ghost" size="sm" className="w-fit px-0">
          <Link href="/categories">Back to categories</Link>
        </Button>
        <h1 className="text-3xl font-semibold tracking-tight">{categoryLabel}</h1>
        <p className="text-sm text-muted-foreground">
          {matchingTests.length} {matchingTests.length === 1 ? "test" : "tests"} in this category.
        </p>
      </div>

      {matchingTests.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="space-y-2">
            <CardTitle>No tests in this category</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              This category does not currently include published tests for this tenant.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline">
              <Link href="/categories">Browse categories</Link>
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {matchingTests.map((test) => {
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

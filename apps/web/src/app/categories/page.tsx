import type { Metadata } from "next";
import Link from "next/link";

import { PublicNav } from "../../components/public/PublicNav";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "../../components/ui/card";
import { deriveTenantCategories } from "../../lib/hub/categories";
import { buildHubPageMetadata } from "../../lib/hub/metadata";
import { resolveTenantContext } from "../../lib/tenants/request";

export const generateMetadata = async (): Promise<Metadata> => {
  return buildHubPageMetadata({
    path: "/categories",
    title: "Categories",
    description: "Browse tests by category."
  });
};

export default async function CategoriesPage() {
  const context = await resolveTenantContext();
  const categories = await deriveTenantCategories(context.tenantId, context.locale);

  return (
    <section className="flex flex-col gap-6">
      <PublicNav />

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Categories</h1>
        <p className="text-sm text-muted-foreground">
          Browse tests by theme and open a focused list for each category.
        </p>
      </header>

      {categories.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="space-y-2">
            <CardTitle>No categories available</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Categories appear after tests with category metadata are published.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline">
              <Link href="/tests">View tests</Link>
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {categories.map((category) => {
            const testsLabel = category.test_count === 1 ? "test" : "tests";
            return (
              <Card key={category.slug} className="flex h-full flex-col">
                <CardHeader className="space-y-2">
                  <CardTitle>{category.label}</CardTitle>
                  <CardDescription className="text-base text-muted-foreground">
                    {category.test_count} {testsLabel}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="mt-auto">
                  <Button asChild>
                    <Link href={`/c/${category.slug}`}>View category</Link>
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

import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { loadTenantCatalog } from "../lib/catalog/catalog";
import {
  buildCanonical,
  buildLocaleAlternatesForPath,
  buildOpenGraphLocales,
  buildTenantLabel,
  resolveTenantSeoContext
} from "../lib/seo/metadata";
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

export default async function HomePage() {
  const context = await resolveTenantContext();
  const tests = await loadTenantCatalog(context.tenantId, context.locale);
  const tenantLabel = context.requestHost ?? context.host ?? context.tenantId;

  return (
    <section className="flex flex-col gap-8">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Tenant homepage
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                {tenantLabel}
              </h1>
            </div>
            <Badge variant="secondary" className="uppercase">
              {context.locale}
            </Badge>
          </div>
          <CardDescription className="text-base text-muted-foreground">
            Browse the available tests and start when ready.
          </CardDescription>
        </CardHeader>
      </Card>

      <Separator />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Available tests</h2>
          <p className="text-sm text-muted-foreground">
            {tests.length} {tests.length === 1 ? "test" : "tests"} ready to run.
          </p>
        </div>
      </div>

      {tests.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="space-y-2">
            <CardTitle>No tests yet</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              This tenant does not have any published tests. Add a test to the catalog
              to get started.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline">
              <Link href="/docs/content/tests.md">Review test catalog docs</Link>
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {tests.map((test) => {
            const minutesLabel =
              test.estimated_minutes === 1 ? "minute" : "minutes";
            return (
              <Card key={test.test_id} className="flex h-full flex-col">
                <CardHeader className="space-y-2">
                  <CardTitle>{test.title}</CardTitle>
                  <CardDescription className="text-base text-muted-foreground">
                    {test.short_description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
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

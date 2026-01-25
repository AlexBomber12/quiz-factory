import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "../../../components/ui/card";
import { Separator } from "../../../components/ui/separator";
import { resolveTenantTestBySlug } from "../../../lib/catalog/catalog";
import { loadTestSpecById } from "../../../lib/content/load";
import {
  buildCanonical,
  buildLocaleAlternatesForPath,
  buildOgImagePath,
  buildOpenGraphLocales,
  buildTenantLabel,
  resolveSeoTestContext,
  resolveTenantSeoContext
} from "../../../lib/seo/metadata";
import { resolveTenantContext, type TenantRequestContext } from "../../../lib/tenants/request";

type PageProps = {
  params: {
    slug: string;
  };
};

const FALLBACK_LOCALE: TenantRequestContext["locale"] = "en";

const resolveIntroCopy = (
  testId: string,
  locale: TenantRequestContext["locale"]
): { intro: string | null; category: string | null } => {
  const spec = loadTestSpecById(testId);
  const localeStrings =
    spec.locales[locale] ??
    spec.locales[FALLBACK_LOCALE] ??
    Object.values(spec.locales)[0];

  const intro = localeStrings?.intro?.trim() ?? "";
  const category = spec.category.trim();

  return {
    intro: intro.length > 0 ? intro : null,
    category: category.length > 0 ? category : null
  };
};

const HAS_RUN_ROUTE = true;

export const generateMetadata = async ({ params }: PageProps): Promise<Metadata> => {
  const context = await resolveTenantContext();
  const test = resolveTenantTestBySlug(context.tenantId, context.locale, params.slug);
  const tenantSeo = resolveTenantSeoContext({ tenantId: context.tenantId });
  const tenantLabel = buildTenantLabel(context);
  const fallbackOgImage = buildCanonical(context, "/og.png");

  const buildMetadata = (
    title: string,
    description: string,
    path: string,
    canonical: string | null,
    ogImage: string | null,
    locales: ReadonlyArray<TenantRequestContext["locale"]>
  ): Metadata => {
    const languages = buildLocaleAlternatesForPath(context, path, locales);
    const { ogLocale, alternateLocale } = buildOpenGraphLocales(context.locale, locales);
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

  if (!test) {
    const path = `/t/${params.slug}`;
    const canonical = buildCanonical(context, path);
    return buildMetadata(
      `${tenantLabel} | Quiz Factory`,
      "This test is not available for this tenant.",
      path,
      canonical,
      fallbackOgImage,
      tenantSeo.locales
    );
  }

  const seo = resolveSeoTestContext({
    tenantId: context.tenantId,
    testId: test.test_id
  });
  const path = `/t/${test.slug}`;
  const canonical = buildCanonical(context, path);
  const ogPath = buildOgImagePath(`/t/${test.slug}/opengraph-image`, seo.token);
  const ogImage = buildCanonical(context, ogPath) ?? fallbackOgImage;
  const title = `${test.title} (${test.slug}) | ${tenantLabel} | Quiz Factory`;

  return buildMetadata(
    title,
    test.short_description,
    path,
    canonical,
    ogImage,
    seo.locales
  );
};

export default async function TestLandingPage({ params }: PageProps) {
  const context = await resolveTenantContext();
  const test = resolveTenantTestBySlug(context.tenantId, context.locale, params.slug);

  if (!test) {
    return (
      <section className="flex flex-col gap-6">
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle>Test not available</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Choose a test from the tenant catalog to continue.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline">
              <Link href="/">Back to tests</Link>
            </Button>
          </CardFooter>
        </Card>
      </section>
    );
  }

  const { intro, category } = resolveIntroCopy(test.test_id, context.locale);
  const introText = intro ?? test.short_description;
  const minutesLabel = test.estimated_minutes === 1 ? "minute" : "minutes";

  return (
    <section className="flex flex-col gap-8">
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-3xl">{test.title}</CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            {test.short_description}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant="outline">
            {test.estimated_minutes} {minutesLabel}
          </Badge>
          {category ? <Badge variant="secondary">{category}</Badge> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl">Introduction</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{introText}</p>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg">Not medical advice</CardTitle>
          <CardDescription>
            This quiz is for informational purposes only and is not medical advice.
          </CardDescription>
        </CardHeader>
      </Card>

      <Separator />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {HAS_RUN_ROUTE ? (
          <Button asChild>
            <Link href={`/t/${test.slug}/run`}>Start</Link>
          </Button>
        ) : (
          <Button disabled>Coming soon</Button>
        )}
        <Button asChild variant="outline">
          <Link href="/">Back to tests</Link>
        </Button>
      </div>
    </section>
  );
}

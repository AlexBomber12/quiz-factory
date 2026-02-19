import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";

import { PublicPage } from "@/components/public/PublicPage";
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
import type { LocaleTag } from "@/lib/content/types";
import { loadPublishedTestBySlug } from "@/lib/content/provider";
import {
  RESULT_COOKIE,
  verifyResultCookie
} from "@/lib/product/result_cookie";
import { ATTEMPT_TOKEN_COOKIE_NAME } from "@/lib/security/attempt_token";
import {
  buildCanonical,
  buildLocaleAlternatesForPath,
  buildOgImagePath,
  buildOpenGraphLocales,
  buildTenantLabel,
  resolveSeoTestContext,
  resolveTenantSeoContext
} from "@/lib/seo/metadata";
import {
  resolveRouteParams,
  resolveTestMetadataCopy,
  safeLowercaseSlug
} from "@/lib/seo/metadata_safety";
import { resolveTenantContext } from "@/lib/tenants/request";
import PreviewAnalytics from "./preview-analytics";

type SlugParams = {
  slug?: string;
};

type PageProps = {
  params: Promise<SlugParams> | SlugParams;
};

const FLOW_CARD_CLASS_NAME =
  "border-border/70 bg-card/95 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.55)]";

const loadPreviewTest = (tenantId: string, slug: string, locale: string) => {
  return loadPublishedTestBySlug(tenantId, slug, locale);
};

const resolveSlugParam = async (params: PageProps["params"]): Promise<string> => {
  const resolved = await resolveRouteParams(params);
  return safeLowercaseSlug(resolved.slug, "test");
};

const renderPreviewState = ({
  title,
  description,
  primaryHref,
  primaryLabel
}: {
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
}) => {
  return (
    <PublicPage className="py-8">
      <Card className={FLOW_CARD_CLASS_NAME}>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="w-fit uppercase tracking-[0.18em]">
              Quiz Factory
            </Badge>
            <Badge className="w-fit border-transparent bg-[hsl(var(--brand-terracotta)/0.2)] text-[hsl(var(--brand-navy))]">
              Preview state
            </Badge>
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            {description}
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={primaryHref}>{primaryLabel}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/tests">Browse tests</Link>
          </Button>
        </CardFooter>
      </Card>
    </PublicPage>
  );
};

export const generateMetadata = async ({ params }: PageProps): Promise<Metadata> => {
  const routeSlug = await resolveSlugParam(params);
  const context = await resolveTenantContext();
  const tenantSeo = resolveTenantSeoContext({ tenantId: context.tenantId });
  const tenantLabel = buildTenantLabel(context);
  const published = await loadPreviewTest(context.tenantId, routeSlug, context.locale).catch(
    () => null
  );
  const fallbackOgImage = buildCanonical(context, "/og.png");

  const buildMetadata = (
    title: string,
    description: string,
    path: string,
    canonical: string | null,
    ogImage: string | null,
    locales: ReadonlyArray<LocaleTag>
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

  const path = `/t/${routeSlug}/preview`;
  const canonical = buildCanonical(context, path);

  if (!published) {
    return buildMetadata(
      `${tenantLabel} | Quiz Factory`,
      "This test is not available for this tenant.",
      path,
      canonical,
      fallbackOgImage,
      tenantSeo.locales
    );
  }

  const test = published.test;
  const seo = resolveSeoTestContext({
    tenantId: context.tenantId,
    testId: published.test_id
  });
  const metadataCopy = resolveTestMetadataCopy({
    routeSlug,
    slug: test.slug,
    title: test.title,
    descriptionCandidates: [test.description],
    spec: published.spec,
    locale: published.locale,
    fallbackDescription: "Preview your result before checkout."
  });
  const pathWithSlug = `/t/${metadataCopy.slug}/preview`;
  const pathCanonical = buildCanonical(context, pathWithSlug);
  const ogPath = buildOgImagePath(`/t/${metadataCopy.slug}/opengraph-image`, seo.token);
  const ogImage = buildCanonical(context, ogPath) ?? fallbackOgImage;
  const title =
    `${metadataCopy.title} (${metadataCopy.slug}) - Preview | ${tenantLabel} | Quiz Factory`;

  return buildMetadata(
    title,
    metadataCopy.description,
    pathWithSlug,
    pathCanonical,
    ogImage,
    seo.locales
  );
};

export default async function TestPreviewPage({ params }: PageProps) {
  const routeSlug = await resolveSlugParam(params);
  const context = await resolveTenantContext();
  const published = await loadPreviewTest(context.tenantId, routeSlug, context.locale);

  if (!published) {
    return renderPreviewState({
      title: "Test not available",
      description: "Choose a test from the tenant catalog to continue.",
      primaryHref: "/tests",
      primaryLabel: "Back to tests"
    });
  }

  const test = published.test;
  const cookieStore = await cookies();
  const resultCookieValue = cookieStore.get(RESULT_COOKIE)?.value ?? null;
  const resultPayload = resultCookieValue ? verifyResultCookie(resultCookieValue) : null;

  if (
    !resultPayload ||
    resultPayload.test_id !== published.test_id ||
    resultPayload.tenant_id !== context.tenantId
  ) {
    return renderPreviewState({
      title: "Preview unavailable",
      description:
        "Your preview session could not be restored. Retake the test and we will generate it again.",
      primaryHref: `/t/${routeSlug}/run`,
      primaryLabel: "Back to the test"
    });
  }

  const band = test.result_bands.find((candidate) => candidate.band_id === resultPayload.band_id);
  const bandCopy = band?.copy[test.locale];

  if (!band || !bandCopy) {
    return renderPreviewState({
      title: "Preview unavailable",
      description:
        "We could not load the preview details for your result. Retake the test to refresh your session.",
      primaryHref: `/t/${routeSlug}/run`,
      primaryLabel: "Back to the test"
    });
  }

  const attemptToken = cookieStore.get(ATTEMPT_TOKEN_COOKIE_NAME)?.value ?? null;

  return (
    <PublicPage className="pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-8 md:py-8">
      <PreviewAnalytics
        testId={test.test_id}
        sessionId={resultPayload.session_id}
        attemptToken={attemptToken}
      />

      <Card className={FLOW_CARD_CLASS_NAME}>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="w-fit uppercase tracking-[0.18em]">
              Quiz Factory
            </Badge>
            <Badge className="w-fit border-transparent bg-[hsl(var(--brand-terracotta)/0.2)] text-[hsl(var(--brand-navy))]">
              Free preview
            </Badge>
          </div>
          <CardTitle className="text-3xl leading-tight">{bandCopy.headline}</CardTitle>
          <CardDescription className="text-base leading-relaxed text-muted-foreground">
            {bandCopy.summary}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className={FLOW_CARD_CLASS_NAME}>
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">{test.title}</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Snapshot of what your full report will expand on.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {bandCopy.bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-3 text-sm text-foreground/90 sm:text-base">
                <span
                  aria-hidden="true"
                  className="mt-2 h-2 w-2 flex-none rounded-full bg-[hsl(var(--brand-terracotta))]"
                />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <Button asChild className="w-full sm:w-auto">
            <Link href={`/t/${test.slug}/pay`}>Unlock full report</Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href={`/t/${test.slug}/run`}>Retake the test</Link>
          </Button>
        </CardFooter>
      </Card>
    </PublicPage>
  );
}

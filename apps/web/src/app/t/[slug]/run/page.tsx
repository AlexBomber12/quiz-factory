import type { Metadata } from "next";
import Link from "next/link";

import type { LocaleTag } from "../../../../lib/content/types";
import { loadPublishedTestBySlug } from "../../../../lib/content/provider";
import {
  buildCanonical,
  buildLocaleAlternatesForPath,
  buildOgImagePath,
  buildOpenGraphLocales,
  buildTenantLabel,
  resolveSeoTestContext,
  resolveTenantSeoContext
} from "../../../../lib/seo/metadata";
import {
  resolveRouteParams,
  resolveTestMetadataCopy,
  safeLowercaseSlug
} from "../../../../lib/seo/metadata_safety";
import { resolveTenantContext } from "../../../../lib/tenants/request";
import TestRunnerClient from "./test-runner";

type SlugParams = {
  slug?: string;
};

type PageProps = {
  params: Promise<SlugParams> | SlugParams;
};

const loadRunTest = (tenantId: string, slug: string, locale: string) => {
  return loadPublishedTestBySlug(tenantId, slug, locale);
};

const resolveSlugParam = async (params: PageProps["params"]): Promise<string> => {
  const resolved = await resolveRouteParams(params);
  return safeLowercaseSlug(resolved.slug, "test");
};

export const generateMetadata = async ({ params }: PageProps): Promise<Metadata> => {
  const routeSlug = await resolveSlugParam(params);
  const context = await resolveTenantContext();
  const tenantSeo = resolveTenantSeoContext({ tenantId: context.tenantId });
  const tenantLabel = buildTenantLabel(context);
  const published = await loadRunTest(context.tenantId, routeSlug, context.locale).catch(
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

  const path = `/t/${routeSlug}/run`;
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
    descriptionCandidates: [test.intro, test.description],
    spec: published.spec,
    locale: published.locale,
    fallbackDescription: "Run the test to get your result."
  });
  const pathWithSlug = `/t/${metadataCopy.slug}/run`;
  const pathCanonical = buildCanonical(context, pathWithSlug);
  const ogPath = buildOgImagePath(`/t/${metadataCopy.slug}/opengraph-image`, seo.token);
  const ogImage = buildCanonical(context, ogPath) ?? fallbackOgImage;
  const title = `${metadataCopy.title} (${metadataCopy.slug}) - Run | ${tenantLabel} | Quiz Factory`;

  return buildMetadata(
    title,
    metadataCopy.description,
    pathWithSlug,
    pathCanonical,
    ogImage,
    seo.locales
  );
};

export default async function TestRunPage({ params }: PageProps) {
  const routeSlug = await resolveSlugParam(params);
  const context = await resolveTenantContext();
  const published = await loadRunTest(context.tenantId, routeSlug, context.locale);

  if (!published) {
    return (
      <section className="page">
        <header className="hero">
          <p className="eyebrow">Quiz Factory</p>
          <h1>Test not available</h1>
          <p>Choose a test from the tenant catalog to continue.</p>
        </header>
        <Link className="text-link" href="/">
          Back to tests
        </Link>
      </section>
    );
  }

  const test = published.test;

  return (
    <TestRunnerClient
      test={{
        testId: test.test_id,
        slug: test.slug,
        title: test.title,
        intro: test.intro,
        questions: test.questions
      }}
    />
  );
}

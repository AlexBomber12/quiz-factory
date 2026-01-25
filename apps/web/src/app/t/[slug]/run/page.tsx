import type { Metadata } from "next";
import Link from "next/link";

import { getTenantTestIds, resolveTestIdBySlug } from "../../../../lib/content/catalog";
import { loadLocalizedTest } from "../../../../lib/content/load";
import type { LocaleTag } from "../../../../lib/content/types";
import {
  buildCanonical,
  buildLocaleAlternatesForPath,
  buildOgImagePath,
  buildOpenGraphLocales,
  buildTenantLabel,
  resolveSeoTestContext,
  resolveTenantSeoContext
} from "../../../../lib/seo/metadata";
import { resolveTenantContext } from "../../../../lib/tenants/request";
import TestRunnerClient from "./test-runner";

type PageProps = {
  params: {
    slug: string;
  };
};

const resolveRunTestId = (slug: string, tenantId: string): string | null => {
  const testId = resolveTestIdBySlug(slug);
  if (!testId) {
    return null;
  }

  const allowedTests = getTenantTestIds(tenantId);
  if (!allowedTests.includes(testId)) {
    return null;
  }

  return testId;
};

export const generateMetadata = async ({ params }: PageProps): Promise<Metadata> => {
  const context = await resolveTenantContext();
  const tenantSeo = resolveTenantSeoContext({ tenantId: context.tenantId });
  const tenantLabel = buildTenantLabel(context);
  const testId = resolveRunTestId(params.slug, context.tenantId);
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

  const path = `/t/${params.slug}/run`;
  const canonical = buildCanonical(context, path);

  if (!testId) {
    return buildMetadata(
      `${tenantLabel} | Quiz Factory`,
      "This test is not available for this tenant.",
      path,
      canonical,
      fallbackOgImage,
      tenantSeo.locales
    );
  }

  const test = loadLocalizedTest(testId, context.locale);
  const seo = resolveSeoTestContext({ tenantId: context.tenantId, testId });
  const description = test.intro?.trim() || test.description;
  const ogPath = buildOgImagePath(`/t/${test.slug}/opengraph-image`, seo.token);
  const ogImage = buildCanonical(context, ogPath) ?? fallbackOgImage;
  const title = `${test.title} (${test.slug}) - Run | ${tenantLabel} | Quiz Factory`;

  return buildMetadata(title, description, path, canonical, ogImage, seo.locales);
};

export default async function TestRunPage({ params }: PageProps) {
  const context = await resolveTenantContext();
  const testId = resolveRunTestId(params.slug, context.tenantId);

  if (!testId) {
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

  const test = loadLocalizedTest(testId, context.locale);

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

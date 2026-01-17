import type { Metadata } from "next";
import Link from "next/link";

import { getTenantTestIds, resolveTestIdBySlug } from "../../../lib/content/catalog";
import { loadLocalizedTest } from "../../../lib/content/load";
import { buildCanonicalUrl, resolveTenantContext } from "../../../lib/tenants/request";

type PageProps = {
  params: {
    slug: string;
  };
};

const resolveLandingTestId = (slug: string, tenantId: string): string | null => {
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
  const testId = resolveLandingTestId(params.slug, context.tenantId);
  const ogImage = buildCanonicalUrl(context, "/og.png");

  const buildMetadata = (
    title: string,
    description: string,
    canonical: string | null
  ): Metadata => {
    const metadata: Metadata = {
      title,
      description,
      openGraph: {
        title,
        description,
        url: canonical ?? undefined,
        images: ogImage ? [{ url: ogImage }] : undefined
      }
    };
    if (canonical) {
      metadata.alternates = { canonical };
    }
    return metadata;
  };

  if (!testId) {
    const canonical = buildCanonicalUrl(context, `/t/${params.slug}`);
    return buildMetadata(
      "Quiz Factory",
      "This test is not available for this tenant.",
      canonical
    );
  }

  const test = loadLocalizedTest(testId, context.locale);
  const canonical = buildCanonicalUrl(context, `/t/${test.slug}`);
  return buildMetadata(test.title, test.description, canonical);
};

export default async function TestLandingPage({ params }: PageProps) {
  const context = await resolveTenantContext();
  const testId = resolveLandingTestId(params.slug, context.tenantId);

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
    <section className="page">
      <header className="hero">
        <p className="eyebrow">Quiz Factory</p>
        <h1>{test.title}</h1>
        <p>{test.intro}</p>
      </header>

      <div className="test-meta">
        <span>Estimated time: 6 minutes</span>
      </div>

      <div className="cta-row">
        <Link className="primary-button" href={`/t/${test.slug}/run`}>
          Start test
        </Link>
        <Link className="text-link" href="/">
          Back to tests
        </Link>
      </div>
    </section>
  );
}

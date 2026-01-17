import Link from "next/link";

import { getTenantTestIds, resolveTestIdBySlug } from "../../../../lib/content/catalog";
import { loadLocalizedTest } from "../../../../lib/content/load";
import { resolveTenantContext } from "../../../../lib/tenants/request";

type PageProps = {
  params: {
    slug: string;
  };
};

const resolvePreviewTestId = (slug: string, tenantId: string): string | null => {
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

export default async function TestPreviewPage({ params }: PageProps) {
  const context = await resolveTenantContext();
  const testId = resolvePreviewTestId(params.slug, context.tenantId);

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
        <p>Scoring and report preview will be implemented in PR-PRODUCT-04.</p>
      </header>

      <div className="cta-row">
        <Link className="primary-button" href={`/t/${test.slug}`}>
          Back to details
        </Link>
      </div>
    </section>
  );
}

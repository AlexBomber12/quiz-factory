import Link from "next/link";

import { getTenantTestIds, resolveTestIdBySlug } from "../../../../lib/content/catalog";
import { loadLocalizedTest } from "../../../../lib/content/load";
import { resolveTenantContext } from "../../../../lib/tenants/request";

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
    <section className="page">
      <header className="hero">
        <p className="eyebrow">Quiz Factory</p>
        <h1>{test.title}</h1>
        <p>The test runner is not available yet. Check back soon.</p>
      </header>

      <div className="cta-row">
        <Link className="text-link" href={`/t/${test.slug}`}>
          Back to details
        </Link>
      </div>
    </section>
  );
}

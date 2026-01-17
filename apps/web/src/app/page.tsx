import type { Metadata } from "next";
import Link from "next/link";

import { loadTenantCatalog } from "../lib/content/catalog";
import { buildCanonicalUrl, resolveTenantContext } from "../lib/tenants/request";

export const generateMetadata = async (): Promise<Metadata> => {
  const context = await resolveTenantContext();
  const tests = loadTenantCatalog(context.tenantId, context.locale);
  const primaryTest = tests[0];
  const canonical = buildCanonicalUrl(context, "/");
  const ogImage = buildCanonicalUrl(context, "/og.png");

  const buildMetadata = (title: string, description: string): Metadata => {
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

  if (!primaryTest) {
    return buildMetadata(
      "Quiz Factory",
      "Browse the available tests and start when ready."
    );
  }

  return buildMetadata(primaryTest.title, primaryTest.short_description);
};

export default async function HomePage() {
  const context = await resolveTenantContext();
  const tests = loadTenantCatalog(context.tenantId, context.locale);

  return (
    <section className="page">
      <header className="hero">
        <p className="eyebrow">Quiz Factory</p>
        <h1>Pick a test to get started</h1>
        <p>Each test is short, focused, and built for mobile.</p>
      </header>

      {tests.length === 0 ? (
        <div className="empty-state">
          <h2>No tests available yet</h2>
          <p>
            Check that this domain is registered to a tenant and has tests listed in
            the catalog.
          </p>
        </div>
      ) : (
        <ul className="test-list">
          {tests.map((test) => (
            <li key={test.test_id} className="test-card">
              <Link className="test-link" href={`/t/${test.slug}`}>
                <h2 className="test-title">{test.title}</h2>
                <p className="test-description">{test.short_description}</p>
                <span className="test-cta">View details</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

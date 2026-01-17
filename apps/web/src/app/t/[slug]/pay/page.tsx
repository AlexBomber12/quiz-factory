import Link from "next/link";
import { cookies } from "next/headers";

import { getTenantTestIds, resolveTestIdBySlug } from "../../../../lib/content/catalog";
import { loadLocalizedTest } from "../../../../lib/content/load";
import {
  RESULT_COOKIE,
  verifyResultCookie
} from "../../../../lib/product/result_cookie";
import { resolveTenantContext } from "../../../../lib/tenants/request";
import PaywallClient from "./paywall-client";

type PageProps = {
  params: {
    slug: string;
  };
};

const resolvePaywallTestId = (slug: string, tenantId: string): string | null => {
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

export default async function PaywallPage({ params }: PageProps) {
  const context = await resolveTenantContext();
  const testId = resolvePaywallTestId(params.slug, context.tenantId);

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

  const cookieStore = await cookies();
  const resultCookieValue = cookieStore.get(RESULT_COOKIE)?.value ?? null;
  const resultPayload = resultCookieValue ? verifyResultCookie(resultCookieValue) : null;

  if (!resultPayload || resultPayload.test_id !== testId || resultPayload.tenant_id !== context.tenantId) {
    return (
      <section className="page">
        <header className="hero">
          <p className="eyebrow">Quiz Factory</p>
          <h1>Paywall unavailable</h1>
          <p>We could not confirm your result. Please retake the test.</p>
        </header>
        <Link className="primary-button" href={`/t/${params.slug}/run`}>
          Back to the test
        </Link>
      </section>
    );
  }

  const test = loadLocalizedTest(testId, context.locale);
  const options = [
    {
      id: "single",
      label: "Single report",
      priceLabel: "EUR 1.49",
      productType: "single",
      pricingVariant: "intro"
    },
    {
      id: "pack-5",
      label: "Pack 5 reports",
      priceLabel: "EUR 4.99",
      productType: "pack_5",
      pricingVariant: "base"
    },
    {
      id: "pack-10",
      label: "Pack 10 reports",
      priceLabel: "EUR 7.99",
      productType: "pack_10",
      pricingVariant: "base"
    }
  ] as const;

  return (
    <section className="page">
      <header className="hero">
        <p className="eyebrow">Quiz Factory</p>
        <h1>{test.paywall_headline}</h1>
        <p>Select the report option that fits you best.</p>
      </header>

      <PaywallClient
        testId={test.test_id}
        sessionId={resultPayload.session_id}
        options={options}
      />

      <div className="cta-row">
        <Link className="text-link" href={`/t/${test.slug}/preview`}>
          Back to preview
        </Link>
        <Link className="text-link" href={`/t/${test.slug}/run`}>
          Retake the test
        </Link>
      </div>
    </section>
  );
}

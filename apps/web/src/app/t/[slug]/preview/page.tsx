import Link from "next/link";
import { cookies } from "next/headers";

import { getTenantTestIds, resolveTestIdBySlug } from "../../../../lib/content/catalog";
import { loadLocalizedTest } from "../../../../lib/content/load";
import {
  RESULT_COOKIE,
  verifyResultCookie
} from "../../../../lib/product/result_cookie";
import { ATTEMPT_TOKEN_COOKIE_NAME } from "../../../../lib/security/attempt_token";
import { resolveTenantContext } from "../../../../lib/tenants/request";
import PreviewAnalytics from "./preview-analytics";

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

  const cookieStore = await cookies();
  const resultCookieValue = cookieStore.get(RESULT_COOKIE)?.value ?? null;
  const resultPayload = resultCookieValue ? verifyResultCookie(resultCookieValue) : null;

  if (!resultPayload || resultPayload.test_id !== testId || resultPayload.tenant_id !== context.tenantId) {
    return (
      <section className="page">
        <header className="hero">
          <p className="eyebrow">Quiz Factory</p>
          <h1>Preview unavailable</h1>
          <p>We could not load your preview. Please retake the test.</p>
        </header>
        <Link className="primary-button" href={`/t/${params.slug}/run`}>
          Back to the test
        </Link>
      </section>
    );
  }

  const test = loadLocalizedTest(testId, context.locale);
  const band = test.result_bands.find((candidate) => candidate.band_id === resultPayload.band_id);
  const bandCopy = band?.copy[test.locale];

  if (!band || !bandCopy) {
    return (
      <section className="page">
        <header className="hero">
          <p className="eyebrow">Quiz Factory</p>
          <h1>Preview unavailable</h1>
          <p>We could not load your preview. Please retake the test.</p>
        </header>
        <Link className="primary-button" href={`/t/${params.slug}/run`}>
          Back to the test
        </Link>
      </section>
    );
  }

  const attemptToken = cookieStore.get(ATTEMPT_TOKEN_COOKIE_NAME)?.value ?? null;

  return (
    <section className="page">
      <PreviewAnalytics
        testId={test.test_id}
        sessionId={resultPayload.session_id}
        attemptToken={attemptToken}
      />
      <header className="hero">
        <p className="eyebrow">Quiz Factory</p>
        <h1>{bandCopy.headline}</h1>
        <p>{bandCopy.summary}</p>
      </header>

      <div className="runner-card">
        <h2 className="runner-question">{test.title}</h2>
        <ul>
          {bandCopy.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </div>

      <div className="cta-row">
        <Link className="primary-button" href={`/t/${test.slug}`}>
          Back to details
        </Link>
        <Link className="text-link" href={`/t/${test.slug}/run`}>
          Retake the test
        </Link>
      </div>
    </section>
  );
}

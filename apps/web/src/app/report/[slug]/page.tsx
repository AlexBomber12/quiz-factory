import Link from "next/link";
import { cookies } from "next/headers";

import { getTenantTestIds, resolveTestIdBySlug } from "../../../lib/content/catalog";
import { REPORT_TOKEN, verifyReportToken } from "../../../lib/product/report_token";
import { RESULT_COOKIE, verifyResultCookie } from "../../../lib/product/result_cookie";
import { resolveTenantContext } from "../../../lib/tenants/request";
import ReportClient from "./report-client";

type PageProps = {
  params: {
    slug: string;
  };
};

const resolveReportTestId = (slug: string, tenantId: string): string | null => {
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

const renderBlocked = (slug: string) => {
  return (
    <section className="page">
      <header className="hero">
        <p className="eyebrow">Quiz Factory</p>
        <h1>Report locked</h1>
        <p>This report is available after checkout. Please return to the test to unlock it.</p>
      </header>
      <Link className="primary-button" href={`/t/${slug}`}>
        Back to the test
      </Link>
    </section>
  );
};

export default async function ReportPage({ params }: PageProps) {
  const context = await resolveTenantContext();
  const testId = resolveReportTestId(params.slug, context.tenantId);

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
  const reportTokenValue = cookieStore.get(REPORT_TOKEN)?.value ?? null;
  const reportPayload = reportTokenValue ? verifyReportToken(reportTokenValue) : null;
  const resultCookieValue = cookieStore.get(RESULT_COOKIE)?.value ?? null;
  const resultPayload = resultCookieValue ? verifyResultCookie(resultCookieValue) : null;

  if (!reportPayload || !resultPayload) {
    return renderBlocked(params.slug);
  }

  if (
    reportPayload.tenant_id !== context.tenantId ||
    reportPayload.test_id !== testId ||
    resultPayload.tenant_id !== reportPayload.tenant_id ||
    resultPayload.test_id !== reportPayload.test_id ||
    resultPayload.session_id !== reportPayload.session_id ||
    resultPayload.distinct_id !== reportPayload.distinct_id
  ) {
    return renderBlocked(params.slug);
  }

  return <ReportClient slug={params.slug} testId={testId} />;
}

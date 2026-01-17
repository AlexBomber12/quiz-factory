import Link from "next/link";
import { cookies } from "next/headers";

import { getTenantTestIds, resolveTestIdBySlug } from "../../../../lib/content/catalog";
import { loadLocalizedTest } from "../../../../lib/content/load";
import { REPORT_TOKEN, verifyReportToken } from "../../../../lib/product/report_token";
import { RESULT_COOKIE, verifyResultCookie } from "../../../../lib/product/result_cookie";
import { resolveTenantContext } from "../../../../lib/tenants/request";
import PrintTrigger from "./print-trigger";
import styles from "./print.module.css";

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
    <section className={`page ${styles.reportPrint}`}>
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

export default async function ReportPrintPage({ params }: PageProps) {
  const context = await resolveTenantContext();
  const testId = resolveReportTestId(params.slug, context.tenantId);

  if (!testId) {
    return (
      <section className={`page ${styles.reportPrint}`}>
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

  const test = loadLocalizedTest(testId, context.locale);
  const band = test.result_bands.find((candidate) => candidate.band_id === resultPayload.band_id);
  const bandCopy = band?.copy[test.locale];

  if (!band || !bandCopy) {
    return renderBlocked(params.slug);
  }

  const scaleEntries = Object.entries(resultPayload.scale_scores).sort((left, right) =>
    left[0].localeCompare(right[0])
  );
  const totalScore = scaleEntries.reduce((sum, [, value]) => sum + value, 0);

  return (
    <section className={`page ${styles.reportPrint}`}>
      <header className="hero">
        <p className="eyebrow">Quiz Factory</p>
        <h1>{test.report_title}</h1>
        <p>Print-friendly report.</p>
      </header>

      <div className={styles.printControls}>
        <PrintTrigger />
        <Link className="text-link" href={`/report/${test.slug}`}>
          Back to report
        </Link>
      </div>

      <div className="runner-card">
        <h2 className="runner-question">{bandCopy.headline}</h2>
        <p>{bandCopy.summary}</p>
        <ul>
          {bandCopy.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </div>

      {scaleEntries.length > 0 ? (
        <div className="runner-card">
          <h2 className="runner-question">Score breakdown</h2>
          <div className="test-meta">
            {scaleEntries.map(([scale, value]) => (
              <div key={scale}>
                <strong>{scale}:</strong> {value}
              </div>
            ))}
            <div>
              <strong>Total score:</strong> {totalScore}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

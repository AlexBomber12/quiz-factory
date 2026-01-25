import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";

import { getTenantTestIds, resolveTestIdBySlug } from "../../../../lib/content/catalog";
import { loadLocalizedTest } from "../../../../lib/content/load";
import { REPORT_TOKEN, verifyReportToken } from "../../../../lib/product/report_token";
import { RESULT_COOKIE, verifyResultCookie } from "../../../../lib/product/result_cookie";
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
import styles from "./print.module.css";
import PrintClient from "./print-client";

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

export const generateMetadata = async ({ params }: PageProps): Promise<Metadata> => {
  const context = await resolveTenantContext();
  const tenantSeo = resolveTenantSeoContext({ tenantId: context.tenantId });
  const tenantLabel = buildTenantLabel(context);
  const testId = resolveReportTestId(params.slug, context.tenantId);
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

  const path = `/report/${params.slug}/print`;
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
  const description = `${test.report_title} is ready to print.`;
  const ogPath = buildOgImagePath(`/report/${test.slug}/opengraph-image`, seo.token);
  const ogImage = buildCanonical(context, ogPath) ?? fallbackOgImage;
  const title = `${test.report_title} (${test.slug}) - Print | ${tenantLabel} | Quiz Factory`;

  return buildMetadata(title, description, path, canonical, ogImage, seo.locales);
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

  return <PrintClient slug={params.slug} testId={testId} />;
}

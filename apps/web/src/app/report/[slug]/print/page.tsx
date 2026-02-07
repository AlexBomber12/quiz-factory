import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";

import { REPORT_TOKEN, verifyReportToken } from "../../../../lib/product/report_token";
import { RESULT_COOKIE, verifyResultCookie } from "../../../../lib/product/result_cookie";
import type { LocaleTag } from "../../../../lib/content/types";
import { loadPublishedTestBySlug } from "../../../../lib/content/provider";
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
  searchParams?: Record<string, string | string[] | undefined>;
};

const loadReportTest = (tenantId: string, slug: string, locale: string) => {
  return loadPublishedTestBySlug(tenantId, slug, locale);
};

const resolveTokenParam = (
  value: string | string[] | undefined
): string | null => {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0]?.trim() ?? null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
  const published = await loadReportTest(context.tenantId, params.slug, context.locale);
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

  if (!published) {
    return buildMetadata(
      `${tenantLabel} | Quiz Factory`,
      "This test is not available for this tenant.",
      path,
      canonical,
      fallbackOgImage,
      tenantSeo.locales
    );
  }

  const test = published.test;
  const seo = resolveSeoTestContext({
    tenantId: context.tenantId,
    testId: published.test_id
  });
  const description = `${test.report_title} is ready to print.`;
  const ogPath = buildOgImagePath(`/report/${test.slug}/opengraph-image`, seo.token);
  const ogImage = buildCanonical(context, ogPath) ?? fallbackOgImage;
  const title = `${test.report_title} (${test.slug}) - Print | ${tenantLabel} | Quiz Factory`;

  return buildMetadata(title, description, path, canonical, ogImage, seo.locales);
};

export default async function ReportPrintPage({ params, searchParams }: PageProps) {
  const context = await resolveTenantContext();
  const published = await loadReportTest(context.tenantId, params.slug, context.locale);
  const queryReportToken = resolveTokenParam(searchParams?.t);

  if (!published) {
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

  const hasCookieAccess =
    reportPayload &&
    resultPayload &&
    reportPayload.tenant_id === context.tenantId &&
    reportPayload.test_id === published.test_id &&
    resultPayload.tenant_id === reportPayload.tenant_id &&
    resultPayload.test_id === reportPayload.test_id &&
    resultPayload.session_id === reportPayload.session_id &&
    resultPayload.distinct_id === reportPayload.distinct_id;

  if (!hasCookieAccess && !queryReportToken) {
    return renderBlocked(params.slug);
  }

  return (
      <PrintClient
        slug={params.slug}
        testId={published.test_id}
        reportLinkToken={queryReportToken}
      />
  );
}

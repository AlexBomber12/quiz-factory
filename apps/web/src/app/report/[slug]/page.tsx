import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";

import { createReportKey } from "@/lib/credits";
import { REPORT_TOKEN, verifyReportToken } from "@/lib/product/report_token";
import { RESULT_COOKIE, verifyResultCookie } from "@/lib/product/result_cookie";
import { issueReportLinkToken } from "@/lib/report_link_token";
import { resolveReportPdfMode } from "@/lib/report/pdf_mode";
import type { LocaleTag } from "@/lib/content/types";
import { loadPublishedTestBySlug } from "@/lib/content/provider";
import {
  buildCanonical,
  buildLocaleAlternatesForPath,
  buildOgImagePath,
  buildOpenGraphLocales,
  buildTenantLabel,
  resolveSeoTestContext,
  resolveTenantSeoContext
} from "@/lib/seo/metadata";
import {
  resolveRouteParams,
  resolveTestMetadataCopy,
  safeLowercaseSlug,
  safeTrim
} from "@/lib/seo/metadata_safety";
import { resolveTenantContext } from "@/lib/tenants/request";
import ReportClient from "./report-client";

type SlugParams = {
  slug?: string;
};

type PageProps = {
  params: Promise<SlugParams> | SlugParams;
  searchParams?: Record<string, string | string[] | undefined>;
};

const REPORT_LINK_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

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

const resolveSlugParam = async (params: PageProps["params"]): Promise<string> => {
  const resolved = await resolveRouteParams(params);
  return safeLowercaseSlug(resolved.slug, "test");
};

export const generateMetadata = async ({ params }: PageProps): Promise<Metadata> => {
  const routeSlug = await resolveSlugParam(params);
  const context = await resolveTenantContext();
  const tenantSeo = resolveTenantSeoContext({ tenantId: context.tenantId });
  const tenantLabel = buildTenantLabel(context);
  const published = await loadReportTest(context.tenantId, routeSlug, context.locale).catch(
    () => null
  );
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

  const path = `/report/${routeSlug}`;
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
  const reportTitle = safeTrim(test.report_title, "");
  const metadataCopy = resolveTestMetadataCopy({
    routeSlug,
    slug: test.slug,
    title: reportTitle,
    descriptionCandidates: [reportTitle ? `${reportTitle} is ready.` : ""],
    spec: published.spec,
    locale: published.locale,
    fallbackDescription: "Your report is ready."
  });
  const pathWithSlug = `/report/${metadataCopy.slug}`;
  const pathCanonical = buildCanonical(context, pathWithSlug);
  const ogPath = buildOgImagePath(`/report/${metadataCopy.slug}/opengraph-image`, seo.token);
  const ogImage = buildCanonical(context, ogPath) ?? fallbackOgImage;
  const title = `${metadataCopy.title} (${metadataCopy.slug}) | ${tenantLabel} | Quiz Factory`;

  return buildMetadata(
    title,
    metadataCopy.description,
    pathWithSlug,
    pathCanonical,
    ogImage,
    seo.locales
  );
};

export default async function ReportPage({ params, searchParams }: PageProps) {
  const routeSlug = await resolveSlugParam(params);
  const context = await resolveTenantContext();
  const published = await loadReportTest(context.tenantId, routeSlug, context.locale);
  const pdfMode = resolveReportPdfMode();
  const queryReportToken = resolveTokenParam(searchParams?.t);

  if (!published) {
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

  const test = published.test;
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
    return renderBlocked(routeSlug);
  }

  let reportLinkToken = queryReportToken;

  if (hasCookieAccess && reportPayload && resultPayload) {
    const expiresAt = new Date(Date.now() + REPORT_LINK_TOKEN_TTL_SECONDS * 1000);
    const reportKey = createReportKey(
      context.tenantId,
      published.test_id,
      reportPayload.session_id
    );
    reportLinkToken = issueReportLinkToken({
      tenant_id: context.tenantId,
      test_id: published.test_id,
      report_key: reportKey,
      locale: context.locale,
      expires_at: expiresAt,
      purchase_id: reportPayload.purchase_id,
      session_id: reportPayload.session_id,
      band_id: resultPayload.band_id,
      computed_at_utc: resultPayload.computed_at_utc,
      scale_scores: resultPayload.scale_scores
    });
  }

  const resolvedSlug = safeLowercaseSlug(test.slug, routeSlug);
  const sharePath = `/t/${resolvedSlug}`;
  const shareUrl = buildCanonical(context, sharePath);
  const shareTitle = test.title;
  const reportLinkPath = reportLinkToken
    ? `/report/${resolvedSlug}?t=${encodeURIComponent(reportLinkToken)}`
    : null;
  const reportLinkUrl = reportLinkPath
    ? buildCanonical(context, reportLinkPath) ?? reportLinkPath
    : null;

  return (
    <ReportClient
      slug={resolvedSlug}
      testId={published.test_id}
      sharePath={sharePath}
      shareUrl={shareUrl}
      reportLinkToken={reportLinkToken}
      reportLinkUrl={reportLinkUrl}
      shareTitle={shareTitle}
      pdfMode={pdfMode}
    />
  );
}

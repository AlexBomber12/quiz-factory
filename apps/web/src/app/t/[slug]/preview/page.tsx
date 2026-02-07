import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";

import type { LocaleTag } from "../../../../lib/content/types";
import { loadPublishedTestBySlug } from "../../../../lib/content/provider";
import {
  RESULT_COOKIE,
  verifyResultCookie
} from "../../../../lib/product/result_cookie";
import { ATTEMPT_TOKEN_COOKIE_NAME } from "../../../../lib/security/attempt_token";
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
import PreviewAnalytics from "./preview-analytics";

type PageProps = {
  params: {
    slug: string;
  };
};

const loadPreviewTest = (tenantId: string, slug: string, locale: string) => {
  return loadPublishedTestBySlug(tenantId, slug, locale);
};

export const generateMetadata = async ({ params }: PageProps): Promise<Metadata> => {
  const context = await resolveTenantContext();
  const tenantSeo = resolveTenantSeoContext({ tenantId: context.tenantId });
  const tenantLabel = buildTenantLabel(context);
  const published = await loadPreviewTest(context.tenantId, params.slug, context.locale);
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

  const path = `/t/${params.slug}/preview`;
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
  const description = test.description;
  const ogPath = buildOgImagePath(`/t/${test.slug}/opengraph-image`, seo.token);
  const ogImage = buildCanonical(context, ogPath) ?? fallbackOgImage;
  const title = `${test.title} (${test.slug}) - Preview | ${tenantLabel} | Quiz Factory`;

  return buildMetadata(title, description, path, canonical, ogImage, seo.locales);
};

export default async function TestPreviewPage({ params }: PageProps) {
  const context = await resolveTenantContext();
  const published = await loadPreviewTest(context.tenantId, params.slug, context.locale);

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
  const resultCookieValue = cookieStore.get(RESULT_COOKIE)?.value ?? null;
  const resultPayload = resultCookieValue ? verifyResultCookie(resultCookieValue) : null;

  if (
    !resultPayload ||
    resultPayload.test_id !== published.test_id ||
    resultPayload.tenant_id !== context.tenantId
  ) {
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
        <Link className="primary-button" href={`/t/${test.slug}/pay`}>
          Unlock full report
        </Link>
        <Link className="text-link" href={`/t/${test.slug}/run`}>
          Retake the test
        </Link>
      </div>
    </section>
  );
}

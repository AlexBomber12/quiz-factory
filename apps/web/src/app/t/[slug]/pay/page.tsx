import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";

import { getTenantTestIds, resolveTestIdBySlug } from "../../../../lib/content/catalog";
import { loadLocalizedTest } from "../../../../lib/content/load";
import type { LocaleTag } from "../../../../lib/content/types";
import {
  RESULT_COOKIE,
  verifyResultCookie
} from "../../../../lib/product/result_cookie";
import { createReportKey, parseCreditsCookie } from "../../../../lib/credits";
import { isOfferKey, listOffers } from "../../../../lib/pricing";
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
import PaywallClient from "./paywall-client";

type PageProps = {
  params: {
    slug: string;
  };
  searchParams?: {
    offer_key?: string | string[];
    is_upsell?: string | string[];
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

const parseIsUpsellParam = (value: string | string[] | undefined): boolean => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (!rawValue) {
    return false;
  }

  const normalized = rawValue.trim().toLowerCase();
  return normalized === "true" || normalized === "1";
};

export const generateMetadata = async ({ params }: PageProps): Promise<Metadata> => {
  const context = await resolveTenantContext();
  const tenantSeo = resolveTenantSeoContext({ tenantId: context.tenantId });
  const tenantLabel = buildTenantLabel(context);
  const testId = resolvePaywallTestId(params.slug, context.tenantId);
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

  const path = `/t/${params.slug}/pay`;
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
  const description = test.description;
  const ogPath = buildOgImagePath(`/t/${test.slug}/opengraph-image`, seo.token);
  const ogImage = buildCanonical(context, ogPath) ?? fallbackOgImage;
  const title = `${test.paywall_headline} (${test.slug}) | ${tenantLabel} | Quiz Factory`;

  return buildMetadata(title, description, path, canonical, ogImage, seo.locales);
};

export default async function PaywallPage({ params, searchParams }: PageProps) {
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
  const creditsState = parseCreditsCookie(cookieStore, context.tenantId);
  const reportKey = createReportKey(context.tenantId, testId, resultPayload.session_id);
  const creditsRemaining = creditsState.credits_remaining;
  const hasGrantReference =
    creditsState.last_grant !== null || creditsState.grant_ids.length > 0;
  const hasReportAccess =
    hasGrantReference &&
    (creditsRemaining > 0 || creditsState.consumed_report_keys.includes(reportKey));
  const offerKeyParam = searchParams?.offer_key;
  const offerKeyCandidate = Array.isArray(offerKeyParam) ? offerKeyParam[0] : offerKeyParam;
  const preferredOfferKey = isOfferKey(offerKeyCandidate) ? offerKeyCandidate : null;
  const isUpsell = parseIsUpsellParam(searchParams?.is_upsell);
  const priceFormatter = new Intl.NumberFormat(context.locale, {
    style: "currency",
    currency: "EUR"
  });
  const options = listOffers().map((offer) => ({
    offerKey: offer.offer_key,
    label: offer.ui.label,
    badge: offer.ui.badge,
    description: offer.ui.description,
    priceLabel: priceFormatter.format(offer.display_price_eur)
  }));

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
        slug={test.slug}
        options={options}
        creditsRemaining={creditsRemaining}
        hasReportAccess={hasReportAccess}
        preferredOfferKey={preferredOfferKey}
        isUpsell={isUpsell}
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

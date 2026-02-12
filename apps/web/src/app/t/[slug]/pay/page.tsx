import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";

import type { LocaleTag } from "../../../../lib/content/types";
import { loadPublishedTestBySlug } from "../../../../lib/content/provider";
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
import {
  resolveRouteParams,
  resolveTestMetadataCopy,
  safeLowercaseSlug
} from "../../../../lib/seo/metadata_safety";
import { resolveTenantContext } from "../../../../lib/tenants/request";
import PaywallClient from "./paywall-client";

type SlugParams = {
  slug?: string;
};

type PageProps = {
  params: Promise<SlugParams> | SlugParams;
  searchParams?:
    | {
        offer_key?: string | string[];
        is_upsell?: string | string[];
      }
    | Promise<{
        offer_key?: string | string[];
        is_upsell?: string | string[];
      }>;
};

const loadPaywallTest = (tenantId: string, slug: string, locale: string) => {
  return loadPublishedTestBySlug(tenantId, slug, locale);
};

const parseIsUpsellParam = (value: string | string[] | undefined): boolean => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (!rawValue) {
    return false;
  }

  const normalized = rawValue.trim().toLowerCase();
  return normalized === "true" || normalized === "1";
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
  const published = await loadPaywallTest(context.tenantId, routeSlug, context.locale).catch(
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

  const path = `/t/${routeSlug}/pay`;
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
  const metadataCopy = resolveTestMetadataCopy({
    routeSlug,
    slug: test.slug,
    title: test.paywall_headline,
    descriptionCandidates: [test.description],
    spec: published.spec,
    locale: published.locale,
    fallbackDescription: "Unlock your full report after checkout."
  });
  const pathWithSlug = `/t/${metadataCopy.slug}/pay`;
  const pathCanonical = buildCanonical(context, pathWithSlug);
  const ogPath = buildOgImagePath(`/t/${metadataCopy.slug}/opengraph-image`, seo.token);
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

export default async function PaywallPage({ params, searchParams }: PageProps) {
  const routeSlug = await resolveSlugParam(params);
  const resolvedSearchParams = await searchParams;
  const context = await resolveTenantContext();
  const published = await loadPaywallTest(context.tenantId, routeSlug, context.locale);

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
          <h1>Paywall unavailable</h1>
          <p>We could not confirm your result. Please retake the test.</p>
        </header>
        <Link className="primary-button" href={`/t/${routeSlug}/run`}>
          Back to the test
        </Link>
      </section>
    );
  }

  const creditsState = parseCreditsCookie(cookieStore, context.tenantId);
  const reportKey = createReportKey(context.tenantId, published.test_id, resultPayload.session_id);
  const creditsRemaining = creditsState.credits_remaining;
  const hasGrantReference =
    creditsState.last_grant !== null || creditsState.grant_ids.length > 0;
  const hasReportAccess =
    hasGrantReference &&
    (creditsRemaining > 0 || creditsState.consumed_report_keys.includes(reportKey));
  const offerKeyParam = resolvedSearchParams?.offer_key;
  const offerKeyCandidate = Array.isArray(offerKeyParam) ? offerKeyParam[0] : offerKeyParam;
  const preferredOfferKey = isOfferKey(offerKeyCandidate) ? offerKeyCandidate : null;
  const isUpsell = parseIsUpsellParam(resolvedSearchParams?.is_upsell);
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

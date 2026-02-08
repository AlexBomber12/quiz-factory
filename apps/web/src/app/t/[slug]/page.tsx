import type { Metadata } from "next";
import Link from "next/link";

import { PublicPage } from "../../../components/public/PublicPage";
import { buildTestLandingProps } from "../../../components/public/test_landing_props";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "../../../components/ui/card";
import { resolveTenantTestBySlug } from "../../../lib/catalog/catalog";
import { loadPublishedTestBySlug } from "../../../lib/content/provider";
import {
  buildCanonical,
  buildLocaleAlternatesForPath,
  buildOgImagePath,
  buildOpenGraphLocales,
  buildTenantLabel,
  resolveSeoTestContext,
  resolveTenantSeoContext
} from "../../../lib/seo/metadata";
import { resolveTenantContext, type TenantRequestContext } from "../../../lib/tenants/request";
import { FaqBlock } from "../../../studio/blocks/FaqBlock";
import { FooterBlock } from "../../../studio/blocks/FooterBlock";
import { HeroBlock } from "../../../studio/blocks/HeroBlock";
import { HowItWorksBlock } from "../../../studio/blocks/HowItWorksBlock";
import { NavbarBlock } from "../../../studio/blocks/NavbarBlock";
import { SocialProofBlock } from "../../../studio/blocks/SocialProofBlock";

type PageProps = {
  params: {
    slug: string;
  };
};

export const generateMetadata = async ({ params }: PageProps): Promise<Metadata> => {
  const context = await resolveTenantContext();
  const test = await resolveTenantTestBySlug(context.tenantId, context.locale, params.slug);
  const tenantSeo = resolveTenantSeoContext({ tenantId: context.tenantId });
  const tenantLabel = buildTenantLabel(context);
  const fallbackOgImage = buildCanonical(context, "/og.png");

  const buildMetadata = (
    title: string,
    description: string,
    path: string,
    canonical: string | null,
    ogImage: string | null,
    locales: ReadonlyArray<TenantRequestContext["locale"]>
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

  if (!test) {
    const path = `/t/${params.slug}`;
    const canonical = buildCanonical(context, path);
    return buildMetadata(
      `${tenantLabel} | Quiz Factory`,
      "This test is not available for this tenant.",
      path,
      canonical,
      fallbackOgImage,
      tenantSeo.locales
    );
  }

  const seo = resolveSeoTestContext({
    tenantId: context.tenantId,
    testId: test.test_id
  });
  const path = `/t/${test.slug}`;
  const canonical = buildCanonical(context, path);
  const ogPath = buildOgImagePath(`/t/${test.slug}/opengraph-image`, seo.token);
  const ogImage = buildCanonical(context, ogPath) ?? fallbackOgImage;
  const title = `${test.title} (${test.slug}) | ${tenantLabel} | Quiz Factory`;

  return buildMetadata(
    title,
    test.short_description,
    path,
    canonical,
    ogImage,
    seo.locales
  );
};

export default async function TestLandingPage({ params }: PageProps) {
  const context = await resolveTenantContext();
  const test = await resolveTenantTestBySlug(context.tenantId, context.locale, params.slug);

  if (!test) {
    return (
      <PublicPage>
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle>Test not available</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Choose a test from the tenant catalog to continue.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline">
              <Link href="/tests">Back to tests</Link>
            </Button>
          </CardFooter>
        </Card>
      </PublicPage>
    );
  }

  const published = await loadPublishedTestBySlug(context.tenantId, test.slug, context.locale);
  const landing = buildTestLandingProps(test, published);

  return (
    <PublicPage>
      <NavbarBlock {...landing.navbar} />
      <HeroBlock {...landing.hero} />
      <HowItWorksBlock {...landing.howItWorks} />
      <section id={landing.whatYouGet.id} className="studio-block">
        <div className="studio-section__header">
          <p className="studio-eyebrow">What you get</p>
          <h2 className="studio-section-title">{landing.whatYouGet.title}</h2>
          <p className="studio-section-lede">{landing.whatYouGet.subtitle}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/60 bg-white/90">
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">{landing.whatYouGet.freePreview.title}</CardTitle>
              <CardDescription>Immediate value before any payment.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                {landing.whatYouGet.freePreview.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-white/90">
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">{landing.whatYouGet.fullReport.title}</CardTitle>
              <CardDescription>More depth once you unlock the complete report.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                {landing.whatYouGet.fullReport.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{landing.whatYouGet.disclaimer}</p>
      </section>
      <SocialProofBlock {...landing.socialProof} />
      <FaqBlock {...landing.faq} />
      <FooterBlock {...landing.footer} />
    </PublicPage>
  );
}

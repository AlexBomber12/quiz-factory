import type { Metadata } from "next";

import {
  buildCanonical,
  buildLocaleAlternatesForPath,
  buildOpenGraphLocales,
  buildTenantLabel,
  resolveTenantSeoContext
} from "@/lib/seo/metadata";
import { resolveTenantContext } from "@/lib/tenants/request";
import CheckoutSuccessClient from "./checkout-success-client";

export const generateMetadata = async (): Promise<Metadata> => {
  const context = await resolveTenantContext();
  const tenantSeo = resolveTenantSeoContext({ tenantId: context.tenantId });
  const tenantLabel = buildTenantLabel(context);
  const path = "/checkout/success";
  const canonical = buildCanonical(context, path);
  const languages = buildLocaleAlternatesForPath(context, path, tenantSeo.locales);
  const { ogLocale, alternateLocale } = buildOpenGraphLocales(context.locale, tenantSeo.locales);
  const ogImage = buildCanonical(context, "/og.png");
  const title = `Checkout success | ${tenantLabel} | Quiz Factory`;
  const description = "We are confirming your checkout and preparing your report.";

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

export default function CheckoutSuccessPage() {
  return <CheckoutSuccessClient />;
}

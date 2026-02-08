import type { Metadata } from "next";

import {
  buildCanonical,
  buildLocaleAlternatesForPath,
  buildOpenGraphLocales,
  buildTenantLabel,
  resolveTenantSeoContext
} from "../seo/metadata";
import { resolveTenantContext } from "../tenants/request";

type HubMetadataOptions = {
  path: string;
  title: string;
  description: string;
};

export const buildHubPageMetadata = async (
  options: HubMetadataOptions
): Promise<Metadata> => {
  const context = await resolveTenantContext();
  const tenantSeo = resolveTenantSeoContext({ tenantId: context.tenantId });
  const tenantLabel = buildTenantLabel(context);
  const title = `${options.title} | ${tenantLabel} | Quiz Factory`;
  const canonical = buildCanonical(context, options.path);
  const ogImage = buildCanonical(context, "/og.png");
  const languages = buildLocaleAlternatesForPath(context, options.path, tenantSeo.locales);
  const { ogLocale, alternateLocale } = buildOpenGraphLocales(context.locale, tenantSeo.locales);

  const metadata: Metadata = {
    title,
    description: options.description,
    openGraph: {
      title,
      description: options.description,
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

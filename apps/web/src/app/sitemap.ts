import type { MetadataRoute } from "next";

import { loadTenantCatalog } from "../lib/content/catalog";
import { buildCanonicalUrl, resolveTenantContext } from "../lib/tenants/request";

const isDefined = (value: string | null): value is string => {
  return Boolean(value);
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const context = await resolveTenantContext();
  const tests = loadTenantCatalog(context.tenantId, context.locale);
  const urls = [
    buildCanonicalUrl(context, "/"),
    ...tests.map((test) => buildCanonicalUrl(context, `/t/${test.slug}`))
  ].filter(isDefined);

  return urls.map((url) => ({ url }));
}

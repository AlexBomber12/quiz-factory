import type { MetadataRoute } from "next";

import { listCatalogForTenant } from "../lib/content/provider";
import { resolveSeoTestContext, resolveTenantSeoContext } from "../lib/seo/metadata";
import { buildCanonicalUrl, resolveTenantContext } from "../lib/tenants/request";

const isDefined = <T>(value: T | null): value is T => {
  return value !== null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const context = await resolveTenantContext();
  const tests = await listCatalogForTenant(context.tenantId);
  const tenantSeo = resolveTenantSeoContext({ tenantId: context.tenantId });
  const homeUrl = buildCanonicalUrl(context, "/");
  const homeEntry = homeUrl
    ? {
        url: homeUrl,
        lastModified: tenantSeo.lastmod
      }
    : null;

  const testEntries = tests
    .map((test) => {
      const url = buildCanonicalUrl(context, `/t/${test.slug}`);
      if (!url) {
        return null;
      }

      const seo = resolveSeoTestContext({
        tenantId: context.tenantId,
        testId: test.test_id
      });

      return {
        url,
        lastModified: seo.lastmod
      };
    })
    .filter(isDefined);

  return [homeEntry, ...testEntries].filter(isDefined);
}

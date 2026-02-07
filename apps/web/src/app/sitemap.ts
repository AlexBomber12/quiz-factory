import type { MetadataRoute } from "next";

import { listCatalogForTenant, resolveContentSource } from "../lib/content/provider";
import { resolveSeoTestContext, resolveTenantSeoContext } from "../lib/seo/metadata";
import {
  readTenantSitemap,
  type TenantSitemapCacheContext,
  writeTenantSitemap
} from "../lib/seo/sitemap_cache";
import { buildCanonicalUrl, resolveTenantContext } from "../lib/tenants/request";

const isDefined = <T>(value: T | null): value is T => {
  return value !== null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const context = await resolveTenantContext();
  const shouldUseCache = resolveContentSource() === "db";
  const cacheContext: TenantSitemapCacheContext = {
    tenantId: context.tenantId,
    host: context.host,
    requestHost: context.requestHost,
    protocol: context.protocol
  };
  if (shouldUseCache) {
    const cached = readTenantSitemap<MetadataRoute.Sitemap>(cacheContext);
    if (cached !== null) {
      return cached;
    }
  }

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

  const sitemapEntries = [homeEntry, ...testEntries].filter(isDefined);
  if (shouldUseCache) {
    return writeTenantSitemap(cacheContext, sitemapEntries);
  }

  return sitemapEntries;
}

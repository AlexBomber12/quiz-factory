import type { MetadataRoute } from "next";

import { buildCanonicalUrl, resolveTenantContext } from "../lib/tenants/request";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const context = await resolveTenantContext();
  const sitemap = buildCanonicalUrl(context, "/sitemap.xml");

  const rules = {
    userAgent: "*",
    allow: "/",
    disallow: ["/t/*/run", "/t/*/preview", "/t/*/pay", "/report/*", "/checkout/*"]
  };

  const response: MetadataRoute.Robots = { rules };
  if (sitemap) {
    response.sitemap = sitemap;
  }
  return response;
}

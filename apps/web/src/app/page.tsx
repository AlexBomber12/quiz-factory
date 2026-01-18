import type { Metadata } from "next";

import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { loadTenantCatalog } from "../lib/content/catalog";
import { buildCanonicalUrl, resolveTenantContext } from "../lib/tenants/request";

export const generateMetadata = async (): Promise<Metadata> => {
  const context = await resolveTenantContext();
  const tests = loadTenantCatalog(context.tenantId, context.locale);
  const primaryTest = tests[0];
  const canonical = buildCanonicalUrl(context, "/");
  const ogImage = buildCanonicalUrl(context, "/og.png");

  const buildMetadata = (title: string, description: string): Metadata => {
    const metadata: Metadata = {
      title,
      description,
      openGraph: {
        title,
        description,
        url: canonical ?? undefined,
        images: ogImage ? [{ url: ogImage }] : undefined
      }
    };
    if (canonical) {
      metadata.alternates = { canonical };
    }
    return metadata;
  };

  if (!primaryTest) {
    return buildMetadata(
      "Quiz Factory",
      "Browse the available tests and start when ready."
    );
  }

  return buildMetadata(primaryTest.title, primaryTest.short_description);
};

export default function HomePage() {
  return (
    <section className="flex flex-col gap-6">
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl">Quiz Factory</CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            A calm placeholder while the UI foundation settles in.
          </CardDescription>
        </CardHeader>
      </Card>
    </section>
  );
}

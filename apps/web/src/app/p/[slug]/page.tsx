import Link from "next/link";

import { PublicPage } from "../../../components/public/PublicPage";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "../../../components/ui/card";
import { loadPublishedProductBySlug } from "../../../lib/content/provider";
import { resolveTenantContext } from "../../../lib/tenants/request";

type SlugParams = {
  slug?: string;
};

type PageProps = {
  params: Promise<SlugParams> | SlugParams;
};

const resolveSlugParam = async (params: PageProps["params"]): Promise<string> => {
  const resolved = await Promise.resolve(params);
  const slug = typeof resolved.slug === "string" ? resolved.slug.trim().toLowerCase() : "";
  return slug || "product";
};

export default async function ProductDetailPage({ params }: PageProps) {
  const routeSlug = await resolveSlugParam(params);
  const context = await resolveTenantContext();
  const published = await loadPublishedProductBySlug(context.tenantId, routeSlug, context.locale);

  if (!published) {
    return (
      <PublicPage>
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle>Product not available</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Choose another product from the tenant catalog.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline">
              <Link href="/products">Back to products</Link>
            </Button>
          </CardFooter>
        </Card>
      </PublicPage>
    );
  }

  return (
    <PublicPage>
      <Card>
        <CardHeader>
          <CardTitle>{published.product.title}</CardTitle>
          <CardDescription>
            {published.product.description || "No description available."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            <span className="font-medium text-muted-foreground">product_id:</span>{" "}
            <code>{published.product_id}</code>
          </p>
          <p>
            <span className="font-medium text-muted-foreground">slug:</span>{" "}
            <code>{published.slug}</code>
          </p>
          <p>
            <span className="font-medium text-muted-foreground">price:</span>{" "}
            {published.product.price ?? "-"}
          </p>

          {published.product.images.length > 0 ? (
            <div className="space-y-2">
              <p className="font-medium text-muted-foreground">images</p>
              <ul className="list-disc space-y-1 pl-5">
                {published.product.images.map((image) => (
                  <li key={image}>
                    <code className="break-all">{image}</code>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {published.product.attributes.length > 0 ? (
            <div className="space-y-2">
              <p className="font-medium text-muted-foreground">attributes</p>
              <ul className="list-disc space-y-1 pl-5">
                {published.product.attributes.map((attribute) => (
                  <li key={`${attribute.key}:${attribute.value}`}>
                    <span className="font-medium">{attribute.key}:</span> {attribute.value || "-"}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/products">Back to products</Link>
          </Button>
          <Button asChild>
            <Link href="/tests">Browse tests</Link>
          </Button>
        </CardFooter>
      </Card>
    </PublicPage>
  );
}

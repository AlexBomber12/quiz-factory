import Link from "next/link";

import { PublicPage } from "../../components/public/PublicPage";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "../../components/ui/card";
import { listTenantProducts } from "../../lib/content/provider";
import { resolveTenantContext } from "../../lib/tenants/request";

export default async function ProductsPage() {
  const context = await resolveTenantContext();
  const products = await listTenantProducts(context.tenantId, context.locale);

  return (
    <PublicPage>
      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
          <CardDescription>
            Published products for <code>{context.tenantId}</code>.
          </CardDescription>
        </CardHeader>
      </Card>

      {products.length === 0 ? (
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle>No products published yet</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              This tenant does not currently have published products.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline">
              <Link href="/tests">Browse tests</Link>
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <Card className="h-full" key={product.product_id}>
              <CardHeader className="space-y-2">
                <CardTitle>{product.title}</CardTitle>
                <CardDescription>{product.description || "No description available."}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <span className="font-medium text-muted-foreground">product_id:</span>{" "}
                  <code>{product.product_id}</code>
                </p>
                <p>
                  <span className="font-medium text-muted-foreground">slug:</span>{" "}
                  <code>{product.slug}</code>
                </p>
                <p>
                  <span className="font-medium text-muted-foreground">price:</span>{" "}
                  {product.price ?? "-"}
                </p>
              </CardContent>
              <CardFooter>
                <Button asChild variant="outline">
                  <Link href={`/p/${encodeURIComponent(product.slug)}`}>View product</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </PublicPage>
  );
}

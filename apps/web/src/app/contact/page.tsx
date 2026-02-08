import type { Metadata } from "next";
import Link from "next/link";

import { PublicNav } from "../../components/public/PublicNav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { buildHubPageMetadata } from "../../lib/hub/metadata";

const CONTACT_EMAIL = "support@example.com";

export const generateMetadata = async (): Promise<Metadata> => {
  return buildHubPageMetadata({
    path: "/contact",
    title: "Contact",
    description: "Contact the team for support and policy questions."
  });
};

export default function ContactPage() {
  return (
    <section className="flex flex-col gap-6">
      <PublicNav />
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl">Contact</CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            For support or policy questions, contact us by email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Email: <Link className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>
          </p>
          <p>We usually respond within two business days.</p>
        </CardContent>
      </Card>
    </section>
  );
}

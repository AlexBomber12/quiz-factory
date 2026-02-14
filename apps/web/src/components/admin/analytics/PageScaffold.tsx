import Link from "next/link";
import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import AdminAnalyticsFilterBar from "./FilterBar";

type AdminAnalyticsPageLink = {
  href: string;
  label: string;
};

type AdminAnalyticsPageScaffoldProps = {
  title: string;
  description: string;
  links?: AdminAnalyticsPageLink[];
  children?: ReactNode;
};

export default function AdminAnalyticsPageScaffold({
  title,
  description,
  links = [],
  children
}: AdminAnalyticsPageScaffoldProps) {
  return (
    <section className="mx-auto flex w-full flex-col gap-6 py-2">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>
            Querystring-backed placeholders for date range, tenant_id, test_id, locale, device_type, and
            utm_source.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminAnalyticsFilterBar />
        </CardContent>
      </Card>

      {links.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Related pages</CardTitle>
            <CardDescription>Use these links to move between analytics views.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {links.map((link) => (
              <Link
                className="text-primary underline underline-offset-4 hover:no-underline"
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {children}
    </section>
  );
}

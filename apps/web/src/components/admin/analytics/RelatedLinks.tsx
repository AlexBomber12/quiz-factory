"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { mergeHrefWithSearchParams } from "./related_links";

type AdminAnalyticsPageLink = {
  href: string;
  label: string;
};

type AdminAnalyticsRelatedLinksProps = {
  links: AdminAnalyticsPageLink[];
};

export default function AdminAnalyticsRelatedLinks({ links }: AdminAnalyticsRelatedLinksProps) {
  const searchParams = useSearchParams();
  const currentSearchParams = new URLSearchParams(searchParams.toString());

  return links.map((link) => (
    <Link
      className="text-primary underline underline-offset-4 hover:no-underline"
      href={mergeHrefWithSearchParams(link.href, currentSearchParams)}
      key={link.href}
    >
      {link.label}
    </Link>
  ));
}

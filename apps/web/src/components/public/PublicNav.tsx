import Link from "next/link";

import { Button } from "../ui/button";
import { Separator } from "../ui/separator";

const NAV_LINKS = [
  {
    label: "Tests",
    href: "/tests"
  },
  {
    label: "Categories",
    href: "/categories"
  },
  {
    label: "About",
    href: "/about"
  }
] as const;

export function PublicNav() {
  return (
    <nav className="space-y-3" aria-label="Public navigation">
      <div className="flex flex-wrap gap-2">
        {NAV_LINKS.map((link) => {
          return (
            <Button key={link.href} asChild variant="ghost" size="sm" className="px-2">
              <Link href={link.href}>{link.label}</Link>
            </Button>
          );
        })}
      </div>
      <Separator />
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "../../lib/ui/cn";

type AdminShellProps = {
  children: ReactNode;
};

const NAV_ITEMS: Array<{ href: string; label: string }> = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/imports", label: "Imports" }
];

const COMING_SOON_ITEMS = ["Tests", "Tenants", "Audit"];

const isNavItemActive = (pathname: string, href: string): boolean => {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  if (href === "/admin/imports") {
    return pathname.startsWith("/admin/imports");
  }

  return pathname === href;
};

export default function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const showSidebar = pathname !== "/admin/login";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 py-8">
      <header className="rounded-lg border bg-card px-5 py-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold tracking-wide">Quiz Factory</p>
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Admin
          </span>
        </div>
      </header>

      <div
        className={cn(
          "grid items-start gap-6",
          showSidebar ? "lg:grid-cols-[220px_minmax(0,1fr)]" : "grid-cols-1"
        )}
      >
        {showSidebar ? (
          <aside className="rounded-lg border bg-card p-3 shadow-sm">
            <nav aria-label="Admin navigation" className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const active = isNavItemActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "block rounded-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-primary/10 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-4 border-t pt-4">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Coming soon
              </p>
              <ul className="mt-2 space-y-1">
                {COMING_SOON_ITEMS.map((item) => (
                  <li
                    key={item}
                    className="rounded-md px-3 py-2 text-sm text-muted-foreground/80"
                    aria-disabled="true"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        ) : null}

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

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
  { href: "/admin/alerts", label: "Alerts" },
  { href: "/admin/action-center", label: "Action Center" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/imports", label: "Imports" },
  { href: "/admin/tests", label: "Tests" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/publications", label: "Publications" },
  { href: "/admin/tenants", label: "Tenants" },
  { href: "/admin/audit", label: "Audit" }
];

const isNavItemActive = (pathname: string, href: string): boolean => {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  if (href === "/admin/imports") {
    return pathname.startsWith("/admin/imports");
  }

  if (href === "/admin/alerts") {
    return pathname.startsWith("/admin/alerts");
  }

  if (href === "/admin/action-center") {
    return pathname.startsWith("/admin/action-center");
  }

  if (href === "/admin/analytics") {
    return pathname.startsWith("/admin/analytics");
  }

  if (href === "/admin/tests") {
    return pathname.startsWith("/admin/tests");
  }

  if (href === "/admin/products") {
    return pathname.startsWith("/admin/products");
  }

  if (href === "/admin/publications") {
    return pathname.startsWith("/admin/publications");
  }

  if (href === "/admin/tenants") {
    return pathname.startsWith("/admin/tenants");
  }

  if (href === "/admin/audit") {
    return pathname.startsWith("/admin/audit");
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
          </aside>
        ) : null}

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

import "./globals.css";
import type { ReactNode } from "react";

import { resolveTenantContext } from "../lib/tenants/request";

export const metadata = {
  title: "Quiz Factory",
  description: "Factory-floor tooling for quiz creation"
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const context = await resolveTenantContext();
  return (
    <html lang={context.locale}>
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-border/60">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Quiz Factory
              </span>
              <span className="text-xs text-muted-foreground">Foundation</span>
            </div>
          </header>
          <main className="flex-1">
            <div className="mx-auto w-full max-w-5xl px-6 py-10">{children}</div>
          </main>
          <footer className="border-t border-border/60">
            <div className="mx-auto w-full max-w-5xl px-6 py-6 text-sm text-muted-foreground">
              <p>Built for calm, mobile-first test experiences.</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

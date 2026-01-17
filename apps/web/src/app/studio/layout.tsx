import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { enforceStudioEnabled } from "../../studio/studioGuard";
import { applyTheme } from "../../studio/theme/applyTheme";
import { themeTokens } from "../../studio/theme/tokens";

export const metadata: Metadata = {
  title: "Template Studio",
  robots: {
    index: false,
    follow: false
  }
};

export const dynamic = "force-dynamic";

export default function StudioLayout({ children }: { children: ReactNode }) {
  enforceStudioEnabled();

  return (
    <section className="studio-shell" style={applyTheme(themeTokens)}>
      <header className="studio-nav">
        <div className="studio-nav__brand">
          <span className="studio-badge">Studio</span>
          <div>
            <p className="studio-brand-title">Golden Template</p>
            <p className="studio-brand-sub">Internal UI reference library</p>
          </div>
        </div>
        <nav className="studio-nav__links" aria-label="Studio">
          <Link href="/studio/golden">Golden</Link>
          <Link href="/studio/blocks">Blocks</Link>
        </nav>
      </header>
      <div className="studio-content">{children}</div>
    </section>
  );
}

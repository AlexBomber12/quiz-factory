import type { HTMLAttributes } from "react";

import { cn } from "../../lib/ui/cn";

type PublicPageProps = HTMLAttributes<HTMLElement>;

export function PublicPage({ className, children, ...props }: PublicPageProps) {
  return (
    <section {...props} className={cn("mx-auto w-full max-w-[72rem]", className)}>
      <div className="studio-shell">
        <div className="studio-stack">{children}</div>
      </div>
    </section>
  );
}

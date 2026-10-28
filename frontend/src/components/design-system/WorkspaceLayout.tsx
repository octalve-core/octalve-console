import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Opt-in, responsive web workspace primitives.
 * These do not replace DashboardShell or alter data, auth or API contracts.
 * Adopt screen-by-screen only after visual/role qualification.
 */
export function WorkspaceContainer({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      {...props}
      className={cn(
        "mx-auto w-full min-w-0 max-w-console-content px-page-gutter",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function WorkspaceSection({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <section
      {...props}
      className={cn("min-w-0 py-section md:py-section-lg", className)}
    >
      {children}
    </section>
  );
}

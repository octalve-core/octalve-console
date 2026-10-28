import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type WorkspaceNavTab = {
  /** Stable key and explicit route. Router/Django still own access control. */
  href: string;
  label: string;
  badge?: ReactNode;
};

type WorkspaceNavTabsProps = {
  tabs: readonly WorkspaceNavTab[];
  activeHref: string;
  ariaLabel: string;
  className?: string;
};

/**
 * Route navigation, NOT ARIA tab panels: Next Link preserves browser history.
 * Desktop: subtle underline; Mobile: horizontally scrollable with focus ring.
 * Caller owns routing/role authorization and supplies only allowed links.
 */
export function WorkspaceNavTabs({
  tabs,
  activeHref,
  ariaLabel,
  className,
}: WorkspaceNavTabsProps) {
  return (
    <nav aria-label={ariaLabel} className={cn("min-w-0 border-b border-console-line", className)}>
      <ul className="flex min-w-0 snap-x snap-proximity gap-1 overflow-x-auto overscroll-x-contain pb-px [scrollbar-width:thin] sm:gap-2">
        {tabs.map((tab) => {
          const selected = activeHref === tab.href;
          return (
            <li key={tab.href} className="shrink-0 snap-start">
              <Link
                href={tab.href}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-console-body font-medium transition-colors",
                  "focus-visible:rounded-t-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary focus-visible:ring-offset-2",
                  selected
                    ? "border-console-primary text-console-primary"
                    : "border-transparent text-console-muted hover:border-slate-300 hover:text-console-ink",
                )}
              >
                <span>{tab.label}</span>
                {tab.badge ? <span className="text-console-caption">{tab.badge}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

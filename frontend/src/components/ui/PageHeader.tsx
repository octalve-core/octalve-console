import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-4 flex min-w-0 flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-console-primary">
            {eyebrow}
          </p>
        ) : null}

        <h1 className="text-xl font-medium tracking-tight text-console-ink sm:text-2xl">
          {title}
        </h1>

        {description ? (
          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-console-muted">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

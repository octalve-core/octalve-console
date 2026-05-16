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
        "mb-6 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#0064E0]">
            {eyebrow}
          </p>
        ) : null}

        <h1 className="text-2xl font-medium tracking-[-0.04em] text-slate-950 sm:text-3xl">
          {title}
        </h1>

        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

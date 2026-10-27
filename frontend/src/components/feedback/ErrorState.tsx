import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type ErrorStateProps = {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

/** Accessible neutral error state: no full-width alarming panel for recoverable failures. */
export function ErrorState({
  title = "Something went wrong",
  description = "We could not complete this request. Please try again.",
  action,
  className,
}: ErrorStateProps) {
  return (
    <section role="alert" aria-live="polite"
      className={cn(
        "flex min-h-44 min-w-0 flex-col items-center justify-center rounded-2xl border border-console-line bg-white px-5 py-8 text-center sm:px-8",
        className,
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-amber-700 ring-1 ring-slate-200">
        <AlertCircle className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-console-ink">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-console-muted">{description}</p>
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </section>
  );
}

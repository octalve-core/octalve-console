import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type LoadingStateProps = {
  title?: string;
  description?: string;
  className?: string;
};

export function LoadingState({
  title = "Loading",
  description = "Please wait while we prepare this section.",
  className,
}: LoadingStateProps) {
  return (
    <section role="status" aria-live="polite" aria-busy="true"
      className={cn(
        "flex min-h-44 min-w-0 flex-col items-center justify-center rounded-2xl border border-console-line bg-white px-5 py-8 text-center sm:px-8",
        className,
      )}
    >
      <Loader2 className="h-6 w-6 animate-spin text-console-primary" aria-hidden="true" />
      <h3 className="mt-4 text-base font-semibold text-console-ink">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-console-muted">{description}</p>
    </section>
  );
}

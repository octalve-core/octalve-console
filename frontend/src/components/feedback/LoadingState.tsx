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
    <div
      className={cn(
        "flex min-h-[18rem] flex-col items-center justify-center rounded-[1.5rem] border border-slate-200 bg-white p-8 text-center shadow-sm",
        className,
      )}
    >
      <Loader2 className="h-7 w-7 animate-spin text-[#0064E0]" />
      <h3 className="mt-5 text-base font-medium text-slate-950">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}

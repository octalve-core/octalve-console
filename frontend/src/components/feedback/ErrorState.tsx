import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type ErrorStateProps = {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function ErrorState({
  title = "Something went wrong",
  description = "We could not complete this request. Please try again.",
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[18rem] flex-col items-center justify-center rounded-[1.5rem] border border-red-100 bg-red-50/70 p-8 text-center",
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-red-600 shadow-sm">
        <AlertCircle className="h-6 w-6" />
      </div>

      <h3 className="mt-5 text-base font-medium text-red-950">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-red-700">
        {description}
      </p>

      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

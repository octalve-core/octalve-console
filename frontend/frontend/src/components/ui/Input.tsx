import { cn } from "@/lib/utils";
import type { InputHTMLAttributes, ReactNode } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

export function Input({
  label,
  hint,
  error,
  leftIcon,
  rightIcon,
  className,
  id,
  ...props
}: InputProps) {
  const inputId = id ?? props.name;

  return (
    <div className="space-y-2">
      {label ? (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-slate-700"
        >
          {label}
        </label>
      ) : null}

      <div
        className={cn(
          "flex h-12 items-center rounded-2xl border bg-white px-4 transition",
          "focus-within:ring-4",
          error
            ? "border-red-200 focus-within:border-red-500 focus-within:ring-red-500/10"
            : "border-slate-200 focus-within:border-[#0064E0] focus-within:ring-[#0064E0]/10",
        )}
      >
        {leftIcon ? (
          <span className="mr-3 text-slate-400">{leftIcon}</span>
        ) : null}

        <input
          id={inputId}
          className={cn(
            "h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-950 outline-none",
            "placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-400",
            className,
          )}
          {...props}
        />

        {rightIcon ? (
          <span className="ml-3 text-slate-400">{rightIcon}</span>
        ) : null}
      </div>

      {error ? <p className="text-xs leading-5 text-red-600">{error}</p> : null}
      {!error && hint ? (
        <p className="text-xs leading-5 text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

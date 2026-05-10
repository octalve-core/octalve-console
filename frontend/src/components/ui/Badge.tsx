import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "purple";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  variant?: BadgeVariant | string;
  tone?: BadgeVariant | string;
};

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-slate-100 text-slate-700 ring-slate-200",
  neutral: "bg-slate-100 text-slate-600 ring-slate-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  info: "bg-blue-50 text-blue-700 ring-blue-200",
  purple: "bg-violet-50 text-violet-700 ring-violet-200",
};

function normalizeVariant(value?: BadgeVariant | string): BadgeVariant {
  const normalized = String(value ?? "default").toLowerCase();

  if (normalized === "success") return "success";
  if (normalized === "warning") return "warning";
  if (normalized === "danger") return "danger";
  if (normalized === "error") return "danger";
  if (normalized === "info") return "info";
  if (normalized === "blue") return "info";
  if (normalized === "neutral") return "neutral";
  if (normalized === "muted") return "neutral";
  if (normalized === "purple") return "purple";
  if (normalized === "violet") return "purple";

  return "default";
}

export function Badge({
  children,
  variant,
  tone,
  className,
  ...props
}: BadgeProps) {
  const resolvedVariant = normalizeVariant(variant ?? tone);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        variantClasses[resolvedVariant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

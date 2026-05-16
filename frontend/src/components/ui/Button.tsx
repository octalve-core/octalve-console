import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "outline"
  | "soft";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "children"
> & {
  children: ReactNode;
  href?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  external?: boolean;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[#0064E0] text-white shadow-sm shadow-blue-600/20 hover:bg-[#0057C2] focus-visible:ring-[#0064E0]/30",
  secondary:
    "bg-slate-950 text-white shadow-sm shadow-slate-950/10 hover:bg-slate-800 focus-visible:ring-slate-950/20",
  outline:
    "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-slate-200",
  ghost:
    "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-slate-200",
  soft: "bg-[#0064E0]/10 text-[#0064E0] hover:bg-[#0064E0]/15 focus-visible:ring-[#0064E0]/20",
  danger:
    "bg-red-600 text-white shadow-sm shadow-red-600/20 hover:bg-red-700 focus-visible:ring-red-600/25",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 rounded-xl px-3 text-xs",
  md: "h-11 rounded-2xl px-4 text-sm",
  lg: "h-12 rounded-2xl px-5 text-sm",
};

export function Button({
  children,
  href,
  variant = "primary",
  size = "md",
  type = "button",
  className,
  external = false,
  ...buttonProps
}: ButtonProps) {
  const classes = cn(
    "inline-flex shrink-0 items-center justify-center gap-2 font-medium transition duration-200",
    "focus-visible:outline-none focus-visible:ring-4",
    "disabled:pointer-events-none disabled:opacity-60",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );

  if (href) {
    return (
      <Link
        href={href}
        className={classes}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
      >
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} {...buttonProps}>
      {children}
    </button>
  );
}

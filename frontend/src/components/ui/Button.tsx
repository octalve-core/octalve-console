import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "children"
> & {
  children: ReactNode;
  href?: string;
  variant?: ButtonVariant;
  className?: string;
};

export function Button({
  children,
  href,
  variant = "primary",
  type = "button",
  className,
  ...buttonProps
}: ButtonProps) {
  const classes = cn("button", variant !== "primary" && variant, className);

  if (href) {
    return (
      <Link className={classes} href={href}>
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

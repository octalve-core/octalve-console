import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type ButtonProps = {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  type?: "button" | "submit" | "reset";
  className?: string;
};

export function Button({ children, href, variant = "primary", type = "button", className }: ButtonProps) {
  const classes = cn("button", variant !== "primary" && variant, className);
  if (href) return <Link className={classes} href={href}>{children}</Link>;
  return <button type={type} className={classes}>{children}</button>;
}

import { cn } from "@/lib/utils";
import type { StatusTone } from "@/lib/platform-data";
import type { ReactNode } from "react";

export function Badge({ children, tone = "dark" }: { children: ReactNode; tone?: StatusTone }) {
  return <span className={cn("badge", tone)}>{children}</span>;
}

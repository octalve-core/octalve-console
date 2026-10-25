import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

type MetricTrend = {
  label: string;
  value: string;
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
};

type MetricCardProps = {
  label: string;
  value: string;
  description?: string;
  icon?: ReactNode;
  trend?: MetricTrend;
  className?: string;
};

export function MetricCard({
  label,
  value,
  description,
  icon,
  trend,
  className,
}: MetricCardProps) {
  return (
    <Card className={cn("overflow-hidden border-[#E5EBF3] shadow-[0_1px_2px_rgba(15,23,42,.035)]", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-[25px] font-semibold tracking-[-0.035em] text-slate-950">
            {value}
          </p>

          {description ? (
            <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
          ) : null}
        </div>

        {icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0064E0]/10 text-[#0064E0]">
            {icon}
          </div>
        ) : null}
      </div>

      {trend ? (
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <span className="text-xs text-slate-500">{trend.label}</span>
          <Badge variant={trend.tone ?? "neutral"}>{trend.value}</Badge>
        </div>
      ) : null}
    </Card>
  );
}
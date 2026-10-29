import type { ReactNode } from "react";

/**
 * Small responsive metric card. Keep the existing public props and content
 * exactly as callers expect; visual styling is locally-owned Tailwind rather
 * than the global .stat-card/.stat-label/.stat-value cascade.
 */
export function StatCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 rounded-console-card border border-console-line bg-white bg-[radial-gradient(circle_at_top_right,rgba(0,100,224,0.07),transparent_9rem)] p-[1.125rem] shadow-soft">
      <div className="min-w-0">
        <div className="mb-2 text-xs font-medium text-console-muted">{label}</div>
        <div className="break-words text-[1.5625rem] font-medium leading-tight tracking-[-0.045em] text-console-ink">{value}</div>
      </div>
      <div className="flex h-[2.625rem] w-[2.625rem] shrink-0 items-center justify-center rounded-[0.8125rem] bg-[#eaf3ff] text-console-primary">{icon}</div>
    </div>
  );
}

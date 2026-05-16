import type { ReactNode } from "react";

export function StatCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="card stat-card">
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
      </div>
      <div className="stat-icon">{icon}</div>
    </div>
  );
}

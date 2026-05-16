"use client";

import { KeyRound, ShieldCheck, UserCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { MetricCard } from "@/components/data/MetricCard";
import { ResponsiveGrid } from "@/components/data/ResponsiveGrid";

export function StaffSecurityView() {
  return (
    <DashboardShell
      role="staff"
      title="Security"
      description="Review staff access, permissions, and security-sensitive workflow."
    >
      <DashboardPage
        eyebrow="Security"
        title="Staff security"
        description="Security overview for staff access and operational controls."
      >
        <div className="space-y-5">
          <ResponsiveGrid columns="3">
            <MetricCard
              label="Access role"
              value="Staff"
              description="Limited operational workspace"
              icon={<UserCheck className="h-5 w-5" />}
            />
            <MetricCard
              label="Authentication"
              value="JWT"
              description="Django auth connected"
              icon={<KeyRound className="h-5 w-5" />}
            />
            <MetricCard
              label="Permissions"
              value="Scoped"
              description="Admin controls remain protected"
              icon={<ShieldCheck className="h-5 w-5" />}
            />
          </ResponsiveGrid>

          <Card>
            <h3 className="text-lg font-medium tracking-[-0.03em] text-slate-950">Security notes</h3>
            <p className="mt-2 text-sm leading-7 text-slate-500">
              This page is prepared for audit logs, staff permission checks, login history, and future role-based security controls.
            </p>
          </Card>
        </div>
      </DashboardPage>
    </DashboardShell>
  );
}
"use client";

import { useState, type ReactNode } from "react";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardTopbar } from "@/components/layout/DashboardTopbar";
import type { DashboardRole } from "@/lib/navigation/dashboard-nav";

type DashboardShellProps = {
  role: DashboardRole;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function DashboardShell({
  role,
  title,
  description,
  actions,
  children,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F6F8FB] lg:grid lg:grid-cols-[19rem_1fr]">
      <DashboardSidebar
        role={role}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="min-w-0">
        <DashboardTopbar
          title={title}
          description={description}
          actions={actions}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { adminSettingsItems } from "../data/admin-settings-config";

export function AdminSettingsHubView() {
  return (
    <DashboardShell
      role="admin"
      title="Settings"
      description="Configure Octalve Console operations, security, billing, notifications, and automation."
    >
      <DashboardPage
        eyebrow="Configuration"
        title="Settings"
        description="A clean settings center for the hosting automation backend and admin operations."
      >
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {adminSettingsItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link key={item.key} href={item.href}>
                <Card className="h-full transition hover:border-[#0064E0]/30 hover:shadow-md">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0064E0]/10 text-[#0064E0]">
                      <Icon className="h-6 w-6" />
                    </div>

                    <Badge tone={item.status}>{item.status}</Badge>
                  </div>

                  <h2 className="mt-5 text-lg font-medium tracking-[-0.03em] text-slate-950">
                    {item.title}
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>

                  <div className="mt-5 flex items-center gap-2 text-sm font-medium text-[#0064E0]">
                    Configure
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </DashboardPage>
    </DashboardShell>
  );
}
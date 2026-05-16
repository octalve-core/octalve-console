"use client";

import { ArrowLeft, Save } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { getAdminSettingsItem, type AdminSettingsKey } from "../data/admin-settings-config";

type AdminSettingsSectionViewProps = {
  section: AdminSettingsKey;
};

export function AdminSettingsSectionView({ section }: AdminSettingsSectionViewProps) {
  const item = getAdminSettingsItem(section);
  const Icon = item.icon;

  return (
    <DashboardShell
      role="admin"
      title={item.title}
      description={item.description}
      actions={
        <Button href="/admin/settings" variant="outline">
          <ArrowLeft className="h-4 w-4" />
          Settings
        </Button>
      }
    >
      <DashboardPage
        eyebrow="Settings"
        title={item.title}
        description={item.description}
        actions={
          <Button type="button">
            <Save className="h-4 w-4" />
            Save changes
          </Button>
        }
      >
        <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0064E0]/10 text-[#0064E0]">
                <Icon className="h-7 w-7" />
              </div>

              <Badge tone={item.status}>{item.status}</Badge>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {item.fields.map((field) => (
                <div key={field.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{field.label}</p>
                  <p className="mt-2 text-sm font-medium text-slate-950">{field.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-800">
              This settings section is UI-ready and API-ready. When the backend exposes a final payload for this section,
              only this section mapping needs to be connected.
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-medium tracking-[-0.03em] text-slate-950">Implementation note</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Settings remain separated by section so you can edit each category without touching the whole admin panel.
            </p>

            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-500">
              <p><span className="font-medium text-slate-700">Section:</span> {item.key}</p>
              <p><span className="font-medium text-slate-700">Backend:</span> settings module ready</p>
              <p><span className="font-medium text-slate-700">UI:</span> TailwindCSS premium layout</p>
            </div>
          </Card>
        </div>
      </DashboardPage>
    </DashboardShell>
  );
}
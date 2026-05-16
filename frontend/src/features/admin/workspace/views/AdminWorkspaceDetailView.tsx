"use client";

import { useParams } from "next/navigation";
import { ArrowLeft, Edit3, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { formatStatus, getStatusTone } from "@/lib/constants/status";
import { adminWorkspaceConfig, type AdminWorkspaceKey } from "../data/admin-workspace-config";

type AdminWorkspaceDetailViewProps = {
  workspace: AdminWorkspaceKey;
};

function getParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function AdminWorkspaceDetailView({ workspace }: AdminWorkspaceDetailViewProps) {
  const params = useParams();
  const id = decodeURIComponent(getParamValue(params.id));
  const config = adminWorkspaceConfig[workspace];
  const Icon = config.icon;

  const record =
    config.fallback.find((item) => item.id === id || item.title === id) ??
    config.fallback[0];

  return (
    <DashboardShell
      role="admin"
      title={record?.title ?? config.title}
      description={config.description}
      actions={
        <Button href={config.listHref} variant="outline">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      }
    >
      <DashboardPage
        eyebrow={config.eyebrow}
        title={record?.title ?? config.title}
        description={record?.subtitle ?? config.description}
        actions={
          config.createHref ? (
            <Button href={`${config.createHref}?mode=edit&id=${encodeURIComponent(record?.id ?? id)}`}>
              <Edit3 className="h-4 w-4" />
              Edit
            </Button>
          ) : null
        }
      >
        <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0064E0]/10 text-[#0064E0]">
                <Icon className="h-7 w-7" />
              </div>

              <Badge variant={getStatusTone(record?.status)}>{formatStatus(record?.status)}</Badge>
            </div>

            <h2 className="mt-6 text-2xl font-medium tracking-[-0.04em] text-slate-950">{record?.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{record?.subtitle}</p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Record ID</p>
                <p className="mt-2 text-sm font-medium text-slate-950">{record?.id}</p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Meta</p>
                <p className="mt-2 text-sm font-medium text-slate-950">{record?.meta}</p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Amount</p>
                <p className="mt-2 text-sm font-medium text-slate-950">{record?.amount || "—"}</p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Date</p>
                <p className="mt-2 text-sm font-medium text-slate-950">{record?.date || "—"}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0064E0]/10 text-[#0064E0]">
              <ShieldCheck className="h-6 w-6" />
            </div>

            <h3 className="mt-5 text-lg font-medium tracking-[-0.03em] text-slate-950">API-ready detail</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              This workspace detail is ready for a backend single-record endpoint when the schema exposes one.
            </p>
          </Card>
        </div>
      </DashboardPage>
    </DashboardShell>
  );
}
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Database,
  Edit3,
  ExternalLink,
  RefreshCcw,
  Server,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { formatStatus, getStatusTone } from "@/lib/constants/status";
import { adminResourceConfig, type AdminResourceKey } from "../data/admin-resource-config";
import { adminEditorConfig } from "../data/admin-editor-config";
import type { AdminRecord } from "../data/admin-demo-data";
import { normalizeAdminRecord, unwrapAdminList } from "../utils/admin-record-normalizer";

type AdminResourceDetailViewProps = {
  resource: AdminResourceKey;
};

function getParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function AdminResourceDetailView({ resource }: AdminResourceDetailViewProps) {
  const params = useParams();
  const id = decodeURIComponent(getParamValue(params.id));

  const listConfig = adminResourceConfig[resource];
  const editorConfig = adminEditorConfig[resource];

  const [record, setRecord] = useState<AdminRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [error, setError] = useState("");

  async function loadRecord() {
    setIsLoading(true);
    setError("");

    try {
      const response = await listConfig.loader();
      const apiRecords = unwrapAdminList(response).map((item) => normalizeAdminRecord(item, listConfig.key));
      const foundApiRecord = apiRecords.find((item) => item.id === id);

      if (foundApiRecord) {
        setRecord(foundApiRecord);
        setIsUsingFallback(false);
        return;
      }

      const fallbackRecord =
        listConfig.fallback.find((item) => item.id === id || item.title === id) ?? listConfig.fallback[0] ?? null;

      setRecord(fallbackRecord);
      setIsUsingFallback(true);
      setError("The live API record was not found locally. Showing fallback detail data.");
    } catch {
      const fallbackRecord =
        listConfig.fallback.find((item) => item.id === id || item.title === id) ?? listConfig.fallback[0] ?? null;

      setRecord(fallbackRecord);
      setIsUsingFallback(true);
      setError("Live API detail is not available yet. Showing safe fallback detail data.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadRecord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, id]);

  const editHref = useMemo(() => {
    return `${editorConfig.listHref}/new?mode=edit&id=${encodeURIComponent(id)}`;
  }, [editorConfig.listHref, id]);

  return (
    <DashboardShell
      role="admin"
      title={editorConfig.detailLabel}
      description={listConfig.description}
      actions={
        <Button href={editorConfig.listHref} variant="outline">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      }
    >
      <DashboardPage
        eyebrow={listConfig.eyebrow}
        title={record?.title ?? editorConfig.detailLabel}
        description={record?.subtitle ?? listConfig.description}
        actions={
          <>
            <Button type="button" variant="outline" onClick={loadRecord}>
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            <Button href={editHref}>
              <Edit3 className="h-4 w-4" />
              Edit
            </Button>
          </>
        }
      >
        {isLoading ? (
          <LoadingState title="Loading record" description="Fetching details from the Django API." />
        ) : !record ? (
          <ErrorState title="Record not found" description="We could not find this record in API or fallback data." />
        ) : (
          <div className="space-y-5">
            {isUsingFallback ? (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                {error}
              </div>
            ) : null}

            <Card className="overflow-hidden p-0">
              <div className="bg-[#0064E0] p-6 text-white sm:p-8">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.4rem] bg-white/15 text-white">
                      <Server className="h-7 w-7" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm text-white/75">{record.id}</p>
                      <h2 className="mt-2 text-3xl font-medium tracking-[-0.05em]">{record.title}</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">{record.subtitle}</p>
                    </div>
                  </div>

                  <Badge className="bg-white text-[#0064E0] ring-white">
                    {formatStatus(record.status)}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Database className="h-4 w-4" />
                    Meta
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-950">{record.meta}</p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <ShieldCheck className="h-4 w-4" />
                    Status
                  </div>
                  <div className="mt-2">
                    <Badge variant={getStatusTone(record.status)}>{formatStatus(record.status)}</Badge>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <CalendarDays className="h-4 w-4" />
                    Date
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-950">{record.date || "—"}</p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <ExternalLink className="h-4 w-4" />
                    Amount
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-950">{record.amount || "—"}</p>
                </div>
              </div>
            </Card>

            <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <h3 className="text-lg font-medium tracking-[-0.03em] text-slate-950">Operational notes</h3>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  This detail view is ready for live Django data. The structure is intentionally reusable so customers,
                  products, plans, invoices, domains, gateways, providers, orders, and provisioning tasks can share a
                  consistent admin experience.
                </p>
              </Card>

              <Card>
                <h3 className="text-lg font-medium tracking-[-0.03em] text-slate-950">Quick actions</h3>
                <div className="mt-5 grid gap-3">
                  <Button href={editHref} className="w-full">
                    <Edit3 className="h-4 w-4" />
                    Edit record
                  </Button>
                  <Button href={editorConfig.listHref} variant="outline" className="w-full">
                    Back to {listConfig.title}
                  </Button>
                </div>
              </Card>
            </div>

            <p className="text-center text-xs text-slate-400">
              API-ready route: <Link href={editorConfig.listHref} className="text-[#0064E0]">{editorConfig.listHref}</Link>
            </p>
          </div>
        )}
      </DashboardPage>
    </DashboardShell>
  );
}
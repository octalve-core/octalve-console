"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Plus, RefreshCcw, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EmptyState } from "@/components/feedback/EmptyState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { formatStatus, getStatusTone } from "@/lib/constants/status";
import { adminWorkspaceConfig, type AdminWorkspaceKey, type AdminWorkspaceRecord } from "../data/admin-workspace-config";

type AdminWorkspaceViewProps = {
  workspace: AdminWorkspaceKey;
};

function unwrapList(value: unknown) {
  const data = value as { results?: unknown[] } | unknown[];

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;

  return [];
}

function readString(item: Record<string, unknown>, keys: string[], fallback = "—") {
  for (const key of keys) {
    const value = item[key];

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }

  return fallback;
}

function normalizeRecord(item: unknown, config: typeof adminWorkspaceConfig[AdminWorkspaceKey]): AdminWorkspaceRecord {
  const record = item as Record<string, unknown>;

  const id = readString(record, ["id", "uuid", "reference", "code"], `${config.key}-${Math.random()}`);
  const title = readString(record, ["name", "title", "domain", "label", "subject", "client", "customer"], id);
  const subtitle = readString(record, ["email", "summary", "description", "product", "package", "type"], config.title);
  const meta = readString(record, ["status", "adapter", "gateway", "provider", "category", "cycle"], "API record");
  const amount = readString(record, ["total", "price", "amount", "balance", "credited"], "");
  const status = readString(record, ["status", "state", "payment_status"], "Active");
  const date = readString(record, ["date", "created_at", "updated_at", "renews", "expiry"], "");

  return {
    id,
    title,
    subtitle,
    meta,
    amount,
    status,
    date,
    actionHref: `${config.listHref}/${encodeURIComponent(id)}`,
  };
}

export function AdminWorkspaceView({ workspace }: AdminWorkspaceViewProps) {
  const config = adminWorkspaceConfig[workspace];
  const Icon = config.icon;

  const [records, setRecords] = useState<AdminWorkspaceRecord[]>(config.fallback);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [error, setError] = useState("");

  async function loadRecords() {
    setError("");
    setIsLoading(true);

    try {
      const response = await config.loader();
      const apiRecords = unwrapList(response).map((item) => normalizeRecord(item, config));

      if (apiRecords.length > 0) {
        setRecords(apiRecords);
        setIsUsingFallback(false);
      } else {
        setRecords(config.fallback);
        setIsUsingFallback(config.fallback.length > 0);
      }
    } catch {
      setRecords(config.fallback);
      setIsUsingFallback(config.fallback.length > 0);
      setError(config.fallback.length > 0 ? "Live API data is not available yet. Showing safe fallback records." : "Live API data is not available yet. API-only mode is active, so no fallback records are shown.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace]);

  const filteredRecords = useMemo(() => {
    const term = query.trim().toLowerCase();

    if (!term) return records;

    return records.filter((record) =>
      [record.id, record.title, record.subtitle, record.meta, record.status]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [query, records]);

  return (
    <DashboardShell
      role="admin"
      title={config.title}
      description={config.description}
      actions={
        config.createHref ? (
          <Button href={config.createHref}>
            <Plus className="h-4 w-4" />
            {config.createLabel ?? "Create"}
          </Button>
        ) : null
      }
    >
      <DashboardPage
        eyebrow={config.eyebrow}
        title={config.title}
        description={config.description}
        actions={
          <Button type="button" variant="outline" onClick={loadRecords}>
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
        }
      >
        <div className="space-y-5">
          <Card className="overflow-hidden p-0">
            <div className="bg-[#0064E0] p-6 text-white sm:p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white">
                  <Icon className="h-7 w-7" />
                </div>

                <div>
                  <p className="text-sm text-white/75">{config.eyebrow}</p>
                  <h2 className="mt-2 text-3xl font-medium tracking-[-0.05em]">{config.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-white/80">{config.description}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={config.searchPlaceholder}
                className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
              />
            </div>
          </Card>

          {isUsingFallback ? (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              {error || "Showing fallback records until the backend returns live data."}
            </div>
          ) : null}

          {isLoading ? (
            <LoadingState title={`Loading ${config.title.toLowerCase()}`} description="Connecting to the Django API." />
          ) : filteredRecords.length === 0 ? (
            <EmptyState title={config.emptyTitle} description={config.emptyDescription} />
          ) : (
            <Card className="p-4 sm:p-5">
              <div className="space-y-3">
                {filteredRecords.map((record) => (
                  <div
                    key={record.id}
                    className="grid gap-4 rounded-[1.4rem] border border-slate-200 bg-white p-4 transition hover:border-[#0064E0]/25 hover:shadow-sm lg:grid-cols-[1fr_0.7fr_0.6fr_auto] lg:items-center"
                  >
                    <div className="min-w-0">
                      <Link href={record.actionHref} className="truncate text-base font-medium text-slate-950 transition hover:text-[#0064E0]">
                        {record.title}
                      </Link>
                      <p className="mt-1 truncate text-sm text-slate-500">{record.subtitle}</p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-slate-950">{record.meta}</p>
                      <p className="mt-1 text-sm text-slate-500">{record.amount || "—"}</p>
                    </div>

                    <div>
                      <p className="mb-1 text-sm text-slate-500">{record.date || "—"}</p>
                      <Badge variant={getStatusTone(record.status)}>{formatStatus(record.status)}</Badge>
                    </div>

                    <Button href={record.actionHref} className="w-full lg:w-auto">
                      Manage
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </DashboardPage>
    </DashboardShell>
  );
}
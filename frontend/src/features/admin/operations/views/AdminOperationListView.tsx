"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { useAutoSync } from "@/lib/hooks/useAutoSync";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EmptyState } from "@/components/feedback/EmptyState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { formatStatus, getStatusTone } from "@/lib/constants/status";
import { adminOperationConfig } from "../data/admin-operations-config";
import type { AdminOperationKey, AdminOperationRecord } from "../data/admin-operations-data";

type AdminOperationListViewProps = {
  operation: AdminOperationKey;
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

function normalizeRecord(item: unknown, operation: AdminOperationKey): AdminOperationRecord {
  const record = item as Record<string, unknown>;

  const id = readString(record, ["id", "uuid", "reference", "code"], "");
  if (!id) throw new Error("A record is missing its unique identifier.");
  const title = readString(record, ["title", "name", "subject", "template_name", "action", "event"], id);
  const subtitle = readString(record, ["description", "summary", "content", "department", "message", "email"], operation);
  const meta = readString(record, ["category", "type", "priority", "level", "status"], "—");
  const status = readString(record, ["status", "state", "level"], "Unknown");
  const date = readString(record, ["created_at", "updated_at", "date", "time"], "");

  const baseMap: Record<AdminOperationKey, string> = {
    support: "/admin/support",
    departments: "/admin/support/departments",
    responses: "/admin/support/responses",
    "knowledge-base": "/admin/knowledge-base",
    "audit-logs": "/admin/audit-logs",
    reports: "/admin/reports",
    notifications: "/admin/settings/notifications",
  };

  const detailable = operation === "support" || operation === "knowledge-base" || operation === "notifications";

  return {
    id,
    title,
    subtitle,
    meta,
    status,
    date,
    actionHref: detailable ? `${baseMap[operation]}/${encodeURIComponent(id)}` : baseMap[operation],
  };
}

export function AdminOperationListView({ operation }: AdminOperationListViewProps) {
  const config = adminOperationConfig[operation];

  const [records, setRecords] = useState<AdminOperationRecord[]>(config.fallback);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [error, setError] = useState("");

  async function loadRecords(quiet = false) {
    setError("");
    if (!quiet) setIsLoading(true);

    try {
      const response = await config.loader();
      const apiRecords = unwrapList(response).map((item) => normalizeRecord(item, config.key));

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
      setError("We couldn’t load your records. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  useAutoSync(loadRecords, operation);

  const filteredRecords = useMemo(() => {
    const term = query.trim().toLowerCase();

    if (!term) return records;

    return records.filter((record) =>
      [record.title, record.subtitle, record.meta, record.status, record.id]
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

      >
        <div className="space-y-5">
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
              {error || "Showing sample records for preview."}
            </div>
          ) : null}

          {isLoading ? (
            <LoadingState title={`Loading ${config.title.toLowerCase()}`} description="Preparing your records…" />
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

                    <p className="text-sm text-slate-600">{record.meta}</p>

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
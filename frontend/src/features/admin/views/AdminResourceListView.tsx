"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { adminResourceConfig, type AdminResourceKey } from "../data/admin-resource-config";
import type { AdminRecord } from "../data/admin-demo-data";
import { AdminRecordList } from "../components/AdminRecordList";

type AdminResourceListViewProps = {
  resource: AdminResourceKey;
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

function normalizeRecord(item: unknown, configKey: AdminResourceKey): AdminRecord {
  const record = item as Record<string, unknown>;

  const id = readString(record, ["id", "uuid", "reference", "code"], `${configKey}-${Math.random()}`);
  const title = readString(record, ["name", "title", "domain", "display_name", "customer", "client", "email"], id);
  const subtitle = readString(
    record,
    ["email", "summary", "description", "product", "category", "adapter_type", "domain", "subject"],
    configKey,
  );
  const meta = readString(
    record,
    ["status", "type", "cycle", "adapter", "registrar", "provider", "department"],
    "API record",
  );
  const amount = readString(record, ["total", "price", "amount", "balance", "credited"], "");
  const status = readString(record, ["status", "state", "payment_status"], "Active");
  const date = readString(record, ["date", "created_at", "updated_at", "dueDate", "expiry"], "");

  const routeMap: Record<AdminResourceKey, string> = {
    customers: "/admin/customers",
    products: "/admin/products",
    plans: "/admin/plans",
    orders: "/admin/orders",
    invoices: "/admin/billing/invoices",
    domains: "/admin/billing/domains",
    gateways: "/admin/gateways",
    providers: "/admin/servers",
    provisioning: "/admin/provisioning",
  };

  return {
    id,
    title,
    subtitle,
    meta,
    amount,
    status,
    date,
    actionHref: `${routeMap[configKey]}/${encodeURIComponent(id)}`,
  };
}

export function AdminResourceListView({ resource }: AdminResourceListViewProps) {
  const config = adminResourceConfig[resource];

  const [records, setRecords] = useState<AdminRecord[]>(config.fallback);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [error, setError] = useState("");

  async function loadRecords() {
    setError("");
    setIsLoading(true);

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
      setError(config.fallback.length > 0 ? "Live API data is not available yet. Showing safe fallback records for layout continuity." : "Live API data is not available yet. API-only mode is active, so no fallback records are shown.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource]);

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
        actions={
          <Button type="button" variant="outline" onClick={loadRecords}>
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
        }
      >
        <div className="space-y-5">
          <Card className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex h-12 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={config.searchPlaceholder}
                  className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                />
              </div>

              <div className="text-sm text-slate-500">
                {filteredRecords.length} record{filteredRecords.length === 1 ? "" : "s"}
              </div>
            </div>
          </Card>

          {isUsingFallback ? (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              {error || "Showing fallback records until the backend returns live data."}
            </div>
          ) : null}

          {isLoading ? (
            <LoadingState title={`Loading ${config.title.toLowerCase()}`} description="Connecting to the Django API." />
          ) : error && records.length === 0 ? (
            <ErrorState description={error} />
          ) : (
            <AdminRecordList
              records={filteredRecords}
              emptyTitle={config.emptyTitle}
              emptyDescription={config.emptyDescription}
            />
          )}
        </div>
      </DashboardPage>
    </DashboardShell>
  );
}
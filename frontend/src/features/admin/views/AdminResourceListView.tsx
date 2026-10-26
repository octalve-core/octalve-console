"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { useAutoSync } from "@/lib/hooks/useAutoSync";
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

  const id = readString(record, ["id", "uuid", "reference", "code"], "");
  if (!id) throw new Error("A record is missing its unique identifier.");
  const title = readString(record, ["name", "title", "domain", "display_name", "customer", "client", "email"], id);
  const subtitle = readString(
    record,
    ["email", "summary", "description", "product", "category", "adapter_type", "domain", "subject"],
    configKey,
  );
  const meta = readString(
    record,
    ["status", "type", "cycle", "adapter", "registrar", "provider", "department"],
    "—",
  );
  const amount = readString(record, ["total", "price", "amount", "balance", "credited"], "");
  const status = readString(record, ["status", "state", "payment_status"], "Unknown");
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

  const [records, setRecords] = useState<AdminRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRecords(quiet = false) {
    setError("");
    if (!quiet) setIsLoading(true);

    try {
      const response = await config.loader();
      const apiRecords = unwrapList(response).map((item) => normalizeRecord(item, config.key));

      setRecords(apiRecords);
    } catch {
      setRecords([]);
      setError("We couldn’t load your records. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  useAutoSync(loadRecords, resource);


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
          {isLoading ? (
            <LoadingState title={`Loading ${config.title.toLowerCase()}`} description="Preparing your records…" />
          ) : error ? (
            <ErrorState description={error} />
          ) : (
            <AdminRecordList
              records={records}
              emptyTitle={config.emptyTitle}
              emptyDescription={config.emptyDescription}
            />
          )}
        </div>
      </DashboardPage>
    </DashboardShell>
  );
}
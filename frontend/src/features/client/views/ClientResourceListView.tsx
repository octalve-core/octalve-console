"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { clientResourceConfig } from "../data/client-resource-config";
import type { ClientRecord, ClientResourceKey } from "../data/client-demo-data";
import { normalizeClientRecord, unwrapClientList } from "../utils/client-record-normalizer";
import { ClientRecordList } from "../components/ClientRecordList";

type ClientResourceListViewProps = {
  resource: ClientResourceKey;
};

export function ClientResourceListView({ resource }: ClientResourceListViewProps) {
  const config = clientResourceConfig[resource];

  const [records, setRecords] = useState<ClientRecord[]>(config.fallback);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [error, setError] = useState("");

  async function loadRecords() {
    setError("");
    setIsLoading(true);

    try {
      const response = await config.loader();
      const apiRecords = unwrapClientList(response).map((item) => normalizeClientRecord(item, config.key));

      if (apiRecords.length > 0) {
        setRecords(apiRecords);
        setIsUsingFallback(false);
      } else {
        setRecords(config.fallback);
        setIsUsingFallback(true);
      }
    } catch {
      setRecords(config.fallback);
      setIsUsingFallback(true);
      setError("Live API data is not available yet. No live API records could be loaded. Please retry.");
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
      role="client"
      title={config.title}
      description={config.description}
      actions={
        config.actionHref ? (
          <Button href={config.actionHref}>
            <Plus className="h-4 w-4" />
            {config.actionLabel ?? "Create"}
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
              {error || "No verified backend records are available."}
            </div>
          ) : null}

          {isLoading ? (
            <LoadingState title={`Loading ${config.title.toLowerCase()}`} description="Connecting to the Django API." />
          ) : error && records.length === 0 ? (
            <ErrorState description={error} />
          ) : (
            <ClientRecordList
              records={filteredRecords}
              resource={resource}
              emptyTitle={config.emptyTitle}
              emptyDescription={config.emptyDescription}
            />
          )}
        </div>
      </DashboardPage>
    </DashboardShell>
  );
}
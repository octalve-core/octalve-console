"use client";

import { useEffect, useState } from "react";
import { Plus, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
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
      setError("Live API data is not available yet. Showing safe demo records for layout continuity.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource]);


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
            <ClientRecordList
              records={records}
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
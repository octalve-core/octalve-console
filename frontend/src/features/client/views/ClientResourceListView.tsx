"use client";

import { useEffect, useState } from "react";
import { Plus, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ErrorState } from "@/components/feedback/ErrorState";
import { clientResourceConfig } from "../data/client-resource-config";
import type { ClientRecord, ClientResourceKey } from "../data/client-demo-data";
import { normalizeClientRecord, unwrapClientList } from "../utils/client-record-normalizer";
import { ClientRecordList } from "../components/ClientRecordList";

type ClientResourceListViewProps = {
  resource: ClientResourceKey;
};

export function ClientResourceListView({ resource }: ClientResourceListViewProps) {
  const config = clientResourceConfig[resource];

  const [records, setRecords] = useState<ClientRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRecords() {
    setError("");
    setIsLoading(true);

    try {
      const response = await config.loader();
      const apiRecords = unwrapClientList(response).map((item) => normalizeClientRecord(item, config.key));

      setRecords(apiRecords);
    } catch {
      setRecords([]);
      setError("We couldn’t load your information right now. Please try again.");
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
          {isLoading ? (
            <div role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Updating your {config.title.toLowerCase()}…</div>
          ) : error ? (
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
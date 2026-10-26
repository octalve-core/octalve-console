"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { useAutoSync } from "@/lib/hooks/useAutoSync";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ErrorState } from "@/components/feedback/ErrorState";
import { clientResourceConfig } from "../data/client-resource-config";
import type { ClientRecord, ClientResourceKey } from "../data/client-demo-data";
import { normalizeClientRecord, unwrapClientList } from "../utils/client-record-normalizer";
import { ClientRecordList } from "../components/ClientRecordList";
import { ClientDomainSearch } from "../components/ClientDomainSearch";

type ClientResourceListViewProps = {
  resource: ClientResourceKey;
};

export function ClientResourceListView({ resource }: ClientResourceListViewProps) {
  const config = clientResourceConfig[resource];

  const [records, setRecords] = useState<ClientRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRecords(quiet = false) {
    setError("");
    if (!quiet) setIsLoading(true);

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

  useAutoSync(loadRecords, resource);


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

      >
        <div className="space-y-5">
          {resource === "domains" && <ClientDomainSearch/>}
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
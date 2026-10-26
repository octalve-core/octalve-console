"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { DashboardPage } from "@/components/layout/DashboardPage";
import {SectionHeading} from "@/components/design-system/SectionHeading";
import {ActionLink} from "@/components/design-system/ActionLink";
import { useAutoSync } from "@/lib/hooks/useAutoSync";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ErrorState } from "@/components/feedback/ErrorState";
import { clientResourceConfig } from "../data/client-resource-config";
import type { ClientRecord, ClientResourceKey } from "../data/client-demo-data";
import { normalizeClientRecord, unwrapClientList } from "../utils/client-record-normalizer";
import { ClientRecordList } from "../components/ClientRecordList";
import { ClientDomainSearch } from "../components/ClientDomainSearch";
import {ClientEssentialRecords} from "../components/ClientEssentialRecords";
import {BillingRecordDirectory} from "../components/commerce/BillingRecordDirectory";

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

  const essential=resource==="services"||resource==="domains";
  const billing=resource==="orders"||resource==="invoices";
  const actions=config.actionHref?<ActionLink href={config.actionHref} size="md" className="w-full sm:w-auto">
    <Plus aria-hidden="true" className="h-4 w-4"/>{config.actionLabel??"Create"}
  </ActionLink>:undefined;
  const body=<div className="space-y-5">
    {resource==="domains"&&<ClientDomainSearch/>}
    {isLoading?<div role="status" className="rounded-xl border border-console-line bg-white p-5 text-sm text-console-muted">Updating your {config.title.toLowerCase()}…</div>
    :error?<ErrorState description={error}/>
    :essential?<ClientEssentialRecords resource={resource} records={records} emptyTitle={config.emptyTitle} emptyDescription={config.emptyDescription}/>
    :billing?<BillingRecordDirectory resource={resource} records={records} emptyTitle={config.emptyTitle} emptyDescription={config.emptyDescription}/>
    :<ClientRecordList records={records} resource={resource} emptyTitle={config.emptyTitle} emptyDescription={config.emptyDescription}/>}
  </div>;

  return <DashboardShell role="client" title={config.title} description={config.description}>
    {(essential||billing)?<div className="space-y-6">
      <SectionHeading eyebrow={config.eyebrow} title={config.title} description={config.description} actions={actions}/>
      {body}
    </div>:<DashboardPage eyebrow={config.eyebrow} title={config.title} description={config.description} actions={actions}>
      {body}
    </DashboardPage>}
  </DashboardShell>;
}

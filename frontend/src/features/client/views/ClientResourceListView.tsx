"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, RefreshCcw } from "lucide-react";
import { ActionButton } from "@/components/design-system/ActionButton";
import { ApiError } from "@/lib/api/client";
import { LoadingState } from "@/components/feedback/LoadingState";
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

import {ClientEssentialRecords} from "../components/ClientEssentialRecords";
import {BillingRecordDirectory} from "../components/commerce/BillingRecordDirectory";

type ClientResourceListViewProps = {
  resource: ClientResourceKey;
};

type LoadIssue = { title: string; description: string; signIn: boolean };
function explainListError(error: unknown): LoadIssue {
  if (error instanceof ApiError) {
    if (error.status === 401) return {title:"Session expired", description:"Please sign in again to view your account.", signIn:true};
    if (error.status === 403) return {title:"Access unavailable", description:"This account cannot view these records. Please contact support if this seems incorrect.", signIn:false};
    if (error.status === 404) return {title:"Records unavailable", description:"This account section is temporarily unavailable. Try again or contact support.", signIn:false};
    if (error.status >= 500) return {title:"Connection unavailable", description:"We couldn't connect to your records. Your services and payments have not been changed.", signIn:false};
  }
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return {title:"Connection timed out", description:"Your records are taking longer than expected. Please try again.", signIn:false};
  }
  return {title:"Unable to load records", description:"We couldn't verify your account records. Please try again or contact support.", signIn:false};
}

export function ClientResourceListView({ resource }: ClientResourceListViewProps) {
  const config = clientResourceConfig[resource];

  const [records, setRecords] = useState<ClientRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [issue, setIssue] = useState<LoadIssue | null>(null);
  const requestId = useRef(0);
  useEffect(() => () => { requestId.current += 1; }, [resource]);

  async function loadRecords(quiet = false) {
    const current = ++requestId.current;
    setError("");
    setIssue(null);
    if (!quiet) setIsLoading(true);
    try {
      const response = await config.loader();
      const apiRecords = unwrapClientList(response).map((item) => normalizeClientRecord(item, config.key));
      if (current === requestId.current) setRecords(apiRecords);
    } catch (cause) {
      if (current !== requestId.current) return;
      if (!quiet) setRecords([]);
      setError("We couldn't load your information right now.");
      setIssue(explainListError(cause));
    } finally {
      if (current === requestId.current) setIsLoading(false);
    }
  }

  useAutoSync(loadRecords, resource);

  const essential=resource==="services"||resource==="domains";
  const billing=resource==="orders"||resource==="invoices";
  const actions=config.actionHref?<ActionLink href={config.actionHref} size="md" className="w-full sm:w-auto">
    <Plus aria-hidden="true" className="h-4 w-4"/>{config.actionLabel??"Create"}
  </ActionLink>:undefined;
  const retry=<ActionButton type="button" size="sm" variant="outline"
    leadingIcon={<RefreshCcw className="h-4 w-4" aria-hidden="true"/>}
    onClick={()=>{void loadRecords(false);}}>Try again</ActionButton>;
  const recovery=issue?.signIn?<ActionLink href="/login" size="sm" variant="outline">Sign in</ActionLink>:retry;
  const body=<div className="space-y-5">

    {isLoading?<LoadingState title={`Loading your ${config.title.toLowerCase()}`} description="Checking your latest account records."/>:
     error&&(!records.length||issue?.signIn)?<ErrorState title={issue?.title} description={issue?.description??error} action={recovery}/>:
     <>
       {error&&issue?<div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-console-line bg-white px-4 py-3 text-sm text-console-muted">
         <span>{issue.description} Previously loaded records are shown below.</span>{recovery}
       </div>:null}
       {essential?<ClientEssentialRecords resource={resource} records={records} emptyTitle={config.emptyTitle} emptyDescription={config.emptyDescription}/>:
        billing?<BillingRecordDirectory resource={resource} records={records} emptyTitle={config.emptyTitle} emptyDescription={config.emptyDescription}/>:
        <ClientRecordList records={records} resource={resource} emptyTitle={config.emptyTitle} emptyDescription={config.emptyDescription}/>}
     </>}
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

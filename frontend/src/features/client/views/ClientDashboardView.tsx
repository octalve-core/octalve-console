"use client";

import {useMemo} from "react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {useAuth} from "@/context/AuthContext";
import {ClientHero} from "../components/ClientHero";
import {ClientLoginAlerts} from "../components/ClientLoginAlerts";
import {ClientOverviewActions} from "../components/ClientOverviewActions";
import {ClientOverviewMetrics} from "../components/ClientOverviewMetrics";
import {ClientOverviewRecent} from "../components/ClientOverviewRecent";
import {useClientSummary} from "../hooks/useClientSummary";
import {useAutoSync} from "@/lib/hooks/useAutoSync";

export function ClientDashboardView(){
  const {user}=useAuth();
  const {summary,refresh}=useClientSummary();
  useAutoSync(quiet=>{if(quiet)refresh();}, "client-overview");
  const firstName=useMemo(()=>{
    const name=user?.name||user?.full_name||"there";
    return name.trim().split(/\s+/)[0]||"there";
  },[user]);
  const waiting=summary.status==="loading";
  return <DashboardShell role="client" title="My dashboard"
    description="Manage hosting, domains, billing and support.">
    <div className="space-y-6">
      <ClientHero name={firstName}/>
      <ClientLoginAlerts/>
      <ClientOverviewActions/>
      <ClientOverviewMetrics summary={summary}/>
      <div className="grid gap-5 xl:grid-cols-2">
        <ClientOverviewRecent title="Your services" description="Your latest hosting and cloud services."
          href="/client/services" records={summary.serviceRecords}
          state={waiting?"loading":summary.serviceRecordsAvailable?"ready":"unavailable"}/>
        <ClientOverviewRecent title="Unpaid invoices" description="Keep track of invoices awaiting payment."
          href="/client/invoices" records={summary.invoiceRecords}
          state={waiting?"loading":summary.invoiceRecordsAvailable?"ready":"unavailable"}/>
      </div>
    </div>
  </DashboardShell>;
}

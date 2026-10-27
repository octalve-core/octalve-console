"use client";

import {useMemo} from "react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {useAuth} from "@/context/AuthContext";
import {useLocale} from "@/lib/i18n/LocaleProvider";
import {messages} from "@/lib/i18n/dictionary";
import {ClientHero} from "../components/ClientHero";
import {ClientLoginAlerts} from "../components/ClientLoginAlerts";
import {ClientRecognitionBanner} from "../components/ClientRecognitionBanner";
import {ClientOverviewActions} from "../components/ClientOverviewActions";
import {ClientOverviewMetrics} from "../components/ClientOverviewMetrics";
import {ClientOverviewRecent} from "../components/ClientOverviewRecent";
import {useClientSummary} from "../hooks/useClientSummary";
import {useAutoSync} from "@/lib/hooks/useAutoSync";

export function ClientDashboardView(){
  const {user}=useAuth();
  const {locale}=useLocale(),m=messages(locale);
  const {summary,refresh}=useClientSummary();
  useAutoSync(quiet=>{if(quiet)refresh();}, "client-overview");
  const firstName=useMemo(()=>{
    const name=user?.name||user?.full_name||"there";
    return name.trim().split(/\s+/)[0]||"there";
  },[user]);
  const waiting=summary.status==="loading";
  return <DashboardShell role="client" title={m.dashboard}
    description={m.dashboardIntro}>
    <div className="space-y-6">
      <ClientHero name={firstName}/>
      <ClientLoginAlerts/>
      <ClientRecognitionBanner/>
      <ClientOverviewActions/>
      <ClientOverviewMetrics summary={summary}/>
      <div className="grid gap-5 xl:grid-cols-2">
        <ClientOverviewRecent title={m.servicesRecent} description={m.servicesRecentDesc}
          href="/client/services" records={summary.serviceRecords}
          state={waiting?"loading":summary.serviceRecordsAvailable?"ready":"unavailable"}/>
        <ClientOverviewRecent title={m.invoicesRecent} description={m.invoicesRecentDesc}
          href="/client/invoices" records={summary.invoiceRecords}
          state={waiting?"loading":summary.invoiceRecordsAvailable?"ready":"unavailable"}/>
      </div>
    </div>
  </DashboardShell>;
}

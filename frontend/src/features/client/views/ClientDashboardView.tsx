"use client";

import {useMemo} from "react";
import {CreditCard,Globe2,PackageCheck,Ticket,WalletCards,RefreshCcw} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {MetricCard} from "@/components/data/MetricCard";
import {ResponsiveGrid} from "@/components/data/ResponsiveGrid";
import {useAuth} from "@/context/AuthContext";
import {formatCurrency,formatNumber} from "@/lib/formatters";
import {ClientHero} from "../components/ClientHero";
import {ClientSectionCard} from "../components/ClientSectionCard";
import {useClientSummary} from "../hooks/useClientSummary";

export function ClientDashboardView(){
  const {user}=useAuth();
  const {summary,refresh}=useClientSummary();
  const firstName=useMemo(()=>{
    const name=user?.name||user?.full_name||"there";
    return name.trim().split(/\s+/)[0]||"there";
  },[user]);
  const waiting=summary.status==="loading";
  const count=(value:number|null)=>waiting?"…":value===null?"—":formatNumber(value);
  const balance=waiting?"…":summary.wallet===null?"—":formatCurrency(summary.wallet);
  return <DashboardShell role="client" title="My dashboard"
    description="Manage hosting, domains, billing and support.">
    <div className="space-y-6">
      <ClientHero name={firstName}/>
      {summary.status==="partial"&&<div role="status"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p>Some account information could not be refreshed. Your existing services and invoices have not been changed.</p>
        <button type="button" className="rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold"
          onClick={refresh}><RefreshCcw className="mr-2 inline h-4 w-4"/>Try again</button>
      </div>}
      <div aria-busy={waiting}>
        <ResponsiveGrid columns="4">
          <MetricCard label="Services" value={count(summary.services)}
            description="Your hosting and cloud services" icon={<PackageCheck className="h-5 w-5"/>}/>
          <MetricCard label="Unpaid invoices" value={count(summary.invoices)}
            description="Invoices awaiting payment" icon={<CreditCard className="h-5 w-5"/>}/>
          <MetricCard label="Domains" value={count(summary.domains)}
            description="Your domain names" icon={<Globe2 className="h-5 w-5"/>}/>
          <MetricCard label="Wallet balance" value={balance}
            description={summary.wallet===null&&!waiting?"Balance temporarily unavailable":"Available account credit"}
            icon={<WalletCards className="h-5 w-5"/>}/>
          <MetricCard label="Support tickets" value={count(summary.tickets)}
            description="Your support requests" icon={<Ticket className="h-5 w-5"/>}/>
        </ResponsiveGrid>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <ClientSectionCard title="Your services" description="Your latest hosting and cloud services."
          href="/client/services" records={summary.serviceRecords}
          state={waiting?"loading":summary.serviceRecordsAvailable?"ready":"unavailable"}/>
        <ClientSectionCard title="Unpaid invoices" description="Keep track of invoices awaiting payment."
          href="/client/invoices" records={summary.invoiceRecords}
          state={waiting?"loading":summary.invoiceRecordsAvailable?"ready":"unavailable"}/>
      </div>
    </div>
  </DashboardShell>;
}

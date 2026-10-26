"use client";

import {useEffect,useState} from "react";
import {WalletCards,RefreshCcw} from "lucide-react";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {MetricCard} from "@/components/data/MetricCard";
import {clientApi} from "@/lib/api/endpoints";
import {formatCurrency} from "@/lib/formatters";

export function ClientWalletView(){
  const [balance,setBalance]=useState<number|null>(null);
  const [status,setStatus]=useState<"loading"|"ready"|"unavailable">("loading");
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let active=true;
    setStatus("loading");
    clientApi.wallet().then(data=>{
      if(!active)return;
      const raw=(data as {available?:unknown})?.available;
      const number=Number(raw);
      if((typeof raw!=="string"&&typeof raw!=="number")||!Number.isFinite(number)||number<0)
        throw new Error("Invalid balance");
      setBalance(number);setStatus("ready");
    }).catch(()=>{if(active){setBalance(null);setStatus("unavailable");}});
    return ()=>{active=false;};
  },[revision]);
  return <DashboardShell role="client" title="Wallet" description="Your account credit and balance.">
    <DashboardPage eyebrow="Wallet" title="Wallet balance"
      description="Check your available account credit and payment options.">
      <div className="space-y-5">
        {status==="unavailable"&&<div role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>We couldn’t confirm your wallet balance right now. Please try again.</p>
          <button type="button" onClick={()=>setRevision(x=>x+1)}
            className="rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold">
            <RefreshCcw className="mr-2 inline h-4 w-4"/>Refresh
          </button>
        </div>}
        <MetricCard label="Available balance"
          value={status==="loading"?"…":balance===null?"—":formatCurrency(balance)}
          description="Verified wallet credit" icon={<WalletCards className="h-5 w-5"/>}/>
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold">Wallet activity</h2>
          <p className="mt-2 text-sm text-slate-600">
            Your payment history will appear here when available. For current invoices, visit your billing page.
          </p>
          <a href="/client/invoices" className="mt-4 inline-flex text-sm font-semibold text-[#0064E0]">
            View invoices
          </a>
        </section>
      </div>
    </DashboardPage>
  </DashboardShell>;
}

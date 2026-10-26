"use client";

import {useEffect,useState} from "react";
import {RefreshCcw} from "lucide-react";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {Panel} from "@/components/design-system/Panel";
import {ActionButton} from "@/components/design-system/ActionButton";
import {ActionLink} from "@/components/design-system/ActionLink";
import {WalletBalanceCard} from "../components/commerce/WalletBalanceCard";
import {clientApi} from "@/lib/api/endpoints";

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
          <ActionButton type="button" size="sm" variant="outline" onClick={()=>setRevision(x=>x+1)}
            leadingIcon={<RefreshCcw aria-hidden="true" className="h-4 w-4"/>}>Refresh</ActionButton>
        </div>}
        <WalletBalanceCard balance={balance} status={status}/>
        <Panel>
          <h2 className="text-lg font-semibold text-console-ink">Wallet activity</h2>
          <p className="mt-3 text-sm leading-6 text-console-muted">
            Your payment history will appear here when available. For current invoices, visit your billing page.
          </p>
          <ActionLink href="/client/invoices" variant="outline" className="mt-5 w-full sm:w-auto">
            View invoices
          </ActionLink>
        </Panel>
      </div>
    </DashboardPage>
  </DashboardShell>;
}

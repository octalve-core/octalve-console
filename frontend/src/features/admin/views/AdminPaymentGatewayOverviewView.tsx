"use client";
import {useCallback,useEffect,useState} from "react";
import {ArrowLeft,CreditCard,RefreshCcw,ShieldCheck} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {Panel} from "@/components/design-system/Panel";
import {ActionLink} from "@/components/design-system/ActionLink";
import {ActionButton} from "@/components/design-system/ActionButton";
import {schemaApi} from "@/lib/api/schema-api";
import type {Gateway} from "@/lib/api/types";

type LoadState={loading:boolean;error:string;gateway:Gateway|null;checked:boolean;nextPage:boolean};
const initial:LoadState={loading:true,error:"",gateway:null,checked:false,nextPage:false};
function gatewayRows(value:Gateway[]|{results?:Gateway[];next?:unknown}){
 if(Array.isArray(value))return {records:value,hasMore:false};
 return {records:Array.isArray(value.results)?value.results:[],hasMore:Boolean(value.next)};
}
/** Read-only server-record overview. Never handles or displays gateway secrets. */
export function AdminPaymentGatewayOverviewView(){
 const [state,setState]=useState<LoadState>(initial);
 const load=useCallback(async(active:()=>boolean)=>{
  setState(prev=>({...prev,loading:true,error:""}));
  try{
   const result=await schemaApi.payments.gateways();
   if(!active())return;
   const {records,hasMore}=gatewayRows(result);
   const found=records.find(g=>g.name?.trim().toLowerCase().includes("paystack"))??null;
   setState({loading:false,error:"",gateway:found,checked:true,nextPage:hasMore});
  }catch{
   if(active())setState({loading:false,error:"Gateway records are temporarily unavailable. Please try again.",gateway:null,checked:false,nextPage:false});
  }
 },[]);
 useEffect(()=>{let mounted=true;void load(()=>mounted);return ()=>{mounted=false;};},[load]);
 const current=state.gateway;
 return <DashboardShell role="admin" title="Paystack" description="Review your payment gateway record.">
  <DashboardPage eyebrow="Payment gateways" title="Paystack"
   description="View the recorded Paystack gateway status without exposing credentials or modifying payment processing.">
   <div className="mx-auto max-w-4xl space-y-5">
    <Panel>
     <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
       <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-console-primary">
        <CreditCard className="h-6 w-6"/>
       </span>
       <div className="min-w-0">
        <h2 className="text-lg font-medium text-console-ink">Gateway record</h2>
        <p className="mt-1 text-sm text-console-muted">Information reported by the Octalve Console API</p>
       </div>
      </div>
      <ActionButton type="button" variant="outline" disabled={state.loading} onClick={()=>void load(()=>true)}
       leadingIcon={<RefreshCcw aria-hidden="true" className="h-4 w-4"/>}>Refresh</ActionButton>
     </div>
     <div role="status" aria-live="polite" className="mt-5 rounded-xl border border-console-line bg-slate-50 p-4">
      {state.loading?<p className="text-sm text-console-muted">Checking available gateway records…</p>:
       state.error?<p className="text-sm text-rose-700">{state.error}</p>:
       current?<dl className="grid gap-3 sm:grid-cols-2">
        <div><dt className="text-xs font-medium text-console-muted">Name</dt>
         <dd className="mt-1 break-words text-sm font-medium text-console-ink">{current.name}</dd></div>
        <div><dt className="text-xs font-medium text-console-muted">Recorded status</dt>
         <dd className="mt-1 text-sm font-medium text-console-ink">{current.status}</dd></div>
       </dl>:
       <p className="text-sm text-console-muted">No Paystack entry was returned in the current gateway list{state.nextPage?". Additional gateway pages may exist.":"."}</p>}
     </div>
     <p className="mt-4 text-sm leading-6 text-console-muted">
      A listed gateway does not confirm live payment readiness. Checkout and webhook verification
      are controlled by the Django API and require their own acceptance checks.
     </p>
     <div className="mt-5 flex flex-col gap-3 sm:flex-row">
      <ActionLink href="/admin/gateways" variant="outline" className="w-full sm:w-auto">
       <ArrowLeft aria-hidden="true" className="h-4 w-4"/>All gateways
      </ActionLink>
      {current?<ActionLink href={"/admin/gateways/"+encodeURIComponent(String(current.id))}
       className="w-full sm:w-auto">View gateway record</ActionLink>:null}
     </div>
    </Panel>
    <Panel className="flex items-start gap-3">
     <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-console-primary"/>
     <div>
      <h3 className="text-sm font-medium text-console-ink">Credentials stay protected</h3>
      <p className="mt-2 text-sm leading-6 text-console-muted">
       No public or secret keys, webhook secrets, or test card details are displayed here.
       Changes must use verified administrator workflows, not an unconnected Save form.
      </p>
     </div>
    </Panel>
   </div>
  </DashboardPage>
 </DashboardShell>;
}

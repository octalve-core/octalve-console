"use client";
import {useEffect,useState,type FormEvent} from "react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {Panel} from "@/components/design-system/Panel";
import {ActionButton} from "@/components/design-system/ActionButton";
import {adminApi,type AdminRewardStatistics} from "@/lib/api/endpoints";

type Application={id:number;client_id:number;status:string;created_at:string};
const field="mt-2 h-11 w-full rounded-xl border border-console-line bg-white px-3 text-sm";
export function AdminRewardsView(){
 const [stats,setStats]=useState<AdminRewardStatistics|null>(null);
 const [applications,setApplications]=useState<Application[]>([]);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [invoiceId,setInvoiceId]=useState("");
 const [customerId,setCustomerId]=useState("");
 const [title,setTitle]=useState("");
 const [thankYou,setThankYou]=useState("");
 async function refresh(){
  setLoading(true);
  try{
   const [a,b]=await Promise.all([adminApi.rewardStats(),adminApi.affiliateApplications()]);
   setStats(a);setApplications(b.results);setError("");
  }catch{setError("Rewards require the approved database migration and programme activation.");}
  finally{setLoading(false);}
 }
 useEffect(()=>{void refresh();},[]);
 async function review(id:number,decision:"approve"|"reject"|"suspend"){
  if(busy)return;setBusy(true);setError("");setMessage("");
  try{await adminApi.reviewAffiliate(id,decision);await refresh();setMessage("Affiliate review saved.");}
  catch{setError("Review wasn't saved.");}finally{setBusy(false);}
 }
 async function award(e:FormEvent<HTMLFormElement>){
  e.preventDefault();const id=Number(invoiceId);if(!Number.isSafeInteger(id)||id<1||busy)return;
  setBusy(true);setError("");setMessage("");
  try{const result=await adminApi.awardPurchasePoints(id);await refresh();
   setMessage(result.already_recorded?"Award already recorded — no duplicate points.":result.points+" points awarded.");}
  catch{setError("Award denied. Verify the live payment, invoice and policy.");}finally{setBusy(false);}
 }
 async function reverse(){
  const id=Number(invoiceId);if(!Number.isSafeInteger(id)||id<1||busy)return;
  setBusy(true);setError("");setMessage("");
  try{const result=await adminApi.reversePurchasePoints(id);await refresh();
   setMessage(result.already_recorded?"Refund points were already reversed.":"Verified refund reversal recorded.");}
  catch{setError("Reversal denied. Verify the original award and live refund proof.");}
  finally{setBusy(false);}
 }
 async function recognize(e:FormEvent<HTMLFormElement>){
  e.preventDefault();const id=Number(customerId);if(!Number.isSafeInteger(id)||id<1||busy)return;
  setBusy(true);setError("");setMessage("");
  try{await adminApi.recognizeCustomer(id,title,thankYou);setMessage("Private appreciation published.");
   setCustomerId("");setTitle("");setThankYou("");}
  catch{setError("Appreciation wasn't published.");}finally{setBusy(false);}
 }
 return <DashboardShell role="admin" title="Rewards & Affiliates"
    description="Private customer engagement and safe rewards governance.">
  <DashboardPage eyebrow="Growth" title="Rewards & Affiliates"
    description="Celebrate customers, review affiliates and protect margins.">
   <div className="space-y-5">
    {loading?<p role="status" className="text-sm text-console-muted">Loading verified programme statistics…</p>:null}
    {error?<Panel><p role="alert" className="text-sm text-rose-700">{error}</p></Panel>:null}
    {message?<p role="status" className="text-sm text-emerald-700">{message}</p>:null}
    {stats?<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
     {[
      ["Pending reviews",stats.affiliate_applications],
      ["Approved affiliates",stats.affiliates_approved],
      ["Attributed registrations",stats.attributed_signups],
      ["Awarded points",stats.points_issued],
     ].map(([label,value])=><Panel key={String(label)}>
       <h2 className="text-sm text-console-muted">{label}</h2>
       <p className="mt-2 text-3xl font-semibold text-console-ink">{value}</p>
      </Panel>)}
    </div>:null}
    <div className="grid gap-5 xl:grid-cols-2">
     <Panel>
      <h2 className="text-lg font-semibold text-console-ink">Affiliate applications</h2>
      <p className="mt-2 text-sm text-console-muted">Approve after review. Signups alone do not earn commissions.</p>
      <div className="mt-4 space-y-3">
       {applications.length===0?<p className="text-sm text-console-muted">No applications to display.</p>:applications.map(a=>
        <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
         <span className="text-sm text-console-ink">Customer #{a.client_id} · {a.status}</span>
         <div className="flex gap-2">
          {a.status==="pending"?<>
           <ActionButton size="sm" disabled={busy} onClick={()=>void review(a.id,"approve")}>Approve</ActionButton>
           <ActionButton variant="outline" size="sm" disabled={busy} onClick={()=>void review(a.id,"reject")}>Decline</ActionButton>
          </>:a.status==="approved"?
           <ActionButton variant="outline" size="sm" disabled={busy} onClick={()=>void review(a.id,"suspend")}>Suspend</ActionButton>:null}
         </div>
        </div>)}
      </div>
     </Panel>
     <Panel>
      <h2 className="text-lg font-semibold text-console-ink">Verified purchase reward</h2>
      <p className="mt-2 text-sm text-console-muted">Admin-awarded points require a live verified invoice and cannot be awarded twice.</p>
      <form onSubmit={award} className="mt-4 space-y-3">
       <label className="block text-sm font-medium">Paid invoice ID
        <input className={field} type="number" min="1" required value={invoiceId}
         onChange={e=>setInvoiceId(e.target.value)}/></label>
       <div className="flex flex-wrap gap-3">
        <ActionButton disabled={busy} loading={busy}>Verify and award</ActionButton>
        <ActionButton type="button" variant="outline" disabled={busy||!invoiceId}
          onClick={()=>void reverse()}>Reverse verified refund</ActionButton>
       </div>
      </form>
     </Panel>
     <Panel>
      <h2 className="text-lg font-semibold text-console-ink">Private customer appreciation</h2>
      <p className="mt-2 text-sm text-console-muted">Publish a positive thank-you visible only to the selected customer.</p>
      <form onSubmit={recognize} className="mt-4 space-y-3">
       <label className="block text-sm font-medium">Customer ID
        <input className={field} type="number" min="1" value={customerId} required
         onChange={e=>setCustomerId(e.target.value)}/></label>
       <label className="block text-sm font-medium">Heading
        <input className={field} maxLength={120} minLength={4} required value={title}
         onChange={e=>setTitle(e.target.value)}/></label>
       <label className="block text-sm font-medium">Appreciation message
        <textarea className="mt-2 w-full rounded-xl border border-console-line p-3" rows={3}
         maxLength={500} minLength={8} required value={thankYou}
         onChange={e=>setThankYou(e.target.value)}/></label>
       <ActionButton disabled={busy} loading={busy}>Publish private appreciation</ActionButton>
      </form>
     </Panel>
     <Panel>
      <h2 className="text-lg font-semibold text-console-ink">Programme safeguards</h2>
      <p className="mt-2 text-sm leading-6 text-console-muted">
       Automatic commissions, cash payouts and checkout redemption remain disabled
       until price floors, refunds and settlement reconciliation have been certified.
      </p>
      <p className="mt-4 text-sm font-semibold text-console-ink">
       Pending commissions: ₦{stats?.pending_commissions_ngn||"0"}
      </p>
      <p className="mt-3 text-xs text-console-muted">No client is publicly ranked or negatively graded.</p>
     </Panel>
    </div>
    {stats&&stats.top_advocates_private.length>0?<Panel>
     <h2 className="text-lg font-semibold text-console-ink">Customer advocates — Admin-only KPI</h2>
     <div className="mt-4 space-y-2">{stats.top_advocates_private.map(a=>
      <p key={a.client_id} className="rounded-xl bg-slate-50 p-3 text-sm text-console-ink">
       Customer #{a.client_id} · {a.points} points · {a.events} verified events
      </p>)}</div>
     <p className="mt-3 text-xs text-console-muted">Private report only. Public recognition requires separate opt-in and approval.</p>
    </Panel>:null}
   </div>
  </DashboardPage>
 </DashboardShell>;
}

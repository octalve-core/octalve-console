"use client";
import {useEffect,useState} from "react";
import {api} from "@/lib/api/client";
type Policy={enabled:boolean;invoice_lead_days:number;reminder_days:number;tax_mode:string;tax_rate:string};
const initial:Policy={enabled:false,invoice_lead_days:14,reminder_days:7,tax_mode:"exclusive",tax_rate:""};
function RenewalPolicyEditor(){
 const [available,setAvailable]=useState(false),[policy,setPolicy]=useState(initial),[status,setStatus]=useState("Loading renewal policy…"),[busy,setBusy]=useState(false);
 const [confirmation,setConfirmation]=useState({confirm_password:"",totp_code:""});
 useEffect(()=>{api.get<{available:boolean;policy:Policy|null}>("/services/renewal-policy/").then(result=>{setAvailable(result.available);if(result.policy){const {enabled,invoice_lead_days,reminder_days,tax_mode,tax_rate}=result.policy;setPolicy({enabled,invoice_lead_days,reminder_days,tax_mode,tax_rate})}setStatus(result.available?"Review and approve the renewal terms.":"Renewal authority is not enabled.")}).catch(()=>setStatus("Renewal policy unavailable."))},[]);
 return <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 xl:col-span-2">
 <h2 className="font-medium">Hosting renewal policy</h2><p className="text-sm text-slate-600">Invoices and reminders use approved calendar terms. Automatic card debits are not enabled.</p>
 <form className="space-y-3" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await api.post("/services/renewal-policy/",{policy,...confirmation});setStatus("Policy approved.")}catch{setStatus("Approval failed. Review settings and authentication.")}finally{setConfirmation({confirm_password:"",totp_code:""});setBusy(false)}}}>
 <fieldset disabled={!available||busy} className="grid gap-3 sm:grid-cols-2">
 <label className="flex gap-2 items-center"><input type="checkbox" checked={policy.enabled} onChange={e=>setPolicy({...policy,enabled:e.target.checked})}/>Enable renewal invoicing</label>
 <label>Invoice lead days<input className="block w-full border rounded p-2" type="number" min="1" max="30" required value={policy.invoice_lead_days} onChange={e=>setPolicy({...policy,invoice_lead_days:Number(e.target.value)})}/></label>
 <label>Reminder lead days<input className="block w-full border rounded p-2" type="number" min="0" max={policy.invoice_lead_days-1} required value={policy.reminder_days} onChange={e=>setPolicy({...policy,reminder_days:Number(e.target.value)})}/></label>
 <label>Tax treatment<select className="block w-full border rounded p-2" value={policy.tax_mode} onChange={e=>setPolicy({...policy,tax_mode:e.target.value})}><option value="exclusive">Exclusive</option><option value="inclusive">Inclusive</option></select></label>
 <label>Approved tax rate (%)<input className="block w-full border rounded p-2" type="number" min="0" max="30" step=".01" required value={policy.tax_rate} onChange={e=>setPolicy({...policy,tax_rate:e.target.value})}/></label>
 <label>Confirm password<input className="block w-full border rounded p-2" type="password" autoComplete="current-password" required value={confirmation.confirm_password} onChange={e=>setConfirmation({...confirmation,confirm_password:e.target.value})}/></label>
 <label>Authenticator code<input className="block w-full border rounded p-2" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required value={confirmation.totp_code} onChange={e=>setConfirmation({...confirmation,totp_code:e.target.value})}/></label>
 <button className="rounded bg-slate-900 text-white p-2 disabled:opacity-50" type="submit">{busy?"Approving…":"Approve policy"}</button>
 </fieldset></form><p role="status" className="text-sm">{status}</p></section>
}

function LifecyclePolicyEditor(){
 const [state,setState]=useState<{available:boolean;policy:{enabled:boolean;grace_days:number;restore_enabled:boolean}|null}|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 useEffect(()=>{api.get<{available:boolean;policy:{enabled:boolean;grace_days:number;restore_enabled:boolean}|null}>("/services/lifecycle-policy/").then(setState).catch(()=>setNotice("Lifecycle policy unavailable."))},[]);
 return <section className="rounded-xl border border-console-line bg-white p-5 space-y-3">
 <h2 className="font-medium">Nonpayment lifecycle</h2><p className="text-sm text-console-muted">Suspend only after the approved grace period and restore only an independently verified Octalve nonpayment hold.</p>
 {!state?.available?<p className="text-sm text-console-muted">Lifecycle release not enabled.</p>:<form className="space-y-3" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget,f=new FormData(form);setBusy(true);try{await api.post("/services/lifecycle-policy/",{policy:{enabled:f.get("enabled")==="on",grace_days:Number(f.get("grace")),restore_enabled:f.get("restore")==="on"},confirm_password:String(f.get("password")||""),totp_code:String(f.get("totp")||"")});setNotice("Lifecycle policy approved.")}catch{setNotice("Policy could not be approved.")}finally{form.reset();setBusy(false)}}}>
 <label className="flex gap-2 text-sm"><input name="enabled" type="checkbox" defaultChecked={state.policy?.enabled??false}/>Enable overdue suspension</label>
 <label className="block text-sm">Grace period (days)<input name="grace" type="number" min={1} max={30} defaultValue={state.policy?.grace_days??3} required className="mt-1 block w-full rounded border border-console-line p-2"/></label>
 <label className="flex gap-2 text-sm"><input name="restore" type="checkbox" defaultChecked={state.policy?.restore_enabled??false}/>Restore after verified renewal</label>
 <label className="block text-sm">Current password<input name="password" type="password" autoComplete="current-password" required className="mt-1 block w-full rounded border border-console-line p-2"/></label>
 <label className="block text-sm">Authenticator code<input name="totp" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required className="mt-1 block w-full rounded border border-console-line p-2"/></label>
 <button disabled={busy} className="min-h-11 rounded bg-console-primary px-4 text-sm font-medium text-white disabled:opacity-50">{busy?"Approving…":"Approve lifecycle policy"}</button>
 </form>}
 {notice&&<p role="status" className="text-sm">{notice}</p>}</section>
}
export function HostingRenewalPolicy(){return <><RenewalPolicyEditor/><LifecyclePolicyEditor/><CancellationPolicyEditor/></>}

type CancelState={available:boolean;policy:{enabled:boolean;retention_days:number;termination_enabled:boolean}|null;pending:{pk:number;service_id:number;service__domain_name:string;service__next_due_date:string}[];retained:{pk:number;domain_name:string;cancelled_at:string}[]};
function CancellationPolicyEditor(){
 const [state,setState]=useState<CancelState|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const [mode,setMode]=useState<"policy"|"approve"|"terminate">("policy");
 const [requestId,setRequestId]=useState(""),[serviceId,setServiceId]=useState("");
 async function refresh(){try{setState(await api.get<CancelState>("/services/cancellation-policy/"))}catch{setState(null);setNotice("Cancellation status unavailable.")}}
 useEffect(()=>{void refresh()},[]);
 const field="mt-1 block w-full rounded border border-console-line p-2";
 return <section className="rounded-xl border border-console-line bg-white p-5 space-y-3 xl:col-span-2">
 <h2 className="font-medium">Cancellation and retention</h2><p className="text-sm text-console-muted">Keep customer access through the paid term. Permanent deletion stays separately disabled unless approved. An administrator must confirm a recoverable offsite backup and the exact domain after retention.</p>
 {!state?.available?<p className="text-sm text-console-muted">Cancellation release not enabled.</p>:<form key={mode} className="space-y-3" onSubmit={async e=>{e.preventDefault();if(busy)return;const form=e.currentTarget,f=new FormData(form);const common={action:mode,confirm_password:String(f.get("password")||""),totp_code:String(f.get("totp")||"")};const selected=state.pending.find(x=>String(x.pk)===requestId);if(mode==="approve"&&!selected)return;const payload=mode==="policy"?{...common,policy:{enabled:f.get("enabled")==="on",retention_days:Number(f.get("retention")),termination_enabled:f.get("termination")==="on"}}:mode==="approve"?{...common,service_id:selected?.service_id,request_id:Number(requestId)}:{...common,service_id:Number(serviceId),confirmed_domain:String(f.get("domain")||""),backup_reference:String(f.get("backup")||"")};setBusy(true);setNotice("");try{await api.post("/services/cancellation-policy/",payload);setNotice("Approval recorded. Supplier state will be independently reconciled by the worker.");await refresh()}catch{setNotice("Approval refused. Check paid invoices, retention, notice, supplier authorization and authenticator.")}finally{for(const name of ["password","totp"]){const input=form.elements.namedItem(name);if(input instanceof HTMLInputElement)input.value=""}setBusy(false)}}}>
 <label className="block text-sm">Action<select value={mode} onChange={e=>setMode(e.target.value as typeof mode)} className={field}><option value="policy">Configure retention policy</option><option value="approve">Approve customer cancellation</option><option value="terminate">Authorize permanent removal</option></select></label>
 {mode==="policy"?<>
 <label className="flex gap-2 text-sm"><input name="enabled" type="checkbox" defaultChecked={state.policy?.enabled??false}/>Enable paid-term cancellation</label>
 <label className="block text-sm">Retention days<input name="retention" type="number" min={30} max={365} required defaultValue={state.policy?.retention_days??30} className={field}/></label>
 <label className="flex gap-2 text-sm"><input name="termination" type="checkbox" defaultChecked={state.policy?.termination_enabled??false}/>Allow separately approved permanent removal</label>
 </>:mode==="approve"?<label className="block text-sm">Customer request<select required value={requestId} onChange={e=>setRequestId(e.target.value)} className={field}><option value="">Select pending request</option>{state.pending.map(x=><option value={x.pk} key={x.pk}>{x.service__domain_name} · {new Date(x.service__next_due_date).toLocaleDateString("en-GB")}</option>)}</select></label>:<>
 <label className="block text-sm">Retained hosting account<select required value={serviceId} onChange={e=>setServiceId(e.target.value)} className={field}><option value="">Select retained account</option>{state.retained.map(x=><option value={x.pk} key={x.pk}>{x.domain_name}</option>)}</select></label>
 <label className="block text-sm">Type the exact domain to confirm<input name="domain" required autoComplete="off" className={field}/></label>
 <label className="block text-sm">Verified offsite restore-test reference<input name="backup" required minLength={8} maxLength={100} className={field}/></label>
 <label className="flex gap-2 text-sm"><input type="checkbox" required/>I have independently verified a recoverable offsite backup, retention and customer notice. This action can permanently remove hosting data.</label>
 </>}
 <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Current password<input name="password" type="password" autoComplete="current-password" required className={field}/></label><label className="text-sm">Authenticator code<input name="totp" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required className={field}/></label></div>
 <button disabled={busy||(mode==="approve"&&!requestId)||(mode==="terminate"&&!serviceId)} type="submit" className="min-h-11 rounded bg-console-primary px-4 text-sm font-medium text-white disabled:opacity-50">{busy?"Approving…":"Confirm approval"}</button>
 </form>}{notice&&<p role="status" className="text-sm">{notice}</p>}</section>
}

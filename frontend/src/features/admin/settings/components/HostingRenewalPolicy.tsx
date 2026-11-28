"use client";
import {useEffect,useState} from "react";
import {api} from "@/lib/api/client";
type Policy={enabled:boolean;invoice_lead_days:number;reminder_days:number;tax_mode:string;tax_rate:string};
const initial:Policy={enabled:false,invoice_lead_days:14,reminder_days:7,tax_mode:"exclusive",tax_rate:""};
export function HostingRenewalPolicy(){
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

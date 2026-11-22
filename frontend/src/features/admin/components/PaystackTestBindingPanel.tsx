"use client";

import {useCallback,useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {CheckCircle2,LockKeyhole,RefreshCcw,ShieldAlert} from "lucide-react";
import {api} from "@/lib/api/client";

type Connection={id:string;label:string;credential_version:number;verification_status:string};
type Status={
 binding_available:boolean;connections:Connection[];truncated:boolean;
 gateway_state:"test_only"|"not_bound";bound_connection_id:string|null;
 live_payments_enabled:false;
};
const field="mt-1 min-h-11 w-full rounded-xl border border-console-line bg-white px-3 py-2 text-sm text-console-ink";
export function PaystackTestBindingPanel(){
 const [state,setState]=useState<Status|null>(null);
 const [selected,setSelected]=useState("");
 const [loading,setLoading]=useState(true);
 const [working,setWorking]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const refresh=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const result=await api.get<Status>("/payments/admin/paystack-test-binding/");
   if(!result||!Array.isArray(result.connections)||result.live_payments_enabled!==false||
      !["test_only","not_bound"].includes(result.gateway_state))throw Error("Invalid readiness response");
   setState(result);
   setSelected(current=>result.connections.some(c=>c.id===current)?current:
    result.connections.find(c=>c.verification_status==="verified")?.id??"");
  }catch{
   setState(null);
   setError("Could not read the gateway binding status. No payment settings changed.");
  }finally{setLoading(false);}
 },[]);
 useEffect(()=>{void refresh()},[refresh]);
 async function bind(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!state?.binding_available||working||!selected)return;
  const form=event.currentTarget;
  const values=new FormData(form);
  const payload={connection_id:selected,
   confirm_password:String(values.get("confirm_password")??""),
   totp_code:String(values.get("totp_code")??"")};
  setWorking(true);setError("");setNotice("");
  try{
   const proof=await api.post<{gateway_state:string;binding_version:number;live_payments_enabled:boolean}>(
    "/payments/admin/paystack-test-binding/",payload);
   if(proof.gateway_state!=="test_only"||proof.live_payments_enabled!==false)
    throw Error("Unqualified gateway response");
   setNotice("Verified test key is bound without copying the secret. Live payments remain disabled.");
   await refresh();
  }catch{
   setError("Test binding was not approved. Check the verified key, current password and fresh authenticator code.");
  }finally{
   const password=form.elements.namedItem("confirm_password");
   const totp=form.elements.namedItem("totp_code");
   if(password instanceof HTMLInputElement)password.value="";
   if(totp instanceof HTMLInputElement)totp.value="";
   setWorking(false);
  }
 }
 const verified=state?.connections.filter(c=>c.verification_status==="verified")??[];
 return <section aria-label="Paystack encrypted test key" className="rounded-2xl border border-console-line bg-white p-5 shadow-sm">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div>
    <div className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-console-primary"/>
     <h2 className="text-sm font-medium text-console-ink">Paystack encrypted test connection</h2>
    </div>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-console-muted">
     Save and verify your test secret in the Integration Store. This page can bind that
     verified version to the test gateway without exposing or copying the credential.
     Real charges, webhooks and paid fulfillment remain separately restricted.
    </p>
   </div>
   <button type="button" disabled={loading||working} onClick={()=>void refresh()}
    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-console-line px-3 text-xs font-medium text-console-primary disabled:opacity-50">
    <RefreshCcw className="h-4 w-4"/>Refresh</button>
  </div>
  <Link href="/admin/integrations?provider=paystack"
   className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-console-line px-4 text-sm font-medium text-console-primary hover:bg-blue-50">
   Open secure Paystack credential setup
  </Link>
  {loading?<p role="status" className="mt-4 text-sm text-console-muted">Checking verified test connections…</p>:null}
  {error?<p role="alert" className="mt-4 flex gap-2 text-xs text-rose-700">
   <ShieldAlert className="h-4 w-4 shrink-0"/>{error}</p>:null}
  {notice?<p role="status" className="mt-4 flex gap-2 text-xs text-emerald-700">
   <CheckCircle2 className="h-4 w-4 shrink-0"/>{notice}</p>:null}
  {state?<div className="mt-4 space-y-3">
   <p className="text-xs text-console-muted">
    Gateway binding: {state.gateway_state==="test_only"?"Test-only reference recorded":"Not configured"}.
    {" "}Paystack live collection: disabled.
   </p>
   {!state.binding_available?<p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
    Binding is held until encrypted-key custody, the security authenticator, PostgreSQL audit safeguards and
    operator approval are qualified. Do not enter secrets anywhere else.
   </p>:null}
   {state.truncated?<p className="text-xs text-amber-800">Connection list is truncated. An operator must review older credentials.</p>:null}
   {state.binding_available&&verified.length===0?<p className="text-xs text-console-muted">
    No currently verified Paystack test-mode connection. Save and verify an sk_test_ key in the Integration Store first.
   </p>:null}
   {state.binding_available&&verified.length>0?<form autoComplete="off" onSubmit={bind} className="space-y-3">
    <label className="block text-xs text-console-ink">Verified Paystack test connection
     <select value={selected} onChange={e=>setSelected(e.target.value)} className={field} required>
      <option value="">Select verified connection</option>
      {verified.map(v=><option key={v.id} value={v.id}>
       {v.label} · version {v.credential_version}</option>)}
     </select>
    </label>
    <div className="grid gap-3 sm:grid-cols-2">
     <label className="text-xs text-console-ink">Current Super Admin password
      <input name="confirm_password" type="password" autoComplete="off" required className={field}/></label>
     <label className="text-xs text-console-ink">Fresh authenticator code
      <input name="totp_code" inputMode="numeric" type="text" pattern="[0-9]{6}"
       maxLength={6} autoComplete="one-time-code" required className={field}/></label>
    </div>
    <button type="submit" disabled={working||!selected}
     className="min-h-11 rounded-xl bg-console-primary px-4 text-sm font-medium text-white disabled:opacity-50">
     {working?"Binding verified test key…":"Bind verified test key"}
    </button>
   </form>:null}
  </div>:null}
 </section>;
}

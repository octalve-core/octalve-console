"use client";

import {useEffect,useState,type FormEvent} from "react";
import {CheckCircle2,ShieldAlert,ShieldCheck} from "lucide-react";
import {api} from "@/lib/api/client";

export type VaultSecurityStatus={
 verified:boolean;kind:"totp";enrollment_available:boolean;
 credential_submission_available:boolean;approved_draft_adapters?:string[];
 provider_execution_enabled:false;
};
type Enrollment={secret:string;otpauth_url:string;expires_in_seconds:number};

export function ProviderVaultEnrollment({initialStatus,onVerified,embedded=false}:{
 initialStatus?:VaultSecurityStatus;
 onVerified?:()=>void;
 embedded?:boolean;
}){
 const [status,setStatus]=useState<VaultSecurityStatus|null>(initialStatus??null);
 const [loading,setLoading]=useState(!initialStatus);
 const [busy,setBusy]=useState(false);
 const [enrollment,setEnrollment]=useState<Enrollment|null>(null);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 useEffect(()=>{
  if(initialStatus){setStatus(initialStatus);setLoading(false);return;}
  let active=true;
  void api.get<VaultSecurityStatus>("/providers/security/stepup/").then(result=>{
   if(!active)return;
   if(typeof result.verified!=="boolean" || result.provider_execution_enabled!==false ||
      typeof result.enrollment_available!=="boolean")throw Error("Bad response");
   setStatus(result);
  }).catch(()=>{if(active)setError("Provider-vault security status is unavailable. No enrollment was started.");})
    .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[initialStatus]);

 async function begin(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy||!status?.enrollment_available||status.verified)return;
  const form=event.currentTarget;
  const password=String(new FormData(form).get("confirm_password")||"");
  form.reset();setBusy(true);setError("");setNotice("");
  try{
   const data=await api.post<Enrollment>("/providers/security/stepup/enroll/",{confirm_password:password});
   if(typeof data.secret!=="string"||typeof data.otpauth_url!=="string"||
     data.expires_in_seconds!==300||!/^[A-Z2-7]{32}$/.test(data.secret))
    throw Error("Bad enrollment");
   setEnrollment(data);
  }catch{
   setEnrollment(null);setError("Enrollment was not started. Check your account password, custody approval and attempt limits.");
  }finally{setBusy(false);}
 }
 async function confirm(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy||!enrollment)return;
  const form=event.currentTarget;
  const values=new FormData(form);
  const confirm_password=String(values.get("confirm_password")||"");
  const totp_code=String(values.get("totp_code")||"");
  form.reset();setBusy(true);setError("");
  try{
   const data=await api.post<{verified:boolean}>("/providers/security/stepup/confirm/",{confirm_password,totp_code});
   if(data.verified!==true)throw Error("Bad confirmation");
   setEnrollment(null);
   setStatus(prev=>prev?{...prev,verified:true}:prev);
   setNotice("Provider-vault authenticator enrolled. Supplier execution and credential intake remain separately gated.");
   onVerified?.();
  }catch{
   setError("Authenticator confirmation failed or expired. Check the current six-digit code and your password; do not repeatedly retry.");
  }finally{setBusy(false);}
 }
 const fieldStyle="min-h-11 w-full rounded-lg border border-console-line bg-white px-3 py-2 text-sm text-console-ink";
 return <section aria-label="Provider-vault authenticator" className={embedded?"mt-4 space-y-3":"rounded-2xl border border-console-line bg-white p-5 shadow-sm xl:col-span-3"}>
  <div className="flex items-center gap-2">
   <ShieldCheck className="h-4 w-4 text-console-primary" aria-hidden="true"/>
   <h3 className="text-sm font-medium text-console-ink">Provider-vault authenticator</h3>
  </div>
  <p className="mt-2 text-xs leading-5 text-console-muted">
   A separate authenticator for changes to supplier credentials. Enrollment requires a verified Super Admin,
   the account password, and independently qualified step-up-key custody. It does not enable provisioning.
  </p>
  {loading?<p role="status" className="mt-3 text-xs text-console-muted">Checking authenticator readiness…</p>:null}
  {status?.verified?<p role="status" className="mt-3 flex items-center gap-2 text-xs text-emerald-700">
   <CheckCircle2 className="h-4 w-4" aria-hidden="true"/>Authenticator enrolled. Each credential mutation requires a fresh unused code.
  </p>:null}
  {status&&!status.verified&&!status.enrollment_available?<p role="status"
   className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
    Enrollment is blocked until independent key custody is documented and the operator enables the step-up enrollment gate.
  </p>:null}
  {status&&!status.verified&&status.enrollment_available&&!enrollment?<form onSubmit={begin} autoComplete="off" className="mt-4 space-y-3">
   <label className="block text-xs text-console-ink">Current Super Admin password
    <input name="confirm_password" type="password" required autoComplete="off" className={fieldStyle}/>
   </label>
   <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-console-primary px-4 text-xs font-medium text-white disabled:opacity-50">
    {busy?"Checking…":"Start 5-minute authenticator enrollment"}
   </button>
  </form>:null}
  {status&&!status.verified&&enrollment?<div className="mt-4 space-y-3">
   <p className="text-xs text-amber-900">Enter this one-time setup key into an authenticator app now.
    Do not screenshot, email or store it in browser storage. Enrollment expires after five minutes.</p>
   <code className="block break-all rounded-lg bg-slate-100 p-3 text-xs">{enrollment.secret}</code>
   <form onSubmit={confirm} autoComplete="off" className="space-y-3">
    <label className="block text-xs">Current Super Admin password
     <input type="password" name="confirm_password" required autoComplete="off" className={fieldStyle}/>
    </label>
    <label className="block text-xs">Six-digit authenticator code
     <input name="totp_code" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" required autoComplete="one-time-code" className={fieldStyle}/>
    </label>
    <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-console-primary px-4 text-xs font-medium text-white disabled:opacity-50">
     {busy?"Confirming…":"Confirm authenticator"}
    </button>
   </form>
  </div>:null}
  {error?<p role="alert" className="mt-3 flex gap-2 text-xs text-rose-700"><ShieldAlert className="h-4 w-4 shrink-0"/>{error}</p>:null}
  {notice?<p role="status" className="mt-3 text-xs text-emerald-700">{notice}</p>:null}
 </section>;
}

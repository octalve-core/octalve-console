"use client";

import {useCallback,useEffect,useState} from "react";
import {CheckCircle2,Mail,RefreshCw,ShieldAlert} from "lucide-react";
import {authApi} from "@/lib/api/endpoints";

type DeliveryStatus = {email_verified:boolean;delivery_configured:boolean};

export function AccountEmailVerificationPanel(){
  const [status,setStatus] = useState<DeliveryStatus|null>(null);
  const [loading,setLoading] = useState(true);
  const [sending,setSending] = useState(false);
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");

  const load = useCallback(async ()=>{
    setLoading(true);setError("");
    try{setStatus(await authApi.emailDeliveryStatus());}
    catch{setStatus(null);setError("Email readiness could not be checked. No changes were made.");}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{void load();},[load]);

  async function sendVerification(){
    if(!status?.delivery_configured||status.email_verified||sending)return;
    setSending(true);setError("");setMessage("");
    try{
      const response=await authApi.requestEmailVerification();
      if(response.email_verified){
        setStatus(current=>current?{...current,email_verified:true}:current);
        setMessage("Your account email is already verified.");
      }else{
        setMessage("A verification link was requested. Check your mailbox and follow the link.");
      }
    }catch{
      setError("The mail service did not accept this request. Check delivery configuration and try again later.");
    }finally{setSending(false);}
  }

  return <section aria-labelledby="account-email-readiness" className="min-w-0 rounded-2xl border border-console-line bg-white p-5 shadow-sm xl:col-span-3">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-console-primary">
          <Mail className="h-5 w-5" aria-hidden="true"/>
        </span>
        <div>
          <h2 id="account-email-readiness" className="text-sm font-medium text-console-ink">Account email and owner verification</h2>
          <p className="mt-1 text-xs leading-5 text-console-muted">
            Signed one-use verification links establish mailbox ownership. Email alone does not replace the provider vault MFA gate.
          </p>
        </div>
      </div>
      <button type="button" onClick={()=>{void load();}} disabled={loading||sending}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-console-line px-3 text-xs font-medium text-console-primary disabled:opacity-50">
        <RefreshCw aria-hidden="true" className="h-4 w-4"/> Refresh status
      </button>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-console-line bg-slate-50 p-4">
        <p className="text-xs text-console-muted">Authenticated SMTP configuration</p>
        <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-console-ink">
          {status?.delivery_configured?<CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true"/>:<ShieldAlert className="h-4 w-4 text-amber-700" aria-hidden="true"/>}
          {loading?"Checking…":status?(status.delivery_configured?"Configured, delivery not yet proven":"Not configured"):"Unknown"}
        </p>
      </div>
      <div className="rounded-xl border border-console-line bg-slate-50 p-4">
        <p className="text-xs text-console-muted">Your signed-in account email</p>
        <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-console-ink">
          {status?.email_verified?<CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true"/>:<ShieldAlert className="h-4 w-4 text-amber-700" aria-hidden="true"/>}
          {loading?"Checking…":status?(status.email_verified?"Verified":"Not verified"):"Unknown"}
        </p>
      </div>
    </div>
    <p className="mt-4 text-xs leading-5 text-console-muted">
      Configure a verified Octalve sender domain and an approved encrypted SMTP relay in the API server's protected Production environment. SMTP credentials are never entered into this page, the Integration Store, or browser storage. A configured status is not evidence that DNS authentication or actual email delivery succeeded.
    </p>
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" onClick={()=>{void sendVerification();}} disabled={loading||sending||!status?.delivery_configured||status?.email_verified}
        className="min-h-10 rounded-xl bg-console-primary px-4 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
        {sending?"Requesting secure link…":"Send verification email"}
      </button>
      <a href="https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP"
        target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center text-xs font-medium text-console-primary underline underline-offset-2">
        Brevo SMTP setup guidance
      </a>
    </div>
    {message?<p role="status" className="mt-3 text-xs text-console-primary">{message}</p>:null}
    {error?<p role="alert" className="mt-3 text-xs text-rose-700">{error}</p>:null}
  </section>;
}

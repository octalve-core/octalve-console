"use client";
import {CheckCircle2,Clock3,ShieldAlert} from "lucide-react";

export type ReadinessContract = {
  hosting_account:"verified"|"pending";
  panel_access:"available"|"unavailable";
  files:"unavailable";
  domain_dns:"verified"|"unverified";
  public_https:"verified"|"unverified";
  public_website:"verified"|"unverified";
  verification_checked_at:string|null;
};
export function HostingReadiness({readiness}: {readiness:ReadinessContract}){
  const steps=[
    {title:"Hosting account",complete:readiness.hosting_account==="verified",
      description:"Confirmed against your actual hosting account, not just an invoice."},
    {title:"OPanel access",complete:readiness.panel_access==="available",
      description:"Secure management access requires an active, owned, verified account."},
    {title:"Website files",complete:false,
      description:"Files and website publishing require an approved, account-scoped server connection."},
    {title:"Domain connection",complete:readiness.domain_dns==="verified",
      description:"The public DNS records must resolve to your own hosting service."},
    {title:"HTTPS certificate",complete:readiness.public_https==="verified",
      description:"A valid certificate for your domain must be checked externally."},
    {title:"Website live",complete:readiness.public_website==="verified",
      description:"The public HTTPS website must serve your actual published content."},
  ];
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-label="Website setup progress">
    <h2 className="text-lg font-medium text-slate-950">Website setup progress</h2>
    <p className="mt-2 text-sm leading-6 text-slate-600">
      Your hosting plan, secure panel, domain and public website are verified separately.
    </p>
    <ol className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {steps.map((step,index)=><li key={step.title} className="rounded-xl border border-slate-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400">{String(index+1).padStart(2,"0")}</span>
            <h3 className="text-sm font-medium text-slate-900">{step.title}</h3>
          </div>
          {step.complete?<CheckCircle2 aria-label="Verified" className="h-5 w-5 shrink-0 text-emerald-700"/>:
            <Clock3 aria-label="Pending verification" className="h-5 w-5 shrink-0 text-slate-400"/>}
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-600">{step.description}</p>
        <p className="mt-3 text-xs font-medium text-slate-500">
          {step.complete?"Verified":"Pending verification"}
        </p>
      </li>)}
    </ol>
    <div className="mt-5 flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true"/>
      Payment confirmation or an active service label alone cannot prove your website is online.
    </div>
  </section>;
}

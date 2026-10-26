"use client";
import Link from "next/link";
import {useParams} from "next/navigation";
import {useState} from "react";
import {ExternalLink,Globe2,Server,ShieldCheck} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {api} from "@/lib/api/client";
import {useAutoSync} from "@/lib/hooks/useAutoSync";
import {HostingReadiness,type ReadinessContract} from "../components/HostingReadiness";

type Overview={
  service_id:number;label:string;domain_name:string|null;service_type:string;
  status:string;next_due_date:string;active:boolean;usage_status:string;message:string;
  hosting_account_verified:boolean;website_public_status:string;
  dns_public_status:string;ssl_public_status:string;
  readiness:ReadinessContract;
  usage:{disk_used_mb:number;disk_limit_mb:number;bandwidth_used_mb:number;
    bandwidth_limit_mb:number;recorded_at:string}|null;
  capabilities:Record<string,boolean>;
};
const tools=[
  ["files","Files and uploads"],["subdomains","Subdomains"],
  ["dns","DNS records"],["databases","Databases"],["ssl","SSL certificates"],
  ["backups","Backups"],["email","Email accounts"]
] as const;

function panelUrl(serviceId:number){
  const configured=process.env.NEXT_PUBLIC_OPANEL_BASE_URL||"";
  try{
    const base=new URL(configured);
    if(base.protocol!=="https:"||base.pathname!=="/"||base.search||base.hash||
      base.username||base.password||!base.hostname||
      !/^[a-z0-9.-]+$/i.test(base.hostname))return null;
    const target=new URL("/auth/start/",base);
    target.searchParams.set("service_id",String(serviceId));
    return target.toString();
  }catch{return null;}
}
export function OPanelServiceOverview(){
  const params=useParams<{id:string}>();
  const serviceId=String(params.id||"");
  const [data,setData]=useState<Overview|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);

  useAutoSync(async(quiet)=>{
    if(!/^[1-9][0-9]{0,11}$/.test(serviceId)){
      setData(null);setError("This hosting service cannot be opened.");setLoading(false);return;
    }
    if(!quiet)setLoading(true);
    try{
      const result=await api.get<Overview>(
        `/services/opanel/${encodeURIComponent(serviceId)}/overview/`);
      if(!result.readiness||!result.capabilities)throw Error("Incomplete hosting status");
      setData(result);setError("");
    }catch{
      setData(null);
      setError("We couldn't confirm this hosting service. Please try opening it again from My Hosting.");
    }finally{setLoading(false);}
  },serviceId);

  const launch=data?.capabilities.panel_sso?panelUrl(data.service_id):null;
  const due=data?.next_due_date?new Date(data.next_due_date):null;
  const dueLabel=due&&!Number.isNaN(due.valueOf())
    ?new Intl.DateTimeFormat("en-NG",{day:"numeric",month:"short",year:"numeric"}).format(due):"Unavailable";
  const usage=data?.usage;
  return <DashboardShell role="client" title="Hosting status"
    description="Your hosting, domain and website setup progress.">
    <DashboardPage eyebrow="My Hosting" title={data?.label||"Your hosting service"}
      description="Follow each verified step from hosting account to published website.">
      <div className="space-y-5">
        <Link href={`/client/services/${encodeURIComponent(serviceId)}`}
          className="inline-flex text-sm font-medium text-[#0064E0]">Back to my hosting</Link>
        {loading?<div role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Preparing your hosting details…</div>:null}
        {error?<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>:null}
        {data&&<>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">Connected domain</p>
                <h2 className="mt-2 break-all text-xl font-medium text-slate-950">
                  {data.domain_name||"Connect your domain when hosting is ready"}
                </h2>
                <p className="mt-3 text-sm text-slate-600">
                  Service record: <span className="font-medium capitalize text-slate-800">{data.status.replaceAll("_"," ")}</span>
                </p>
                <p className="mt-1 text-sm text-slate-600">Next billing date: {dueLabel}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <Server className="h-4 w-4 text-[#0064E0]"/>
                  {data.hosting_account_verified?"Hosting account verified":"Hosting account awaiting verification"}
                </div>
              </div>
            </div>
            {launch?<a href={launch} rel="noreferrer"
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0064E0] px-5 py-3 text-sm font-medium text-white hover:bg-[#0052B8]">
              Manage hosting in OPanel <ExternalLink className="h-4 w-4"/>
            </a>:<p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              OPanel will become available after your hosting account and secure access have been verified. No additional account purchase is needed.
            </p>}
          </section>
          <HostingReadiness readiness={data.readiness}/>
          <section className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="flex items-center gap-2 text-lg font-medium text-slate-950">
                <Globe2 className="h-5 w-5 text-[#0064E0]"/>Domain and website
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                If you already own a domain, it can be connected to hosting after the account is ready. Domain DNS, SSL and website publication are not currently externally verified.
              </p>
              <Link href="/client/support/new" className="mt-4 inline-block text-sm font-medium text-[#0064E0]">Get help with domain setup</Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="flex items-center gap-2 text-lg font-medium text-slate-950">
                <ShieldCheck className="h-5 w-5 text-[#0064E0]"/>Recorded usage
              </h2>
              {usage?<dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-slate-500">Disk</dt><dd className="mt-1 font-medium">{usage.disk_used_mb} / {usage.disk_limit_mb} MB</dd></div>
                <div><dt className="text-slate-500">Bandwidth</dt><dd className="mt-1 font-medium">{usage.bandwidth_used_mb} / {usage.bandwidth_limit_mb} MB</dd></div>
                <div className="col-span-2 text-xs text-slate-500">Recorded {new Date(usage.recorded_at).toLocaleString()}. This is not a live server reading.</div>
              </dl>:<p className="mt-3 text-sm text-slate-600">Usage information has not yet been recorded for this service.</p>}
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-medium text-slate-950">Hosting tools</h2>
            <p className="mt-2 text-sm text-slate-600">Tools appear in OPanel after the relevant server capability is verified.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {tools.map(([key,label])=><div key={key} className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-medium text-slate-900">{label}</p>
                <p className="mt-2 text-xs text-slate-500">{data.capabilities[key]?"Available in OPanel":"Coming after server verification"}</p>
              </div>)}
            </div>
          </section>
        </>}
      </div>
    </DashboardPage>
  </DashboardShell>;
}

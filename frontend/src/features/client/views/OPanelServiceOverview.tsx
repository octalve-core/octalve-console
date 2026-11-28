"use client";
import Link from "next/link";
import {useParams} from "next/navigation";
import {useRef,useState} from "react";
import {ExternalLink,Globe2,Mail,Forward,ReplyAll,FolderOpen,Archive,Network,CalendarClock,Database,ShieldCheck,ListTree,KeyRound,Headphones,BarChart3} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {StatusBadge} from "@/components/design-system/StatusBadge";
import {ServiceUsageRing} from "../components/ServiceUsageRing";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {api} from "@/lib/api/client";
import {useAutoSync} from "@/lib/hooks/useAutoSync";
import {HostingReadiness,type ReadinessContract} from "../components/HostingReadiness";
import {NativeHostingResources,type ResourceTab} from "../components/NativeHostingResources";

type Overview={
  service_id:number;label:string;domain_name:string|null;service_type:string;
  status:string;next_due_date:string;active:boolean;usage_status:string;message:string;
  hosting_account_verified:boolean;website_public_status:string;
  dns_public_status:string;ssl_public_status:string;
  readiness:ReadinessContract;
  usage:{disk_used_mb:number;disk_limit_mb:number;bandwidth_used_mb:number;
    bandwidth_limit_mb:number;disk_unlimited?:boolean;bandwidth_unlimited?:boolean;recorded_at:string;
    resource_counts?:Record<string,{used:number;limit:number|null;unlimited:boolean}|null>}|null;
  capabilities:Record<string,boolean>;
  billing:{amount:string;currency:string;cycle:string;created_at:string;auto_renew:boolean};
  domain_id:number|null;
};
const tools=[
  {key:"email",label:"Email accounts",icon:Mail,native:"email"},
  {key:"forwarders",label:"Forwarders",icon:Forward,native:"forwarders"},
  {key:"autoresponders",label:"Autoresponders",icon:ReplyAll,native:"autoresponders"},
  {key:"files",label:"File manager",icon:FolderOpen},
  {key:"backups",label:"Backups",icon:Archive},
  {key:"subdomains",label:"Subdomains",icon:Network,native:"subdomains"},
  {key:"domains",label:"Addon domains",icon:Globe2},
  {key:"cron",label:"Cron jobs",icon:CalendarClock},
  {key:"databases",label:"Databases",icon:Database,native:"databases"},
  {key:"phpmyadmin",label:"phpMyAdmin",icon:Database},
  {key:"dns",label:"DNS manager",icon:ListTree},
  {key:"ssl",label:"SSL certificates",icon:ShieldCheck},
  {key:"stats",label:"Website statistics",icon:BarChart3}
] as const;
const control="min-h-11 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium";
const primary=control+" bg-[#0064E0] text-white hover:bg-[#0052B8] disabled:opacity-50";
const outline=control+" border border-console-line text-console-ink hover:bg-slate-50 disabled:opacity-50";
function dateLabel(value?:string|null){
  if(!value)return "Unavailable";
  const date=new Date(value);
  return Number.isNaN(date.valueOf())?"Unavailable":new Intl.DateTimeFormat("en-NG",{day:"numeric",month:"short",year:"numeric"}).format(date);
}
function money(amount?:string,currency?:string){
  if(!amount||!currency||!/^\\d+(?:\\.\\d{1,2})?$/.test(amount)||!/^[A-Z]{3}$/.test(currency))return "Unavailable";
  try{return new Intl.NumberFormat("en-NG",{style:"currency",currency}).format(Number(amount));}catch{return "Unavailable";}
}
const cycles:Record<string,string>={"1mo":"Monthly","3mo":"Quarterly","6mo":"Semi-annually","12mo":"Annually","24mo":"Every two years","once":"One time"};
function website(domain:string|null){
  if(!domain||!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(domain))return null;
  return "https://"+domain;
}

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
  const [nativeBusy,setNativeBusy]=useState(false);
  const [nativeError,setNativeError]=useState("");
  const [selected,setSelected]=useState<ResourceTab|null>(null);
  const [quick,setQuick]=useState(false);
  const resourceRef=useRef<HTMLDivElement>(null);
  const requestId=useRef(0);
  function choose(tab:ResourceTab){setSelected(tab);setQuick(false);requestAnimationFrame(()=>resourceRef.current?.scrollIntoView({block:"start",behavior:"smooth"}));}
  async function openNative(){
    if(nativeBusy||!data?.capabilities.native_panel||String(data.service_id)!==serviceId)return;
    setNativeBusy(true);setNativeError("");
    try{
      const result=await api.post<{url:string}>(
        `/services/opanel/${encodeURIComponent(serviceId)}/native-launch/`,{});
      const target=new URL(result.url);
      if(target.protocol!=="https:"||target.username||target.password||target.hash||
        !["2083","2222",""].includes(target.port))throw Error("Invalid panel URL");
      const anchor=document.createElement("a");anchor.href=target.toString();
      anchor.rel="noreferrer noopener";anchor.referrerPolicy="no-referrer";anchor.click();
    }catch{setNativeError("Secure supplier access is temporarily unavailable. Please retry or contact support.");}
    finally{setNativeBusy(false);}
  }

  useAutoSync(async(quiet)=>{
    const request=++requestId.current;
    if(!/^[1-9][0-9]{0,11}$/.test(serviceId)){
      setData(null);setError("This hosting service cannot be opened.");setLoading(false);return;
    }
    if(!quiet)setLoading(true);
    try{
      const result=await api.get<Overview>(
        `/services/opanel/${encodeURIComponent(serviceId)}/overview/`);
      if(request!==requestId.current)return;
      if(!result.readiness||!result.capabilities||String(result.service_id)!==serviceId||result.service_type!=="hosting")throw Error("Incomplete hosting status");
      setData(result);setError("");
    }catch{
      if(request!==requestId.current)return;
      setData(null);
      setError("We couldn't confirm this hosting service. Please try opening it again from My Hosting.");
    }finally{if(request===requestId.current)setLoading(false);}
  },serviceId);

  const launch=data&&(data.capabilities.panel_sso||data.capabilities.panel_recheck)?panelUrl(data.service_id):null;
  const usage=data?.usage;
  const current=data&&String(data.service_id)===serviceId?data:null;
  const site=website(current?.domain_name??null);
  const canPanel=Boolean(current?.capabilities.native_panel);
  const resourceAllowed=Boolean(current?.domain_name&&selected&&current.capabilities[selected]);
  const emailAllowed=Boolean(current?.domain_name&&current?.capabilities.mailbox_create&&current?.capabilities.email);
  return <DashboardShell role="client" title="Manage hosting" description="Your hosting account, tools and billing.">
    <DashboardPage eyebrow="My Services / Hosting" title={current?.domain_name||current?.label||"Manage hosting"}
      description={current?.label||"Your hosting account"}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href={`/client/services/${encodeURIComponent(serviceId)}`} className="text-sm font-medium text-console-primary">Back to service details</Link>
          {current&&<StatusBadge tone={current.active?"success":current.status==="active"?"warning":"neutral"}>{current.active?"Active":current.status==="active"?"Awaiting verification":current.status.replaceAll("_"," ")}</StatusBadge>}
        </div>
        {loading&&!current&&<p role="status" className="rounded-xl border border-console-line p-4 text-sm">Preparing your hosting details…</p>}
        {error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
        {current&&<div key={serviceId} className="space-y-4">
          <div className="grid min-w-0 gap-3 md:grid-cols-2">
            <Panel elevation="flat" className="space-y-3">
              <h2 className="text-sm font-semibold text-console-ink">Hosting package</h2>
              <div><p className="break-words text-lg font-semibold text-console-ink">{current.label}</p><p className="mt-1 text-xs text-console-muted">Web hosting · {current.domain_name||"Domain not connected"}</p></div>
              <div className="grid gap-2">
                {canPanel?<button type="button" onClick={()=>void openNative()} disabled={nativeBusy} className={primary}>{nativeBusy?"Opening…":"Open control panel"}<ExternalLink className="h-4 w-4"/></button>:
                 launch?<a href={launch} rel="noreferrer" className={primary}>Open OPanel<ExternalLink className="h-4 w-4"/></a>:<p className="text-xs text-console-muted">Control panel access is awaiting supplier verification.</p>}
                {site&&<a href={site} target="_blank" rel="noopener noreferrer" className={outline}>Visit website<ExternalLink className="h-4 w-4"/></a>}
              </div>
            </Panel>
            <Panel elevation="flat" className="space-y-3">
              <h2 className="text-sm font-semibold text-console-ink">Resource usage</h2>
              {usage?<><div className="grid grid-cols-2 gap-2">
                {[{label:"Disk",used:usage.disk_used_mb,limit:usage.disk_limit_mb,unlimited:usage.disk_unlimited},{label:"Bandwidth",used:usage.bandwidth_used_mb,limit:usage.bandwidth_limit_mb,unlimited:usage.bandwidth_unlimited}].map(item=><div key={item.label} className="flex min-w-0 flex-col items-center gap-1 text-center">
                  {item.unlimited?<span className="flex h-20 items-center text-lg font-medium text-console-ink">∞</span>:item.limit>0?<ServiceUsageRing label={item.label} used={item.used} limit={item.limit} compact/>:<span className="flex h-11 items-center text-xs text-console-muted">—</span>}
                  <span className="text-sm font-medium text-console-ink">{item.label}</span>
                  <span className="break-words text-xs text-console-muted">{item.used.toLocaleString("en-NG")} MB / {item.unlimited?"Unlimited":item.limit>0?item.limit.toLocaleString("en-NG")+" MB":"Unknown"}</span>
                </div>)}
              </div><p className="text-center text-[11px] text-console-muted">Last recorded {dateLabel(usage.recorded_at)} · not live</p></>:<p className="text-sm text-console-muted">Usage has not been recorded yet.</p>}
            </Panel>
          </div>
          {nativeError&&<p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{nativeError}</p>}
          <Panel elevation="flat">
            <h2 className="text-sm font-semibold text-console-ink">Quick shortcuts</h2>
            <div className="mt-3 grid grid-cols-3 gap-1 sm:grid-cols-4 lg:grid-cols-6">
              {tools.map(item=>{
                const native="native" in item?item.native as ResourceTab:null;
                const available=Boolean(native&&current.domain_name&&current.capabilities[native]);
                const domainLink=item.key==="dns"&&current.domain_id?"/client/domains/"+current.domain_id+"/dns":null;
                const Icon=item.icon;
                const content=<><span className="rounded-lg bg-blue-50 p-2.5 text-console-primary"><Icon className="h-5 w-5" aria-hidden="true"/></span><span className="break-words text-xs font-medium">{item.label}</span><span className="text-[10px] text-console-muted">{available?"Manage":domainLink?"Domain records":canPanel?"In control panel":"Unavailable"}</span></>;
                const cls="flex min-h-24 min-w-0 flex-col items-center justify-center gap-1 rounded-lg p-2 text-center text-console-ink hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-console-primary disabled:opacity-50";
                return domainLink?<Link className={cls} href={domainLink} key={item.key}>{content}</Link>:<button key={item.key} type="button" className={cls} disabled={!available&&(!canPanel||nativeBusy)} onClick={()=>{if(available&&native)choose(native);else if(canPanel)void openNative();}}>{content}</button>;
              })}
            </div>
            <p className="mt-3 text-xs text-console-muted">Advanced tools open your assigned supplier control panel. DNS records in a hosting panel may not be publicly authoritative.</p>
          </Panel>
          <div ref={resourceRef} className="scroll-mt-24">
            {resourceAllowed&&selected&&current.domain_name?<><div className="mb-2 flex flex-wrap justify-end gap-2">
              {canPanel&&<button type="button" onClick={()=>void openNative()} disabled={nativeBusy} className={outline}>Advanced management<ExternalLink className="h-4 w-4"/></button>}
              <button type="button" onClick={()=>setSelected(null)} className={outline}>Close tools</button>
            </div><NativeHostingResources key={serviceId+":"+selected} serviceId={serviceId} domain={current.domain_name} capabilities={current.capabilities} initialTab={selected}/></>:<Panel elevation="flat">
              <h2 className="text-sm font-semibold text-console-ink">Quick create email account</h2>
              {emailAllowed&&current.domain_name?<><p className="mt-1 text-xs text-console-muted">Create a mailbox on your assigned hosting server.</p>
                {quick?<><NativeHostingResources key={serviceId+":quick"} serviceId={serviceId} domain={current.domain_name} capabilities={current.capabilities} initialTab="email" quickOnly/><button type="button" onClick={()=>setQuick(false)} className="mt-2 text-xs font-medium text-console-primary">Close quick create</button></>:<button type="button" className={primary+" mt-3 w-full"} onClick={()=>setQuick(true)}>+ Create email account</button>}</>:canPanel?<button type="button" className={outline+" mt-3 w-full"} disabled={nativeBusy} onClick={()=>void openNative()}>Create email in control panel<ExternalLink className="h-4 w-4"/></button>:<p className="mt-2 text-xs text-console-muted">Available after your hosting account and permissions are verified.</p>}
            </Panel>}
          </div>
          <Panel elevation="flat">
            <h2 className="text-sm font-semibold text-console-ink">Billing overview</h2>
            <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-xs text-console-muted">Service amount</dt><dd className="mt-1 font-semibold">{money(current.billing?.amount,current.billing?.currency)}</dd></div>
              <div><dt className="text-xs text-console-muted">Billing cycle</dt><dd className="mt-1 font-medium">{cycles[current.billing?.cycle]||current.billing?.cycle||"Unavailable"}</dd></div>
              <div><dt className="text-xs text-console-muted">Registration date</dt><dd className="mt-1">{dateLabel(current.billing?.created_at)}</dd></div>
              <div><dt className="text-xs text-console-muted">Next due date</dt><dd className="mt-1">{dateLabel(current.next_due_date)}</dd></div>
            </dl>
            <div className="mt-4 grid gap-2 sm:grid-cols-2"><Link href={`/client/services/${encodeURIComponent(serviceId)}#renewal`} className={primary}>Renew hosting</Link><Link href="/client/invoices" className={outline}>View invoices</Link></div>
          </Panel>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
            <button type="button" disabled={(!current.capabilities.email||!current.capabilities.webmail_launch)&&!canPanel||nativeBusy} onClick={()=>current.capabilities.email&&current.capabilities.webmail_launch?choose("email"):void openNative()} className="inline-flex min-h-10 items-center gap-1 text-console-primary disabled:opacity-50"><Mail className="h-4 w-4"/>Webmail</button>
            <button type="button" disabled={!current.capabilities.credentials&&!canPanel||nativeBusy} onClick={()=>current.capabilities.credentials?choose("credentials"):void openNative()} className="inline-flex min-h-10 items-center gap-1 text-console-primary disabled:opacity-50"><KeyRound className="h-4 w-4"/>Change password</button>
            <Link href="/client/support/new" className="inline-flex min-h-10 items-center gap-1 text-console-primary"><Headphones className="h-4 w-4"/>Support</Link>
            <Link href={`/client/services/${encodeURIComponent(serviceId)}#cancellation`} className="text-rose-700">Request cancellation</Link>
          </div>
          <details className="rounded-xl border border-console-line p-3"><summary className="cursor-pointer text-sm font-medium text-console-muted">Website setup and verification details</summary><div className="mt-3"><HostingReadiness readiness={current.readiness}/></div></details>
        </div>}
      </div>
    </DashboardPage>
  </DashboardShell>;
}

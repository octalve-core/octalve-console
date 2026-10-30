"use client";
import {useEffect,useState} from "react";
import {ShieldCheck} from "lucide-react";
import {api} from "@/lib/api/client";
import {Panel} from "@/components/design-system/Panel";
import {ActionLink} from "@/components/design-system/ActionLink";
type Status={title:string;items:{name:string;description:string;state:string}[];note:string};
const destinations:Record<string,{href:string;label:string}[]>={
 security:[{href:"/admin/audit-logs",label:"Review audit logs"},{href:"/admin/staff",label:"Review team access"}],
 "social-login":[{href:"/admin/integrations",label:"Open Integration Store"}],
 "api-keys":[{href:"/admin/integrations",label:"Manage provider connections"}],
 providers:[{href:"/admin/integrations",label:"Open Integration Store"},{href:"/admin/servers",label:"View hosting suppliers"}],
 credits:[{href:"/admin/billing/transactions",label:"Review transactions"}],
 "cron-jobs":[{href:"/admin/billing/batch",label:"Review renewals"}],
 tickets:[{href:"/admin/support/departments",label:"View departments"},{href:"/admin/support/responses",label:"View saved responses"}],
 other:[{href:"/admin/audit-logs",label:"Review audit records"}],
};
export function OperationalSettingsStatus({section}:{section:string}){
 const [data,setData]=useState<Status|null>(null),[error,setError]=useState("");
 useEffect(()=>{let alive=true;setData(null);setError("");
  api.get<Status>("/settings/console-status/"+encodeURIComponent(section)+"/")
   .then(d=>{if(alive)setData(d);})
   .catch(()=>{if(alive)setError("Current configuration status could not be verified.");});
  return()=>{alive=false;};
 },[section]);
 return <><Panel className="min-w-0 xl:col-span-2">
  <div className="flex items-center gap-2"><ShieldCheck aria-hidden="true" className="h-5 w-5 text-console-primary"/>
   <h2 className="text-lg font-medium text-console-ink">{data?.title||"Connected operations"}</h2></div>
  {error?<p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>:null}
  {!data&&!error?<p role="status" className="mt-3 text-sm text-console-muted">Verifying available controls…</p>:null}
  {data?<ul className="mt-5 grid gap-3 sm:grid-cols-2">
   {data.items.map(item=><li key={item.name} className="rounded-xl border border-console-line bg-slate-50 p-4">
    <p className="text-sm font-medium text-console-ink">{item.name}</p>
    <p className="mt-2 text-xs leading-5 text-console-muted">{item.description}</p>
    <p className="mt-2 text-xs capitalize text-console-primary">{item.state.replace("_"," ")}</p>
   </li>)}
  </ul>:null}
 </Panel>
 <Panel className="h-fit min-w-0">
  <h3 className="text-base font-medium text-console-ink">Related management</h3>
  <div className="mt-4 space-y-3">{(destinations[section]||[]).map(d=><ActionLink key={d.href} href={d.href} variant="outline" className="w-full">{d.label}</ActionLink>)}</div>
  <p className="mt-4 text-xs leading-5 text-console-muted">Credentials remain protected in Integrations. Access and delivery controls are activated only after backend verification.</p>
 </Panel></>;
}

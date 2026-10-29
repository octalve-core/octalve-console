"use client";
import Link from "next/link";
import {ServerCog,Boxes,ShieldCheck,Clock3,RefreshCw,PlugZap,Info} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {StatusBadge} from "@/components/design-system/StatusBadge";
import type {Provider,Package} from "./catalogue-types";
const input="min-h-11 w-full rounded-xl border border-console-line bg-white px-3 py-2 text-sm text-console-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary";
const primary="inline-flex min-h-11 items-center gap-2 rounded-xl bg-console-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";
type Props={
 providers:Provider[];packages:Package[];providerId:string;setProviderId:(v:string)=>void;
 packageId:string;setPackageId:(v:string)=>void;
 costCurrency:string;setCostCurrency:(v:string)=>void;wholesale:string;setWholesale:(v:string)=>void;
 busy:boolean;onVerify:()=>void;onSync:()=>void;onApprove:()=>void;
};
export function CatalogSuppliersTab({providers,packages,providerId,setProviderId,packageId,setPackageId,costCurrency,setCostCurrency,wholesale,setWholesale,busy,onVerify,onSync,onApprove}:Props){
 const active=providers.find(p=>String(p.id)===providerId);
 const listed=packages.filter(p=>!providerId||String(p.provider)===providerId);
 const approved=packages.filter(p=>p.is_active).length;
 function choose(p:Package){
  setPackageId(String(p.id));setProviderId(String(p.provider));
  setCostCurrency(p.pricing?.currency||"NGN");
  setWholesale(Object.entries(p.pricing?.cycles||{}).map(([period,cost])=>`${period}=${cost}`).join("\n"));
 }
 return <div className="space-y-5">
  <div><h2 className="text-xl font-medium tracking-tight text-console-ink">Supplier connections & inventory</h2>
   <p className="mt-1 text-sm text-console-muted">Review real supplier records and technical capacity before preparing customer offers.</p></div>
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
   {([{label:"Connections",value:providers.length,icon:ServerCog},{label:"Imported packages",value:packages.length,icon:Boxes},{label:"Approved inventory",value:approved,icon:ShieldCheck},{label:"Awaiting review",value:packages.length-approved,icon:Clock3}] as const).map(item=><Panel key={item.label} className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-console-primary"><item.icon aria-hidden="true" className="h-5 w-5"/></span><div><p className="text-2xl font-medium text-console-ink">{item.value}</p><p className="text-xs text-console-muted">{item.label}</p></div></Panel>)}
  </div>
  <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
   <div className="min-w-0 space-y-5">
    <Panel><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-base font-medium text-console-ink">Provider connections</h3><p className="mt-1 text-xs text-console-muted">DirectAdmin/WHM capabilities are validated through the existing protected provider authority.</p></div><Link href="/admin/integrations" className={primary}><PlugZap className="h-4 w-4" aria-hidden="true"/>Manage integrations</Link></div>
     <div className="mt-5 space-y-2">
      <label className="text-xs font-medium text-console-muted" htmlFor="catalog-provider">Provider connection</label>
      <select id="catalog-provider" className={input} value={providerId} onChange={e=>{setProviderId(e.target.value);setPackageId("");}}><option value="">All providers</option>{providers.map(p=><option value={p.id} key={p.id}>{p.name} · {p.adapter_type} · {p.health_status}</option>)}</select>
      {active?<div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-console-muted"><StatusBadge tone={active.status==="active"&&active.health_status==="healthy"?"success":"warning"}>{active.health_status}</StatusBadge><span>{active.name} · {active.config?.fulfillment_model||"Model unverified"}</span></div>:null}
     </div>
     <div className="mt-5 flex flex-wrap gap-2"><button className={primary} type="button" disabled={!active||busy} onClick={onVerify}><ShieldCheck className="h-4 w-4" aria-hidden="true"/>Verify connection</button><button className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-console-line px-4 py-2 text-sm font-medium disabled:opacity-50" type="button" disabled={!active||busy} onClick={onSync}><RefreshCw className="h-4 w-4" aria-hidden="true"/>Sync inventory</button></div>
    </Panel>
    <Panel><h3 className="text-base font-medium text-console-ink">Imported hosting packages</h3><p className="mt-1 text-xs text-console-muted">Wholesale costs and provider identities are private Admin records.</p>
     <div className="mt-4 overflow-x-auto rounded-xl border border-console-line"><table className="w-full min-w-[540px] text-left text-sm"><thead className="bg-slate-50 text-xs text-console-muted"><tr><th className="px-4 py-3">Package</th><th className="px-4 py-3">Provider</th><th className="px-4 py-3">Approval</th><th className="px-4 py-3">Action</th></tr></thead><tbody>{listed.map(p=><tr key={p.id} className="border-t border-console-line"><td className="px-4 py-3 font-medium">{p.name}<p className="mt-1 max-w-xs break-words text-xs font-normal text-console-muted">{Object.entries(p.specs||{}).slice(0,4).map(([k,v])=>`${k}: ${v}`).join(" · ")||"No supplier specifications"}</p></td><td className="px-4 py-3">{p.provider_name}</td><td className="px-4 py-3"><StatusBadge tone={p.is_active?"success":"warning"}>{p.is_active?"Approved":"Pending"}</StatusBadge></td><td className="px-4 py-3"><button type="button" className="font-medium text-console-primary underline-offset-2 hover:underline" onClick={()=>choose(p)}>Review</button></td></tr>)}{!listed.length?<tr><td colSpan={4} className="px-4 py-9 text-center text-console-muted">No imported packages. A verified provider must return inventory first.</td></tr>:null}</tbody></table></div>
    </Panel>
   </div>
   <div className="min-w-0 space-y-5">
    <Panel><h3 className="text-base font-medium text-console-ink">Approve supplier inventory</h3><p className="mt-1 text-xs text-console-muted">Confirm each imported package and wholesale rate against independent evidence.</p>
     <div className="mt-5 space-y-4">
      <label className="block text-xs font-medium text-console-muted" htmlFor="cost-package">Supplier package<select id="cost-package" className={input+" mt-2"} value={packageId} onChange={e=>{const p=packages.find(x=>String(x.id)===e.target.value);if(p)choose(p);else setPackageId("");}}><option value="">Select imported package</option>{listed.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="block text-xs font-medium text-console-muted" htmlFor="cost-currency">Supplier currency<input id="cost-currency" className={input+" mt-2"} value={costCurrency} maxLength={3} onChange={e=>setCostCurrency(e.target.value.toUpperCase())}/></label>
      <label className="block text-xs font-medium text-console-muted" htmlFor="cost-cycles">Wholesale costs by billing period<textarea id="cost-cycles" className={input+" mt-2 min-h-32 font-mono"} rows={5} value={wholesale} onChange={e=>setWholesale(e.target.value)} placeholder={"1mo=1500\n12mo=15000"}/></label>
      <button type="button" disabled={!packageId||busy} onClick={onApprove} className={primary}>Approve inventory</button>
     </div>
     <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-console-muted"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true"/>For owned servers, do not invent supplier purchase prices. Partner resale requires evidence for every enabled billing period.</p>
    </Panel>
    <Panel><h3 className="text-base font-medium text-console-ink">Connection security</h3><ul className="mt-4 space-y-3 text-sm text-console-muted">{["Credentials remain encrypted and server-side","Outbound provider calls use the reviewed allowlist and connection authority","Publication is refused without accepted supplier specifications and pricing evidence"].map(item=><li className="flex items-start gap-2" key={item}><ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-console-primary"/>{item}</li>)}</ul></Panel>
   </div>
  </div>
 </div>;
}

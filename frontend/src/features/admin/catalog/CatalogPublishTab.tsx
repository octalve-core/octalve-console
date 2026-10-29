"use client";
import {BadgeCheck,Clock3,FileCheck2,ShieldCheck,Eye} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {StatusBadge} from "@/components/design-system/StatusBadge";
import type {Draft} from "./catalogue-types";
type Props={drafts:Draft[];busy:boolean;onPublish:(id:number)=>void;onEdit:()=>void};
export function CatalogPublishTab({drafts,busy,onPublish,onEdit}:Props){
 const published=drafts.filter(d=>d.status==="published").length;
 const unpublished=drafts.filter(d=>d.status==="draft").length;
 return <div className="space-y-5">
  <div><h2 className="text-xl font-medium tracking-tight text-console-ink">Review & publish</h2><p className="mt-1 text-sm text-console-muted">Only individually reviewed, server-qualified offers can become available to customers.</p></div>
  <div className="grid gap-3 sm:grid-cols-3">{[{name:"Total records",value:drafts.length,icon:FileCheck2},{name:"Unpublished drafts",value:unpublished,icon:Clock3},{name:"Published records",value:published,icon:BadgeCheck}].map(item=><Panel key={item.name} className="flex items-center gap-3"><item.icon aria-hidden="true" className="h-6 w-6 text-console-primary"/><div><p className="text-2xl font-medium text-console-ink">{item.value}</p><p className="text-xs text-console-muted">{item.name}</p></div></Panel>)}</div>
  <Panel className="border-blue-200 bg-blue-50/60"><h3 className="flex items-center gap-2 text-base font-medium text-console-ink"><ShieldCheck className="h-5 w-5 text-console-primary" aria-hidden="true"/>Publication qualification</h3><p className="mt-2 text-sm leading-6 text-console-muted">The Django publication endpoint independently verifies supplier connection health, exact approved inventory, technical capabilities, currency, per-cycle costs and a versioned retail snapshot. This page does not override a failing gate.</p></Panel>
  <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
   <Panel><div className="flex flex-wrap justify-between gap-3"><div><h3 className="text-base font-medium text-console-ink">Offer drafts and publication history</h3><p className="mt-1 text-xs text-console-muted">Real database records; published revisions are immutable.</p></div><button type="button" onClick={onEdit} className="rounded-xl border border-console-line px-4 py-2 text-xs font-medium">Edit plan</button></div>
    <div className="mt-4 overflow-x-auto rounded-xl border border-console-line"><table className="min-w-[600px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-console-muted"><tr><th className="p-3">Offer</th><th className="p-3">Product</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead><tbody>{drafts.map(d=><tr className="border-t border-console-line" key={d.id}><td className="p-3"><span className="font-medium">{d.payload?.name||"Untitled draft"}</span><span className="block text-xs text-console-muted">{d.supplier_package} · {d.provider}</span></td><td className="p-3">{d.product_name}</td><td className="p-3"><StatusBadge tone={d.status==="published"?"success":"warning"}>{d.status}</StatusBadge></td><td className="p-3">{d.status==="draft"?<button type="button" disabled={busy} className="min-h-10 rounded-lg bg-console-primary px-3 py-2 text-xs font-medium text-white disabled:opacity-50" onClick={()=>onPublish(d.id)}>Review & publish</button>:<span className="text-xs text-console-muted">Immutable</span>}</td></tr>)}{!drafts.length?<tr><td colSpan={4} className="p-10 text-center text-console-muted">No drafts yet. Create a plan offer before requesting publication.</td></tr>:null}</tbody></table></div>
   </Panel>
   <div className="space-y-5"><Panel><h3 className="flex items-center gap-2 text-base font-medium"><Eye aria-hidden="true" className="h-5 w-5 text-console-primary"/>Customer disclosure</h3><p className="mt-3 text-sm leading-6 text-console-muted">Only approved retail prices and accurate plan features are visible publicly. Supplier costs, provider account IDs and credentials stay private.</p></Panel>
    <Panel><h3 className="text-base font-medium">Commercial boundaries</h3><ul className="mt-4 space-y-3 text-sm text-console-muted">{["Publishing is not payment","Creating an invoice is not verified settlement","Payment is not proof of hosting provisioning"].map(t=><li key={t} className="flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-console-primary" aria-hidden="true"/>{t}</li>)}</ul></Panel>
   </div>
  </div>
 </div>;
}

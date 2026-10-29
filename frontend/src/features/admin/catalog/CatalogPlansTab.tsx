"use client";
import {CheckCircle2,Plus,Trash2,ShieldCheck,Package,Info} from "lucide-react";
import type {ReactNode} from "react";
import {Panel} from "@/components/design-system/Panel";
import {StatusBadge} from "@/components/design-system/StatusBadge";
import type {Cycle,Plan,Product,Package as SupplierPackage} from "./catalogue-types";
import {periods} from "./catalogue-types";
const field="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-console-line bg-white px-3 py-2 text-sm text-console-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary";
const primary="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-console-primary px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50";
type Props={
 products:Product[];plans:Plan[];packages:SupplierPackage[];
 revisionPlan:string;onRevision:(id:string)=>void;selectedProduct:string;setSelectedProduct:(v:string)=>void;
 packageId:string;setPackageId:(v:string)=>void;name:string;setName:(v:string)=>void;
 slug:string;setSlug:(v:string)=>void;description:string;setDescription:(v:string)=>void;
 currency:string;setCurrency:(v:string)=>void;popular:boolean;setPopular:(v:boolean)=>void;
 features:string;setFeatures:(v:string)=>void;cycles:Cycle[];
 onCycle:(index:number,key:keyof Cycle,value:string|boolean)=>void;onDefault:(index:number)=>void;
 onRemove:(index:number)=>void;onAdd:()=>void;busy:boolean;onSave:()=>void;
};
function Field({label,children}:{label:string;children:ReactNode}){
 return <label className="block min-w-0 text-xs font-medium text-console-muted">{label}{children}</label>;
}
export function CatalogPlansTab(p:Props){
 const selected=p.packages.find(x=>String(x.id)===p.packageId);
 const preview=p.features.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
 const availableKeys=periods.filter(item=>!p.cycles.some(c=>c.cycle_key===item.key));
 return <div className="space-y-5">
  <div><h2 className="text-xl font-medium tracking-tight text-console-ink">Build a hosting plan</h2>
   <p className="mt-1 text-sm text-console-muted">Prepare an unpublished offer with a validated supplier package, clear features and reviewed recurring prices.</p>
  </div>
  <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,1fr)]">
   <div className="min-w-0 space-y-5">
    <Panel>
     <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="flex items-center gap-2 text-base font-medium text-console-ink"><Package aria-hidden="true" className="h-5 w-5 text-console-primary"/>Plan identity & supplier mapping</h3><p className="mt-1 text-xs text-console-muted">Customer identity stays separate from supplier fulfilment settings.</p></div><StatusBadge tone="warning">Unpublished editing</StatusBadge></div>
     <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <Field label="Revise published plan"><select className={field} value={p.revisionPlan} onChange={e=>p.onRevision(e.target.value)}><option value="">Create new plan</option>{p.plans.map(plan=><option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></Field>
      <Field label="Octalve product"><select className={field} value={p.selectedProduct} onChange={e=>p.setSelectedProduct(e.target.value)}><option value="">Choose product</option>{p.products.map(product=><option key={product.id} value={product.id}>{product.name} · {product.status}</option>)}</select></Field>
      <Field label="Approved supplier inventory"><select className={field} value={p.packageId} onChange={e=>p.setPackageId(e.target.value)}><option value="">Select approved supplier package</option>{p.packages.filter(item=>item.is_active).map(item=><option key={item.id} value={item.id}>{item.provider_name} · {item.name}</option>)}</select></Field>
      <Field label="Retail plan name"><input className={field} value={p.name} onChange={e=>p.setName(e.target.value)} maxLength={100} placeholder="Octalve Business"/></Field>
      <Field label="Public plan URL slug"><input className={field} value={p.slug} onChange={e=>p.setSlug(e.target.value.toLowerCase())} maxLength={100} placeholder="octalve-business" pattern="[a-z0-9]+(-[a-z0-9]+)*" disabled={Boolean(p.revisionPlan)}/></Field>
      <Field label="Retail currency"><input className={field} value={p.currency} onChange={e=>p.setCurrency(e.target.value.toUpperCase())} maxLength={3} placeholder="NGN"/></Field>
      <div className="sm:col-span-2"><Field label="Short marketing description"><textarea className={field+" min-h-24"} value={p.description} onChange={e=>p.setDescription(e.target.value)} rows={3} maxLength={2000} placeholder="A concise summary shown on public plan cards."/></Field></div>
      <label className="inline-flex items-center gap-2 text-sm text-console-muted sm:col-span-2"><input type="checkbox" className="h-4 w-4 accent-blue-600" checked={p.popular} onChange={e=>p.setPopular(e.target.checked)}/>Featured plan</label>
     </div>
     {selected?<p className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-console-muted">Selected supplier: {selected.provider_name} · {selected.name}. Resource claims are rechecked by Django at publication.</p>:null}
    </Panel>
    <Panel><h3 className="text-base font-medium text-console-ink">Included features & plan specifications</h3><p className="mt-1 text-xs leading-5 text-console-muted">Press Enter for a new customer-facing bullet. Use <strong>Label: value</strong> for verified technical quantities such as Storage: 20 GB. Never claim unverified resources or capabilities.</p>
     <Field label="Features (one per line)"><textarea className={field+" min-h-36"} rows={6} value={p.features} onChange={e=>p.setFeatures(e.target.value)} placeholder={"Storage: [verified amount]\nBandwidth: [verified amount]\nCustomer support"}/></Field>
     <div className="mt-4 rounded-xl border border-console-line bg-slate-50 p-4"><h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-console-muted">Customer feature preview</h4>{preview.length?<ul className="space-y-2">{preview.map((item,index)=><li key={index} className="flex items-start gap-2 text-sm text-console-muted"><CheckCircle2 aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-emerald-600"/><span>{item}</span></li>)}</ul>:<p className="text-xs text-console-muted">No features entered yet.</p>}</div>
     <p className="mt-3 flex items-start gap-2 text-xs text-console-muted"><ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-console-primary"/>Supplier limits are validated again on the server when publishing; this preview does not certify them.</p>
    </Panel>
   </div>
   <div className="min-w-0 space-y-5">
    <Panel><h3 className="text-base font-medium text-console-ink">Billing cycles & retail pricing</h3><p className="mt-1 text-xs text-console-muted">Use approved commercial terms. Client charges are calculated by Django, not this form.</p>
     <div className="mt-4 space-y-3">{p.cycles.map((cycle,index)=><fieldset key={index} className="min-w-0 rounded-xl border border-console-line p-4"><legend className="px-2 text-xs font-medium text-console-muted">Billing offer {index+1}</legend>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Period"><select className={field} value={cycle.cycle_key} onChange={e=>p.onCycle(index,"cycle_key",e.target.value)}>{periods.map(item=><option key={item.key} value={item.key}>{item.label}</option>)}</select></Field>
       <Field label="Retail price"><input inputMode="decimal" className={field} value={cycle.price} onChange={e=>p.onCycle(index,"price",e.target.value)} placeholder="0.00"/></Field>
       <Field label="Setup fee"><input inputMode="decimal" className={field} value={cycle.setup_fee} onChange={e=>p.onCycle(index,"setup_fee",e.target.value)} placeholder="0.00"/></Field>
       <Field label="Regular price (optional)"><input inputMode="decimal" className={field} value={cycle.regular_price} onChange={e=>p.onCycle(index,"regular_price",e.target.value)} placeholder="0.00"/></Field>
      </div><div className="mt-3 flex items-center justify-between gap-2"><label className="inline-flex items-center gap-2 text-xs text-console-muted"><input type="radio" name="default-catalog-cycle" checked={cycle.is_default} onChange={()=>p.onDefault(index)}/>Default period</label><button type="button" disabled={p.cycles.length===1} onClick={()=>p.onRemove(index)} className="inline-flex items-center gap-1 text-xs font-medium text-rose-700 disabled:opacity-50"><Trash2 aria-hidden="true" className="h-3.5 w-3.5"/>Remove</button></div>
     </fieldset>)}</div>
     <button type="button" disabled={!availableKeys.length} onClick={p.onAdd} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-console-line px-4 py-2 text-xs font-medium disabled:opacity-50"><Plus className="h-4 w-4" aria-hidden="true"/>Add billing period</button>
    </Panel>
    <Panel><h3 className="text-base font-medium text-console-ink">Save commercial draft</h3><p className="mt-2 text-sm leading-6 text-console-muted">Saving records the proposed offer privately. Publication requires independent supplier, resource, cost and revision approval.</p>
     <button type="button" onClick={p.onSave} disabled={p.busy} className={primary+" mt-5 w-full"}>Save unpublished draft</button>
     <p className="mt-3 flex items-start gap-2 text-xs text-console-muted"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true"/>Drafts cannot take payments or provision hosting.</p>
    </Panel>
   </div>
  </div>
 </div>;
}

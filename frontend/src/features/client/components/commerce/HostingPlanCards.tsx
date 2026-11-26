"use client";
import {useState} from "react";
import Link from "next/link";
import {PublishedPackageCard} from "@/components/shared-commerce/PublishedPackageCard";
import {WorkspaceGrid} from "@/components/design-system/WorkspaceGrid";
import {StatusBadge} from "@/components/design-system/StatusBadge";
import {AddToCartButton} from "../../checkout/AddToCartButton";
import {defaultCycle,formatPlanAmount,type ClientOrderPlan} from "../../data/client-order-data";

export function HostingPlanCards({plans,selectedId,selectedCycle,forDomain}:{plans:readonly ClientOrderPlan[];selectedId:string;selectedCycle:string;forDomain?:string}){
 const [cycles,setCycles]=useState<Record<string,string>>({});
 const domain=forDomain&&/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(forDomain)?forDomain:undefined;
 return <WorkspaceGrid variant="planCards" as="section" ariaLabel="Available published service plans">
 {plans.map(plan=>{
  const pricing=plan.cycles.find(c=>c.key===(cycles[plan.id]??(plan.id===selectedId?selectedCycle:"")))||defaultCycle(plan);
  return <PublishedPackageCard key={plan.id} selected={plan.id===selectedId} name={plan.name} description={plan.description} features={plan.features}
   price={pricing?formatPlanAmount(pricing.price,plan.currency):"Price unavailable"} period={pricing?.label}
   badge={plan.popular?<StatusBadge tone="info">Popular</StatusBadge>:undefined}
   action={<>{pricing&&pricing.setupFee>0&&<p className="mb-2 text-xs text-slate-600">Setup {formatPlanAmount(pricing.setupFee,plan.currency)}</p>}
   {pricing&&<label className="block text-xs font-medium text-slate-700">Billing period<select aria-label={"Billing period for "+plan.name} value={pricing.key} onChange={e=>setCycles(old=>({...old,[plan.id]:e.target.value}))} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">{plan.cycles.map(c=><option key={c.key} value={c.key}>{c.label}</option>)}</select></label>}
   {plan.canOrder&&pricing&&plan.revision!==null?<AddToCartButton key={plan.id+":"+pricing.key+":"+plan.revision} className="mt-3" item={{kind:"service",plan:plan.id,cycle:pricing.key,revision:plan.revision,domain}}/>:<Link href={"/client/support/new?product="+encodeURIComponent(plan.id)} className="mt-3 flex min-h-11 items-center justify-center rounded-xl bg-blue-50 px-4 text-sm font-medium text-[#0064E0]">Ask about this plan</Link>}</>}/>;
 })}
 </WorkspaceGrid>
}

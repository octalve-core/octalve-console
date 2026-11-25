import Link from "next/link";
import {PublishedPackageCard} from "@/components/data/PublishedPackageCard";
import {WorkspaceGrid} from "@/components/design-system/WorkspaceGrid";
import {StatusBadge} from "@/components/design-system/StatusBadge";
import {defaultCycle,formatPlanAmount,type ClientOrderPlan} from "../../data/client-order-data";

export function HostingPlanCards({plans,selectedId,onSelect}:{
 plans:readonly ClientOrderPlan[];selectedId:string;onSelect:(plan:ClientOrderPlan)=>void;
}){
 return <WorkspaceGrid variant="planCards" as="section" ariaLabel="Available published service plans">
  {plans.map(plan=>{
   const selected=plan.id===selectedId, pricing=defaultCycle(plan);
   return <PublishedPackageCard key={plan.id} selected={selected} name={plan.name}
    description={plan.description} features={plan.features}
    price={pricing?formatPlanAmount(pricing.price,plan.currency):"—"}
    period={pricing?pricing.label+(pricing.setupFee?" + setup fee":""):undefined}
    badge={plan.popular?<StatusBadge tone="info">Popular</StatusBadge>:undefined}
    action={plan.canOrder?<button type="button" aria-pressed={selected} onClick={()=>onSelect(plan)}
      className="min-h-11 w-full rounded-full bg-console-primary px-4 text-sm font-medium text-white focus-visible:ring-2 focus-visible:ring-console-primary focus-visible:ring-offset-2">
      {selected?"Selected":"Choose plan"}
    </button>:<Link href={`/client/support/new?product=${encodeURIComponent(plan.id)}`} className="flex min-h-11 items-center justify-center rounded-full bg-blue-50 px-4 text-sm font-medium text-console-primary focus-visible:ring-2 focus-visible:ring-console-primary">Ask about this plan</Link>}/>;
  })}
 </WorkspaceGrid>;
}

import {CheckCircle2,ShoppingCart} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {WorkspaceGrid} from "@/components/design-system/WorkspaceGrid";
import {StatusBadge} from "@/components/design-system/StatusBadge";
import {defaultCycle,formatPlanAmount,type ClientOrderPlan} from "../../data/client-order-data";

export function HostingPlanCards({plans,selectedId,onSelect}:{
 plans:readonly ClientOrderPlan[];selectedId:string;onSelect:(plan:ClientOrderPlan)=>void;
}){
 return <WorkspaceGrid variant="planCards" as="section" ariaLabel="Available published hosting plans">
  {plans.map(plan=>{
   const selected=plan.id===selectedId,pricing=defaultCycle(plan);
   return <button key={plan.id} type="button" aria-pressed={selected} onClick={()=>onSelect(plan)}
    className="min-w-0 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary focus-visible:ring-offset-2">
    <Panel className={selected?"h-full border-console-primary ring-2 ring-blue-100":"h-full transition-colors hover:border-blue-200"}>
     <div className="flex items-center justify-between gap-3">
      <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-console-primary">
       <ShoppingCart className="h-5 w-5"/>
      </span>{plan.popular?<StatusBadge tone="info">Popular</StatusBadge>:null}
     </div>
     <h2 className="mt-5 text-lg font-medium text-console-ink">{plan.name}</h2>
     <p className="mt-2 text-sm leading-6 text-console-muted">{plan.description}</p>
     <p className="mt-5 break-words text-2xl font-medium text-console-ink">
      {pricing?formatPlanAmount(pricing.price,plan.currency):"—"}
     </p>
     <p className="mt-1 text-xs text-console-muted">{pricing?.label}{pricing?.setupFee?" + setup fee":""}</p>
     <ul className="mt-5 space-y-2">{plan.features.map((feature,index)=>
      <li key={index} className="flex items-start gap-2 text-sm text-console-muted">
       <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-console-primary"/>
       <span>{feature}</span>
      </li>)}
     </ul>
    </Panel>
   </button>;
  })}
 </WorkspaceGrid>;
}

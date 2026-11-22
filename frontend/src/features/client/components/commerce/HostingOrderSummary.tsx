import {Panel} from "@/components/design-system/Panel";
import {AddToCartButton} from "../../checkout/AddToCartButton";
import {defaultCycle,formatPlanAmount,type ClientOrderPlan} from "../../data/client-order-data";

export function HostingOrderSummary({plan,cycleKey,onCycleChange}:{
 plan:ClientOrderPlan|undefined;cycleKey:string;onCycleChange:(key:string)=>void;
}){
 const cycle=plan?.cycles.find(c=>c.key===cycleKey)||defaultCycle(plan);
 return <Panel className="h-fit lg:sticky lg:top-24">
  <h2 className="text-lg font-medium text-console-ink">Order summary</h2>
  <p className="mt-3 text-sm text-console-muted">{plan?.name??"Choose a hosting plan"}</p>
  {plan?<><h3 className="mt-5 text-sm font-medium text-console-ink">Billing period</h3>
   <div role="group" aria-label="Billing period" className="mt-3 grid grid-cols-2 gap-2">
    {plan.cycles.map(item=><button key={item.key} type="button" aria-pressed={cycle?.key===item.key}
     onClick={()=>onCycleChange(item.key)}
     className={cycle?.key===item.key?
      "min-h-12 rounded-xl border border-console-primary bg-blue-50 px-3 py-2 text-sm font-medium text-console-primary focus-visible:ring-2 focus-visible:ring-console-primary":
      "min-h-12 rounded-xl border border-console-line bg-white px-3 py-2 text-sm text-console-muted hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-console-primary"}>
      {item.label}
    </button>)}
   </div>
   <dl className="mt-5 space-y-3 text-sm">
    <div className="flex justify-between gap-3"><dt className="text-console-muted">Plan</dt>
     <dd className="text-right font-medium">{formatPlanAmount(cycle?.price??0,plan.currency)}</dd></div>
    <div className="flex justify-between gap-3"><dt className="text-console-muted">Setup fee</dt>
     <dd className="text-right font-medium">{formatPlanAmount(cycle?.setupFee??0,plan.currency)}</dd></div>
    <div className="flex justify-between gap-3 border-t border-console-line pt-3 font-medium">
     <dt>Estimated total</dt>
     <dd className="text-right">{formatPlanAmount((cycle?.price??0)+(cycle?.setupFee??0),plan.currency)}</dd>
    </div>
   </dl>
   {cycle&&plan.revision!==null?<AddToCartButton key={`${plan.id}:${cycle.key}:${plan.revision}`} className="mt-6"
    item={{kind:"service",plan:plan.id,cycle:cycle.key,revision:plan.revision}}/>:null}
  </>:null}
  <p className="mt-4 text-xs leading-5 text-console-muted">Review your order before checkout. You won’t be charged on this page.</p>
 </Panel>;
}

import {Info,ShoppingCart} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {formatPlanAmount,type ClientOrderPlan} from "../../data/client-order-data";
import type {CheckoutQuote} from "@/lib/api/endpoints";

export function CheckoutQuoteSummary({plan,cycleKey,quote,coupon,stage,onCouponChange,onChangeRequest}:{
 plan:ClientOrderPlan;cycleKey:string;quote:CheckoutQuote|null;coupon:string;stage:"domain"|"review";
 onCouponChange:(value:string)=>void;onChangeRequest:()=>void;
}){
 const cycle=plan.cycles.find(item=>item.key===cycleKey);
 if(!cycle)return null;
 const currency=quote?.currency??plan.currency;
 const amount=quote?Number(quote.total):cycle.price+cycle.setupFee;
 return <Panel className="h-fit lg:sticky lg:top-24">
  <h2 className="flex items-center gap-2 text-lg font-semibold text-console-ink">
   <ShoppingCart aria-hidden="true" className="h-5 w-5 text-console-primary"/>Order summary
  </h2>
  <p className="mt-4 text-sm font-semibold text-console-ink">{plan.name}</p>
  <p className="mt-1 text-xs text-console-muted">{cycle.label}</p>
  <dl className="mt-6 space-y-3 text-sm">
   <div className="flex justify-between gap-3"><dt className="text-console-muted">Hosting</dt><dd>{formatPlanAmount(cycle.price,plan.currency)}</dd></div>
   <div className="flex justify-between gap-3"><dt className="text-console-muted">Setup</dt><dd>{formatPlanAmount(cycle.setupFee,plan.currency)}</dd></div>
   {quote&&Number(quote.discount_total)>0?<div className="flex justify-between gap-3">
    <dt className="text-console-muted">Promo discount</dt>
    <dd>-{formatPlanAmount(Number(quote.discount_total),currency)}</dd></div>:null}
   <div className="flex justify-between gap-3 border-t border-console-line pt-3 text-base font-semibold">
    <dt>{quote?"Confirmed quote":"Estimated total"}</dt><dd>{formatPlanAmount(amount,currency)}</dd>
   </div>
  </dl>
  <label htmlFor="checkout-promo" className="mt-7 block text-sm font-semibold text-console-ink">Promo code (optional)</label>
  <div className="mt-2 flex min-w-0 gap-2">
   <input id="checkout-promo" value={coupon} disabled={stage==="review"} maxLength={50}
    onChange={event=>onCouponChange(event.target.value)} placeholder="Enter code"
    className="h-12 min-w-0 flex-1 rounded-xl border border-console-line bg-white px-3 text-base text-console-ink focus:border-console-primary focus:outline-none focus:ring-2 focus:ring-blue-100"/>
   {stage==="review"?<button type="button" onClick={onChangeRequest}
    className="rounded-xl px-2 text-sm font-semibold text-console-primary">Change</button>:null}
  </div>
  <p className="mt-5 flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900">
   <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0"/>
   We calculate final prices on the server. A domain registration is not included.
  </p>
 </Panel>;
}

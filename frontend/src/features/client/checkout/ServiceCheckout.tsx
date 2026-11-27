"use client";

import {useEffect,useMemo,useRef,useState,type FormEvent} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {invoiceCheckoutHref} from "../components/commerce/invoice-links";
import {ArrowLeft,ArrowRight,Loader2,ShieldCheck} from "lucide-react";
import {OrderConfirmation,CommercePanel,CommerceCheckoutFrame,CheckoutColumns,primary} from "@/components/shared-commerce/CommerceUI";
import {Panel} from "@/components/design-system/Panel";
import {ServiceDomainChoice,type DomainChoice} from "./ui/ServiceDomainChoice";
import {CheckoutQuoteSummary} from "../components/commerce/CheckoutQuoteSummary";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {authApi,clientApi,type AccountProfile,type CheckoutQuote} from "@/lib/api/endpoints";
import {loadSellablePlans,formatPlanAmount,type ClientOrderPlan} from "../data/client-order-data";
import {cartSelectionId, removeFromCart} from "./cart-selections";

type Stage="domain"|"review"|"completed";
type Confirmation={id?:number;order_number?:string;total?:string;currency?:string;
  invoice?:{id:number;invoice_number:string;status:string;amount_due:string}};
const domainPattern=/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/;
const actionClass=primary+" w-full sm:w-auto";

export function ServiceCheckout(){
  const router=useRouter();
  const submitting=useRef(false);
  const [plans,setPlans]=useState<ClientOrderPlan[]>([]);
  const [account,setAccount]=useState<AccountProfile|null>(null);
  const [planId,setPlanId]=useState("");
  const [cycleKey,setCycleKey]=useState("");
  const [checkoutId,setCheckoutId]=useState("");
  const [stage,setStage]=useState<Stage>("domain");
  const [domainChoice,setDomainChoice]=useState<DomainChoice>("later");
  const [domain,setDomain]=useState("");
  const [coupon,setCoupon]=useState("");
  const [quote,setQuote]=useState<CheckoutQuote|null>(null);
  const [agreed,setAgreed]=useState(false);
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");
  const [confirmation,setConfirmation]=useState<Confirmation|null>(null);

  useEffect(()=>{
    let active=true;
    const query=new URLSearchParams(window.location.search);
    const requestedPlan=query.get("plan")||"";
    const requestedCycle=query.get("cycle")||"";
    const requestedRevision=query.get("revision")||"";
    const requestedDomain=query.get("forDomain") ?? "";
    if(domainPattern.test(requestedDomain)){setDomain(requestedDomain);setDomainChoice("existing");}
    // The stable checkout key is resolved against the exact cart selection
    // before requesting a quote. Do not bind a new cart to an older key.
    setCheckoutId(crypto.randomUUID());
    void authApi.profile().then(data=>{if(active)setAccount(data);}).catch(()=>{});
    void loadSellablePlans().then(items=>{
      if(!active)return;
      setPlans(items);
      const selected=items.find(item=>item.id===requestedPlan);
      const cycle=selected?.cycles.find(item=>item.key===requestedCycle);
      if(!selected||!cycle){setError("The chosen package is unavailable. Return to plans and choose an available offer.");return;}
      if(requestedRevision && (!/^[1-9][0-9]*$/.test(requestedRevision)||selected.revision!==Number(requestedRevision))){
        setError("This published offer has changed. Please select the plan again and review its current price.");return;
      }
      setPlanId(selected.id);setCycleKey(cycle.key);
    }).catch(()=>{if(active)setError("We couldn't load your chosen package. No order was placed.");})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[]);

  const selected=useMemo(()=>plans.find(item=>item.id===planId),[plans,planId]);
  const cycle=selected?.cycles.find(item=>item.key===cycleKey);
  const normalizedDomain=domain.trim().toLowerCase().replace(/\.$/,"");
  const selectedDomain=domainChoice==="existing"?normalizedDomain:"";
  const validDomain=domainChoice==="later"||
    (domainChoice==="existing"&&domainPattern.test(normalizedDomain));
  const canReview=!!selected&&!!cycle&&!!checkoutId&&validDomain&&!working;
  const amount=quote?Number(quote.total):(cycle?.price||0)+(cycle?.setupFee||0);
  const currency=quote?.currency||selected?.currency||"NGN";
  const checkoutPayload=(key=checkoutId)=>({
    checkout_id:key,
    items:[{plan_id:Number(selected?.id),offer_revision:selected?.revision??undefined,
      cycle_key:cycleKey,quantity:1,domain_name:selectedDomain}],
    ...(coupon.trim()?{coupon_code:coupon.trim().toUpperCase()}:{})
  });

  function checkoutKeyForSelection(){
    const fingerprint=JSON.stringify([
      planId,cycleKey,domainChoice,selectedDomain,coupon.trim().toUpperCase()
    ]);
    const storageKey="octalve-cloud-active-hosting-checkout";
    try{
      const raw=sessionStorage.getItem(storageKey);
      const previous=raw?JSON.parse(raw) as {fingerprint?:string;id?:string}:null;
      if(previous?.fingerprint===fingerprint&&previous.id&&
        /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(previous.id)){
        setCheckoutId(previous.id);
        return previous.id;
      }
      const id=crypto.randomUUID();
      sessionStorage.setItem(storageKey,JSON.stringify({fingerprint,id}));
      setCheckoutId(id);
      return id;
    }catch{
      const id=crypto.randomUUID();setCheckoutId(id);return id;
    }
  }

  async function review(){
    if(!canReview)return;
    setWorking(true);setError("");setQuote(null);
    try{
      const stableKey=checkoutKeyForSelection();
      const result=await clientApi.quoteOrder(checkoutPayload(stableKey));
      if(!result.items?.length||!Number.isFinite(Number(result.total))||
         result.currency!==selected?.currency||Number(result.total)<=0)throw Error("Invalid quote");
      setQuote(result);setStage("review");
    }catch{setError("We couldn't confirm the current price or promo code. Check your selection before continuing.");}
    finally{setWorking(false);}
  }

  async function placeOrder(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!quote||!agreed||working||!canReview||confirmation||submitting.current)return;
    submitting.current=true;
    setWorking(true);setError("");
    try{
      const result=await clientApi.createOrder(checkoutPayload()) as unknown as Confirmation;
      if(!result.order_number||!result.invoice?.id||!result.invoice.invoice_number){
        setError("Your order needs confirmation. Check Orders before retrying with the same checkout reference.");
        return;
      }
      setConfirmation(result);setStage("completed");
      const cartDomain=new URLSearchParams(window.location.search).get("forDomain") ?? undefined;
      if(selected?.revision) void removeFromCart(cartSelectionId({kind:"service",plan:planId,cycle:cycleKey,revision:selected.revision,domain:cartDomain})).catch(()=>{});
      try{sessionStorage.removeItem("octalve-cloud-active-hosting-checkout");}catch{}
      if(result.invoice.status!=="unpaid") {
        setError("Order status changed. Please review its invoice before attempting payment.");
      }
    }catch{setError("We couldn't confirm your order. Check Orders before retrying; the checkout reference is unchanged.");}
    finally{submitting.current=false;setWorking(false);}
  }
  const currentStep=stage==="completed"?2:1;
  return <DashboardShell role="client" title="Checkout" description="Configure your service and review your purchase.">
    <CommerceCheckoutFrame stage={currentStep} title={stage==="completed"?"Your invoice is ready":stage==="review"?"Review your order":selected?`Set up ${selected.product}`:"Set up your service"} back={()=>router.push("/client/order/checkout?view=cart")}>
      {error?<p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>:null}
      {loading?<p role="status" className="rounded-2xl bg-white p-6 text-sm text-slate-600">Preparing your selected plan…</p>:null}
      {!loading&&(!selected||!cycle)?<Link href="/client/order" className="font-medium text-[#0064E0]">Back to service plans</Link>:null}
      {selected&&cycle&&stage!=="completed"?<CheckoutColumns summary={<CheckoutQuoteSummary plan={selected} cycleKey={cycleKey} quote={quote} coupon={coupon} stage={stage} onCouponChange={value=>{setCoupon(value);setQuote(null);}} onChangeRequest={()=>{setStage("domain");setQuote(null);setAgreed(false);}}/>}>
        <CommercePanel className="min-w-0">
          {stage==="domain"?<>
            <ServiceDomainChoice choice={domainChoice} domain={domain} invalid={!!normalizedDomain&&!validDomain}
              onChoice={value=>{setDomainChoice(value);setQuote(null);setError("");}}
              onDomainChange={value=>{setDomain(value);setQuote(null);}}/>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <Link href="/client/order" className="inline-flex items-center gap-2 text-sm font-medium text-[#0064E0]"><ArrowLeft className="h-4 w-4"/>Change plan</Link>
              <button type="button" disabled={!canReview} onClick={()=>{void review();}} className={actionClass}>
                {working?<Loader2 className="h-4 w-4 animate-spin"/>:null}
                Review order <ArrowRight className="h-4 w-4"/>
              </button>
            </div>
          </>:<form onSubmit={placeOrder}>
            <h2 className="text-xl font-medium text-slate-950">Review your order</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Confirm your package and billing details before creating an invoice.</p>
            <div className="mt-6 space-y-4 rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-medium text-slate-950">{selected.product} — {selected.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{cycle.label}</p></div>
                <span className="text-sm font-medium">{formatPlanAmount(cycle.price,selected.currency)}</span>
              </div>
              <p className="border-t border-slate-100 pt-3 text-sm text-slate-600">
                Domain: {selectedDomain||"I'll connect one later"}
              </p>
              <div className="flex justify-between gap-2 text-sm text-slate-600">
                <span>Discount {quote?.coupon_code?`(${quote.coupon_code})`:""}</span>
                <span>{quote?formatPlanAmount(Number(quote.discount_total),currency):"—"}</span>
              </div>
            </div>
            <div className="mt-6 flex items-start justify-between gap-3">
              <div><h3 className="text-base font-medium">Billing information</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {account?.full_name||"Name not saved"}<br/>
                  {account?.email||"Email unavailable"}<br/>
                  {account?.phone_number||"Telephone not saved"}<br/>
                  {[account?.address,account?.city,account?.state,account?.postal_code,account?.country].filter(Boolean).join(", ")||"Address not saved"}
                </p></div>
              <Link href="/client/profile" className="shrink-0 text-sm font-medium text-[#0064E0]">Edit account</Link>
            </div>

            <label className="mt-6 flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              <input type="checkbox" required checked={agreed} onChange={e=>setAgreed(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#0064E0]"/>
              I confirm my order and billing details.
            </label>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <button type="button" className="inline-flex gap-2 text-sm font-medium text-[#0064E0]"
                onClick={()=>{setStage("domain");setQuote(null);setAgreed(false);}}>
                <ArrowLeft className="h-4 w-4"/>Edit domain
              </button>
              <button type="submit" disabled={!agreed||working||!quote} className={actionClass}>
                {working?<Loader2 className="h-4 w-4 animate-spin"/>:null}
                Confirm order <ArrowRight className="h-4 w-4"/>
              </button>
            </div>
          </form>}
        </CommercePanel>
      </CheckoutColumns>:null}
      {stage==="completed"&&confirmation?<OrderConfirmation reference={confirmation.order_number??confirmation.invoice?.invoice_number??""} title="Your order is recorded">
        <p className="mt-3 text-sm leading-7 text-slate-600">Order {confirmation.order_number} is linked to invoice {confirmation.invoice?.invoice_number}.
          Payment is not yet confirmed and hosting has not been activated.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={invoiceCheckoutHref(confirmation.invoice?.id??"")}
            className={actionClass}>View payment and order status <ArrowRight className="h-4 w-4"/></Link>
          <Link href="/client/orders" className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium">My orders</Link>
        </div>
      </OrderConfirmation>:null}
    </CommerceCheckoutFrame>
  </DashboardShell>;
}

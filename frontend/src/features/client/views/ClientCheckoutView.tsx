"use client";

import {useEffect,useMemo,useState,type FormEvent} from "react";
import Link from "next/link";
import {ArrowLeft,ArrowRight,Globe2,Loader2,ShieldCheck} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {WorkspaceGrid} from "@/components/design-system/WorkspaceGrid";
import {TextField} from "@/components/design-system/TextField";
import {CheckoutProgress} from "../components/commerce/CheckoutProgress";
import {CheckoutQuoteSummary} from "../components/commerce/CheckoutQuoteSummary";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {authApi,clientApi,type AccountProfile,type CheckoutQuote} from "@/lib/api/endpoints";
import {loadSellablePlans,defaultCycle,formatPlanAmount,type ClientOrderPlan} from "../data/client-order-data";

type Stage="domain"|"review"|"completed";
type DomainChoice="later"|"existing"|"new";
type Confirmation={id?:number;order_number?:string;total?:string;currency?:string;
  invoice?:{id:number;invoice_number:string;status:string;amount_due:string}};
const domainPattern=/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/;
const selectionClass="min-h-24 rounded-xl border px-4 py-4 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary";
const actionClass="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-console-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-console-hover disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto";

export function ClientCheckoutView(){
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
    if(!quote||!agreed||working||!canReview||confirmation)return;
    setWorking(true);setError("");
    try{
      const result=await clientApi.createOrder(checkoutPayload()) as unknown as Confirmation;
      if(!result.order_number||!result.invoice?.id||!result.invoice.invoice_number){
        setError("Your order needs confirmation. Check Orders before retrying with the same checkout reference.");
        return;
      }
      setConfirmation(result);setStage("completed");
      try{sessionStorage.removeItem("octalve-cloud-active-hosting-checkout");}catch{}
      if(result.invoice.status!=="unpaid") {
        setError("Order status changed. Please review its invoice before attempting payment.");
      }
    }catch{setError("We couldn't confirm your order. Check Orders before retrying; the checkout reference is unchanged.");}
    finally{setWorking(false);}
  }
  const currentStep=stage==="domain"?1:stage==="review"?2:3;
  return <DashboardShell role="client" title="Checkout" description="Configure hosting and review your purchase.">
    <DashboardPage eyebrow="Checkout" title="Set up your hosting"
      description="A guided, secure checkout. Charges and activation are verified separately.">
      <CheckoutProgress currentStep={currentStep as 0|1|2|3}/>
      {error?<p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>:null}
      {loading?<p role="status" className="rounded-2xl bg-white p-6 text-sm text-slate-600">Preparing your selected hosting package…</p>:null}
      {!loading&&(!selected||!cycle)?<Link href="/client/order" className="font-medium text-[#0064E0]">Back to hosting plans</Link>:null}
      {selected&&cycle&&stage!=="completed"?<WorkspaceGrid variant="commerceColumns">
        <Panel className="min-w-0 lg:col-span-2">
          {stage==="domain"?<>
            <div className="flex items-center gap-3"><Globe2 className="h-5 w-5 text-[#0064E0]"/>
              <h2 className="text-xl font-medium text-slate-950">Connect your domain</h2></div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Choose how your website will use a domain. You can connect one after buying hosting.
            </p>
            <WorkspaceGrid variant="choiceColumns" className="mt-6">
              {([
                ["later","Connect later"],
                ["existing","I own a domain"],
                ["new","Buy a new domain"]
              ] as const).map(([key,label])=><button key={key} type="button"
                className={`${selectionClass} ${domainChoice===key?"border-[#0064E0] bg-[#EFF6FF] text-[#0064E0]":"border-slate-200 bg-white text-slate-700"}`}
                aria-pressed={domainChoice===key} onClick={()=>{setDomainChoice(key);setQuote(null);setError("");}}>
                <span className="mb-2 block">{domainChoice===key?"●":"○"}</span>{label}
              </button>)}
            </WorkspaceGrid>
            {domainChoice==="existing"?<div className="mt-6">
              <TextField id="existing-domain" label="Your domain name" autoComplete="off"
                maxLength={253} placeholder="example.com" value={domain}
                onChange={event=>{setDomain(event.target.value);setQuote(null);}}/>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                We'll guide you through updating its DNS after hosting is activated. Ownership will be verified before changes.
              </p>
              {normalizedDomain&&!validDomain?<p className="mt-2 text-sm text-rose-600">Enter a valid domain such as example.com.</p>:null}
            </div>:null}
            {domainChoice==="new"?<div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              Domain registration will be available after our registrar connection is verified.
              We cannot show live availability or accept payment for a new domain yet.
              Select <strong>I own a domain</strong> or <strong>Connect later</strong> to continue with hosting.
            </div>:null}
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
            <p className="mt-5 text-xs leading-5 text-slate-500">
              Your billing details are recorded at order creation. Updating your account afterward does not rewrite an issued invoice.
            </p>
            <label className="mt-6 flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              <input type="checkbox" required checked={agreed} onChange={e=>setAgreed(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#0064E0]"/>
              I have reviewed the selected hosting package, billing details and price. I understand an unpaid invoice will be created;
              payment and hosting activation are separate verified steps.
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
        </Panel>
        <CheckoutQuoteSummary plan={selected} cycleKey={cycleKey} quote={quote}
          coupon={coupon} stage={stage} onCouponChange={value=>{setCoupon(value);setQuote(null);}}
          onChangeRequest={()=>{setStage("domain");setQuote(null);setAgreed(false);}}/>
      </WorkspaceGrid>:null}
      {stage==="completed"&&confirmation?<div role="status" className="mx-auto max-w-2xl rounded-2xl border border-[#D9E9FA] bg-white p-6 sm:p-9">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#0064E0]"><ShieldCheck/></div>
        <h2 className="mt-5 text-2xl font-medium text-slate-950">Your order is recorded</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">Order {confirmation.order_number} is linked to invoice {confirmation.invoice?.invoice_number}.
          Payment is not yet confirmed and hosting has not been activated.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/client/order/processing?invoice=${encodeURIComponent(String(confirmation.invoice?.id))}`}
            className={actionClass}>View payment and order status <ArrowRight className="h-4 w-4"/></Link>
          <Link href="/client/orders" className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium">My orders</Link>
        </div>
      </div>:null}
    </DashboardPage>
  </DashboardShell>;
}

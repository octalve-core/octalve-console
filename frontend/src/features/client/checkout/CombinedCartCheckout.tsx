"use client";

import {useEffect, useRef, useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {CommerceCheckoutFrame,CommercePanel,primary,secondary,OrderConfirmation,VerifiedPaymentReceipt,CheckoutPayment,CheckoutColumns,CheckoutSummary,CartItem,CartFeedback,PaymentGatewayChoices,CheckoutConsent} from "@/components/shared-commerce/CommerceUI";

import type {CartLine,CartView,GatewayCode,GatewayOption} from "@/components/shared-commerce/types";
import {authApi, type AccountProfile} from "@/lib/api/endpoints";
import {formatPlanAmount} from "../data/client-order-data";
import {CheckoutBillingDetails} from "./CheckoutBillingDetails";
import {invoiceDownloadHref} from "../components/commerce/invoice-links";
import {sharedCartLines} from "./shared-cart-adapter";
import {cartSelectionId, accountCartSnapshot, removePurchasedItems, type AccountSnapshot, type CartSelection} from "./cart-selections";

type PricedLine={name:string; amount:string; kind:string; domain?:string; period?:string};
type Quote = {quote:string; total:string; currency:string; lines:PricedLine[]; public_payment_test?:boolean;gateway_options?:GatewayOption[]};
type Purchase = {invoice_id:number; invoice:string; order:string; total:string; currency:string;
  payment_verified:boolean; payment_reference?:string|null; payment_gateway?:string|null; verified_at?:string|null; payment_started:boolean; payment_attempt_state?:"verified"|"not_started"|"resumable"|"reconciliation_required"; gateway_options?:GatewayOption[];checkout_url?:string;checkout_error?:string; public_payment_test?:boolean; lines:PricedLine[]; domains:{id:number; name:string; state:string; registered_at?:string; expires_at?:string}[]};

const reviewHref = "/client/order/checkout?view=combined-review";
const actionStyle = primary;
const statuses: Record<string,string> = {
  awaiting_payment:"Awaiting test payment", registration_uncertain:"Registration unconfirmed",
  registration_rejected:"Registration declined", registration_action_required:"Action required",
  registration_pending:"Registration pending", registered:"Test registration confirmed", test_payment_verified:"Payment test verified — no registration",
};

async function request<T>(invoice?: number, body?: Record<string,unknown>) {
  const url = "/api/cloud/domains/combined-cart" + (invoice ? `?invoice=${invoice}` : "");
  const response = await fetch(url, {
    cache:"no-store",signal:AbortSignal.timeout(25000),
    ...(body ? {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)} : {}),
  });
  const data = await response.json().catch(()=>null);
  if (!response.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : Array.isArray(data) && typeof data[0] === "string" ? data[0] : "";
    throw Error(detail || "We couldn’t confirm this checkout step. Check your invoice before retrying.");
  }
  return data as T;
}

export function CombinedCartCheckout({invoice}: {invoice?:number}) {
  const router=useRouter();
  const [draft,setDraft]=useState<AccountSnapshot>();
  const [quote, setQuote] = useState<Quote>();
  const [items, setItems] = useState<CartSelection[]>([]);
  const [account, setAccount] = useState<AccountProfile>();
  const [checkoutId, setCheckoutId] = useState("");
  const [purchase, setPurchase] = useState<Purchase>();
  const [error, setError] = useState("");
  const [gateway,setGateway]=useState<GatewayCode|null>(null);
  const [consent,setConsent]=useState(false);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [statusRefresh, setStatusRefresh] = useState(0);
  const [returningFromGateway,setReturningFromGateway]=useState(false);
  const [reload,setReload]=useState(0);
  const inFlight = useRef(false);

  useEffect(() => {
    let active = true;
    if(invoice){const params=new URLSearchParams(window.location.search);setReturningFromGateway(params.has("reference")||params.has("trxref"));}
    async function load() {
      if (invoice) {
        const current = await request<Purchase>(invoice);
        if (active) {setPurchase(current);setGateway(current.gateway_options?.find(g=>g.enabled)?.code??null);}
        return;
      }
      const [snapshot, profile] = await Promise.all([accountCartSnapshot(), authApi.profile()]);
      if(!snapshot||!snapshot.lines.every(line=>line.ready)||!snapshot.currency)throw Error("Your account cart must be priced before checkout. Return to your cart.");
      if(snapshot.checkout_issue)throw Error(snapshot.checkout_issue);
      if(active)setDraft(snapshot);
      const selections=snapshot.lines.map(line=>line.selection);
      const domains = selections.flatMap(item => item.kind === "domain" ? [item.domain] : []);
      const services = selections.flatMap(item => item.kind === "service" ? [{
        plan_id:Number(item.plan), offer_revision:item.revision, cycle_key:item.cycle,
        domain_name:item.domain ?? "", quantity:1,
      }] : []);
      if (!selections.length) throw Error("Add a product to your cart first.");
      const fingerprint = JSON.stringify([profile.email, selections]);
      let cached; try{cached=JSON.parse(sessionStorage.getItem("octalve-combined-cart-review") ?? "null");}catch{cached=null;}
      const key = cached?.fingerprint === fingerprint && typeof cached.id === "string" ? cached.id : crypto.randomUUID();
      sessionStorage.setItem("octalve-combined-cart-review", JSON.stringify({fingerprint,id:key}));
      const result = await request<Quote>(undefined, {action:"quote", domains, services});
      if (active) {
        setCheckoutId(key);
        setItems(selections);
        setAccount(profile);
        setQuote(result);
        setGateway(result.gateway_options?.find(g=>g.enabled)?.code??null);
      }
    }
    void load().catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Checkout could not load."); });
    return () => { active = false; };
  }, [invoice,reload]);

  const statusInvoice = purchase?.invoice_id;
  const needsAdvance = !!purchase && (purchase.payment_verified
    ? !purchase.public_payment_test && purchase.domains.some(domain => domain.state === "awaiting_payment")
    : purchase.payment_started&&(returningFromGateway||statusRefresh>0));

  useEffect(() => {
    if (!statusInvoice || !needsAdvance) {
      setWaiting(false);
      return;
    }
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    async function advance() {
      if (!active || !statusInvoice) return;
      if (inFlight.current) {
        timer = setTimeout(advance, 2500);
        return;
      }
      inFlight.current = true;
      try {
        const next = await request<Purchase>(statusInvoice, {action:"advance"});
        if (active) {
          setPurchase(old=>({...next,gateway_options:next.gateway_options??old?.gateway_options}));
          setError("");
          if (next.payment_verified && (next.public_payment_test||!next.domains.some(domain => domain.state === "awaiting_payment"))) {setWaiting(false);return;}
        }
      } catch {
        // Signed notification, gateway verification and registrar availability can arrive later.
      } finally {
        inFlight.current = false;
      }
      if (active && ++attempts < 10) timer = setTimeout(advance, 3500);
      else if (active) setWaiting(false);
    }
    setWaiting(true);
    void advance();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [needsAdvance, statusInvoice, statusRefresh]);

  async function run(action: "pay" | "reconcile", line?: number) {
    if (inFlight.current) return;
    if(action==="pay"&&(!consent||!gateway||purchase?.payment_attempt_state==="reconciliation_required"))return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      if(action==="pay"){
        if(!purchase&&(!quote||!checkoutId))return;
        const result=await request<Purchase>(purchase?.invoice_id,{action:"pay",gateway,consent,
          ...(!purchase?{quote:quote!.quote,checkout_id:checkoutId}:{})});
        setPurchase({...result,gateway_options:result.gateway_options??purchase?.gateway_options??quote?.gateway_options});
        if(!purchase){
          window.history.replaceState(null,"",`${reviewHref}&invoice=${result.invoice_id}`);
          try{await removePurchasedItems(items.map(cartSelectionId));}catch{/* The accepted invoice remains the payment authority. */}
          sessionStorage.removeItem("octalve-combined-cart-review");
        }
        if(result.payment_verified)return;
        if(result.checkout_error){setError(result.checkout_error);return;}
        if(!result.checkout_url)throw Error("Payment link is unavailable. Your invoice is saved.");
        const url=new URL(result.checkout_url);
        if(url.origin!=="https://checkout.paystack.com"||url.username||url.password||url.hash||url.search)throw Error("Payment link could not be verified.");
        window.location.assign(url.href);
      }
      if (action === "reconcile" && purchase && line) {
        setPurchase(await request<Purchase>(purchase.invoice_id, {action, line_id:line}));
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Checkout could not be confirmed."); }
    finally { setBusy(false); inFlight.current = false; }
  }

  const address = [account?.address, account?.city, account?.state, account?.country, account?.postal_code].filter(Boolean).join(", ");
  const record=purchase??quote;
  const options=record?.gateway_options??[];
  const reconciliationRequired=purchase?.payment_attempt_state==="reconciliation_required";
  const canPay=consent&&!!gateway&&options.some(g=>g.code===gateway&&g.enabled)&&!busy&&!reconciliationRequired;
  const lines:CartLine[]=(record?.lines??[]).map((line,index)=>({id:String(index),kind:line.kind==="domain"?"domain":line.kind==="vps"?"vps":"hosting",name:line.kind==="domain"?(line.domain||line.name):line.name,description:"",period:line.period??(line.kind==="domain"?"1 year":"Selected billing cycle"),priceLabel:formatPlanAmount(Number(line.amount),record!.currency),domain:line.domain}));
  const total=record?formatPlanAmount(Number(record.total),record.currency):"Awaiting quote";
  const cart:CartView={lines,subtotal:total,tax:record?formatPlanAmount(0,record.currency):"—",total,busy:busy||(!record&&!error),error,checkoutAllowed:!!quote&&!purchase};
  return <DashboardShell role="client" title="Checkout" description="Review your products and payment.">
    <CommerceCheckoutFrame stage={purchase?.payment_verified?3:purchase?2:1} title={purchase?.payment_verified?"Payment confirmation":purchase?"Complete your payment":"Checkout"} back={()=>router.push("/client/order/checkout?view=cart")}>
      <CartFeedback cart={cart}/>
      {!record&&draft&&<CheckoutColumns summary={<CheckoutSummary cart={{...cart,lines:sharedCartLines(draft),subtotal:draft.subtotal&&draft.currency?formatPlanAmount(Number(draft.subtotal),draft.currency):"Awaiting quote"}}><p role="status" className="text-sm text-slate-600">Confirming your order total and eligibility.</p></CheckoutSummary>}>{sharedCartLines(draft).map(line=><CartItem key={line.id} line={line} readOnly remove={()=>{}} configure={()=>{}}/>)}</CheckoutColumns>}
      {!record&&error&&<div className="flex flex-wrap gap-2"><button className={secondary} onClick={()=>router.push("/client/order/checkout?view=cart")}>Edit shopping cart</button><button className={secondary} onClick={()=>{setError("");setReload(n=>n+1)}}>Retry quotation</button></div>}
      {purchase?.payment_verified&&<VerifiedPaymentReceipt amount={total} reference={purchase.payment_reference} order={purchase.order} invoice={purchase.invoice} method={purchase.payment_gateway==="paystack"?"Paystack":purchase.payment_gateway} paidAt={purchase.verified_at?new Date(purchase.verified_at).toLocaleString("en-NG"):undefined} test actions={<><Link href="/client" className={primary}>Go to dashboard</Link><a href={invoiceDownloadHref(purchase.invoice_id)} className={secondary}>Download test invoice</a></>}><p className="text-sm text-slate-600">{purchase.public_payment_test?"No domain registration or service activation has occurred.":"Test registration status is shown below."}</p>{lines.map(line=><CartItem key={line.id} line={line} readOnly remove={()=>{}} configure={()=>{}}/>)}{!purchase.public_payment_test&&purchase.domains.map(domain=><div key={domain.id} className="mt-3 rounded-xl border p-3 text-sm"><p>{domain.name}</p><p>{statuses[domain.state]??domain.state}</p>{!["awaiting_payment","registered","registration_rejected"].includes(domain.state)&&<button type="button" className={secondary} onClick={()=>void run("reconcile",domain.id)} disabled={busy}>Check registration</button>}</div>)}</VerifiedPaymentReceipt>}
      {record&&!purchase?.payment_verified&&<CheckoutColumns summary={<CheckoutSummary cart={cart}>
        <PaymentGatewayChoices options={options} selected={gateway} onChange={setGateway}/>
        {reconciliationRequired&&<p role="status" className="text-sm text-slate-600">An existing payment attempt needs verification. Check its status or contact support with the invoice number. No new payment will be started.</p>}
        {!waiting&&!reconciliationRequired&&<><CheckoutConsent checked={consent} onChange={setConsent} disabled={busy}/><button type="button" disabled={!canPay} className={primary+" w-full"} onClick={()=>void run("pay")}>{busy?"Preparing secure payment…":purchase?.payment_started?"Resume payment":"Pay now"}</button></>}
        {purchase&&<Link href={`/client/invoices/${purchase.invoice_id}`} className={secondary+" w-full"}>View invoice {purchase.invoice}</Link>}
        {purchase?.payment_started&&!waiting&&<button className={secondary+" w-full"} onClick={()=>setStatusRefresh(n=>n+1)}>Check payment status</button>}
        <p className="text-xs text-slate-600">Test Mode only. No real money will be charged.</p>
      </CheckoutSummary>}>
        {lines.map(line=><CartItem key={line.id} line={line} readOnly remove={()=>{}} configure={()=>{}}/>)}
        {!purchase&&<CheckoutBillingDetails initial={account} onSaved={setAccount}/>}
        {purchase&&!purchase.payment_verified&&<CheckoutPayment><p className="mt-3 text-sm text-slate-600">{waiting?"Checking your test payment…":"Complete your secure test payment using Paystack."}</p><p className="mt-2 text-sm text-slate-600">Order {purchase.order} · {purchase.invoice}</p></CheckoutPayment>}
        {purchase&&!purchase.public_payment_test&&purchase.domains.map(domain=><CommercePanel key={domain.id}><p className="break-all font-medium">{domain.name}</p><p className="text-sm text-slate-600">{statuses[domain.state]??domain.state}</p>{purchase.payment_verified&&!["awaiting_payment","registered","registration_rejected"].includes(domain.state)&&<button type="button" className={secondary+" mt-3"} disabled={busy} onClick={()=>void run("reconcile",domain.id)}>Check registration</button>}</CommercePanel>)}
      </CheckoutColumns>}
    </CommerceCheckoutFrame>
  </DashboardShell>;
}

"use client";

import { useEffect, useRef, useState } from "react";
import {useRouter} from "next/navigation";
import {CommerceCheckoutFrame,CommercePanel} from "@/components/shared-commerce/CommerceUI";
import type {GatewayOption,GatewayCode} from "@/components/shared-commerce/types";
import { DomainCart } from "../checkout/DomainCart";
import { removeFromCart } from "../checkout/cart-selections";

const endpoint = "/api/cloud/domains/sandbox-purchase/";
type Purchase = {
  test_lifecycle?:unknown;
  order: string;
  invoice: string;
  invoice_id?: number;
  invoice_public_id?:string;
  invoice_reference?:string;
  order_reference?:string;
  domain: string;
  amount: string;
  state: keyof typeof labels;
  checkout_state: "available" | "resume" | "uncertain" | "expired" | "retry_check";
  gateway_options?:GatewayOption[];
  payment_verified?:boolean;
  verified_at?:string;
  payment_gateway?:string;
  payment_reference?: string;
  registered_at?: string | null;
  expires_at?: string | null;
};
type Overview = { domain: string; purchase: Purchase | null; public_payment_test?: boolean; readiness_issues?: string[] | null; payment_test_readiness_issues?: string[] | null };
type Quote = { quote: string; amount: string };
const labels = {
  awaiting_payment: "Awaiting test payment",
  test_payment_verified: "Paystack test payment verified. No domain registration or real charge was made.",
  registration_uncertain: "Test payment verified. Registrar response unconfirmed.",
  registration_rejected: "Test payment verified. Registrar rejected the registration.",
  registration_action_required: "Test payment verified. Registration needs review.",
  registration_pending: "Test payment verified. Registration pending.",
  registered: "Sandbox domain registered",
};

export function DomainSandboxPurchase({ admin = false, domain, invoiceId, checkoutPage = false }: {
  admin?: boolean; domain?: string; invoiceId?:number; checkoutPage?: boolean;
}) {
  const router=useRouter();
  const submitting=useRef(false);
  const [paymentHeld,setPaymentHeld]=useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const params = new URLSearchParams();
  if(domain)params.set("domain",domain);
  if(invoiceId)params.set("invoice",String(invoiceId));
  const requestUrl=params.size?`${endpoint}?${params}`:endpoint;

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(requestUrl, { signal: controller.signal, cache: "no-store" });
        if (response.ok) {
          const data = await response.json();
          if (!controller.signal.aborted && (!invoiceId || data.purchase?.invoice_id===invoiceId)) setOverview(data);
        }
      } catch {
        // The purchase control is only available to eligible accounts.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [requestUrl,invoiceId]);

  async function submit(action: string, gateway?:GatewayCode, consent=false) {
    if(action==="checkout"&&(gateway!=="paystack"||!consent))return;
    if(submitting.current || (invoiceId && !["checkout","reconcile"].includes(action)))return;
    submitting.current=true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(requestUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "accept" ? { action, quote: quote?.quote } : action==="checkout"?{action,gateway,consent}:{ action }),
      });
      const data = await response.json();
      if (!response.ok) {
        const detail=typeof data?.detail==="string"?data.detail:Array.isArray(data)&&typeof data[0]==="string"?data[0]:"";
        const hold=response.status===409&&["previous_payment_pending","verification_unavailable"].includes(data?.code);
        if(hold)setPaymentHeld(true);
        setError(admin&&detail?detail:hold?"Your previous payment needs confirmation. No new payment was started.":action==="reconcile"?"Your payment has not been confirmed yet. If you have already paid, please do not pay again.": "We couldn’t open secure payment. Your invoice is saved. Please try again or contact support.");
        const status = await fetch(requestUrl, { cache: "no-store" });
        if (status.ok){const refreshed=await status.json();if(!invoiceId||refreshed.purchase?.invoice_id===invoiceId)setOverview(refreshed);}
        return;
      }
      if (action === "quote") setQuote(data);
      else if (action === "checkout") {const url=new URL(data.checkout_url);if(url.origin!=="https://checkout.paystack.com"||url.username||url.password||url.hash||url.search||!/^\/[A-Za-z0-9_-]{8,150}$/.test(url.pathname))throw Error("Unapproved payment destination");window.location.assign(url.href);}
      else {
        if(invoiceId&&data.invoice_id!==invoiceId)throw Error("Invoice response mismatch");
        setOverview((current) => current ? { ...current, purchase: data } : current);
        if (action === "accept" && domain && data.order && data.domain === domain) {
          void removeFromCart(`domain:${domain}`).catch(()=>{});
        }
      }
    } catch {
      setError("The connection was interrupted. Refresh to check the current status.");
    } finally {
      submitting.current=false;
      setBusy(false);
    }
  }

  // A return URL is only a signal to request server verification, never proof.
  useEffect(()=>{
    if(!invoiceId||!overview?.purchase||overview.purchase.state!=="awaiting_payment")return;
    const query=new URLSearchParams(window.location.search);
    if(query.get("returning")!=="1"&&!query.has("reference")&&!query.has("trxref"))return;
    const controller=new AbortController();let tries=0;let timer:ReturnType<typeof setTimeout>;
    async function verify(){
      if(controller.signal.aborted||submitting.current||tries>=3)return;
      tries++;submitting.current=true;setBusy(true);
      try{
        const response=await fetch(requestUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"reconcile"}),signal:controller.signal,cache:"no-store"});
        const data=await response.json();
        if(!controller.signal.aborted&&response.ok&&data.invoice_id===invoiceId){setOverview(old=>old?{...old,purchase:data}:old);if(data.payment_verified===true)return;}
      }catch{/* Keep the original invoice; manual verification remains available. */}
      finally{submitting.current=false;if(!controller.signal.aborted)setBusy(false);}
      if(!controller.signal.aborted&&tries<3)timer=setTimeout(verify,3500);
    }
    void verify();return()=>{controller.abort();clearTimeout(timer);};
  },[invoiceId,requestUrl,overview?.purchase?.state]);
  if (!overview) return checkoutPage ? <CommerceCheckoutFrame stage={3} title="Review your order" back={()=>router.push("/client/order/checkout?view=cart")}><CommercePanel><p role="status">{loading ? "Loading domain checkout…" : "Checkout is currently unavailable for this domain or account."}</p></CommercePanel></CommerceCheckoutFrame> : null;
  const purchase = overview.purchase;
  const awaitingPayment = purchase?.state === "awaiting_payment";
  const canCheckout = awaitingPayment && !paymentHeld && ["available", "resume", "retry_check"].includes(purchase.checkout_state);
  const terminal = purchase && ["registered", "registration_rejected", "test_payment_verified"].includes(purchase.state);
  const buttons = !purchase
    ? [
        ...(quote ? [{ action: "accept", text: "Create invoice" }] : []),
        { action: "quote", text: quote ? "Get a fresh quote" : "Check availability and price" },
      ]
    : [
        ...(canCheckout ? [{
          action: "checkout",
          text: "Pay now",
        }] : []),
        ...(!terminal && (!awaitingPayment || purchase.checkout_state !== "available") ? [{
          action: "reconcile",
          text: awaitingPayment ? "Check payment status" : "Check registration status",
        }] : []),
        ...(purchase.state === "registered" && !purchase.registered_at ? [{action:"reconcile",text:"Refresh registration dates"}] : []),
      ];

  if (checkoutPage && invoiceId && !purchase) return <CommerceCheckoutFrame stage={2} title="Existing invoice unavailable" back={()=>router.push("/client/invoices")} backLabel="Back to invoices"><CommercePanel>Review the invoice in your account.</CommercePanel></CommerceCheckoutFrame>;
  if (checkoutPage) return <DomainCart domain={overview.domain} amount={purchase?.amount ?? quote?.amount}
    status={purchase ? labels[purchase.state] : undefined} order={purchase?.order_reference??purchase?.order} invoice={purchase?.invoice_reference??purchase?.invoice}
    invoiceId={purchase?.invoice_public_id??purchase?.invoice_id}
    registeredAt={purchase?.registered_at} expiresAt={purchase?.expires_at} paymentVerified={purchase?.payment_verified===true}
    testLifecycle={purchase?.test_lifecycle} gatewayOptions={purchase?.gateway_options??[]} paymentReference={purchase?.payment_reference} verifiedAt={purchase?.verified_at} paymentGateway={purchase?.payment_gateway} checkoutState={purchase?.checkout_state}
    publicPaymentTest={overview.public_payment_test===true} actions={buttons} busy={busy} error={error} onAction={(action,gateway,consent) => void submit(action,gateway,consent)}/>;

  return (
    <section id="sandbox-domain-purchase" className="space-y-3 rounded-xl border border-console-line bg-white p-4 text-sm">
      <h2 className="font-medium">{checkoutPage ? "Review domain registration" : "Sandbox domain purchase"}</h2>
      <p>{overview.domain} · One year{quote && !purchase ? ` · NGN ${quote.amount}` : ""}</p>
      {admin && overview.readiness_issues && (
        overview.readiness_issues.length ? (
          <ul className="list-disc space-y-1 pl-5">
            {overview.readiness_issues.map((issue) => <li key={issue}>{issue}</li>)}
          </ul>
        ) : (
          <p>Console preflight passed. Confirm the Test Mode webhook URL in Paystack.</p>
        )
      )}
      {admin && overview.payment_test_readiness_issues && <div><h3 className="font-medium">Public payment-only preflight</h3>{overview.payment_test_readiness_issues.length?<ul className="list-disc pl-5">{overview.payment_test_readiness_issues.map(issue=><li key={issue}>{issue}</li>)}</ul>:<p>Payment-only preflight passed.</p>}</div>}
      {purchase && (
        <div role="status" className="space-y-1">
          <p>{labels[purchase.state]}</p>
          {awaitingPayment && purchase.checkout_state === "expired" &&
            <p>Checkout expired. Check the existing payment reference.</p>}
          {awaitingPayment && purchase.checkout_state === "uncertain" &&
            <p>Checkout was interrupted. Check the existing reference before proceeding.</p>}
          <p>{purchase.order} · {purchase.invoice} · NGN {purchase.amount}</p>
          {purchase.payment_reference && <p>Test payment reference {purchase.payment_reference}</p>}
        </div>
      )}
      {!admin && (
        <div className="flex flex-wrap gap-2">
          {buttons.map(({ action, text }) => action==="checkout"&&purchase?.invoice_id?<a key={action} href={`/client/order/checkout?view=invoice&invoice=${purchase.invoice_public_id??purchase.invoice_id}`} className="rounded-lg border border-console-line px-3 py-2 font-medium text-console-primary">{text}</a>:(
            <button key={action} type="button" disabled={busy} onClick={() => void submit(action, action==="checkout"?"paystack":undefined, false)}
              className="rounded-lg border border-console-line px-3 py-2 font-medium text-console-primary disabled:opacity-50">
              {text}
            </button>
          ))}
        </div>
      )}
      {error && <p role="alert" className="text-red-700">{error}</p>}
    </section>
  );
}

"use client";

import {useEffect, useRef, useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {CheckoutColumns,CheckoutSummary} from "./ui/CheckoutSections";
import {CommerceCheckoutFrame,CommercePanel,primary,OrderConfirmation} from "@/components/shared-commerce/CommerceUI";

import {authApi, clientApi, type AccountProfile, type CheckoutQuote} from "@/lib/api/endpoints";
import {formatPlanAmount} from "../data/client-order-data";
import {cartSelectionId, readCart, removeFromCart, type CartSelection} from "./cart-selections";

type ServiceSelection = Extract<CartSelection, {kind:"service"}>;
type OrderResult = {invoice?: {id:number; invoice_number:string}};

export function ServiceCartCheckout() {
  const router=useRouter();
  const [draft, setDraft] = useState<{id:string; items:ServiceSelection[]; quote:CheckoutQuote}>();
  const [profile, setProfile] = useState<AccountProfile>();
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<OrderResult["invoice"]>();
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  function payload(id:string, items:ServiceSelection[]) {
    return {checkout_id:id, items:items.map(item => ({
      plan_id:Number(item.plan), cycle_key:item.cycle, offer_revision:item.revision,
      quantity:1, domain_name:item.domain ?? "",
    }))};
  }

  useEffect(() => {
    let active = true;
    async function quote() {
      const [items, account] = await Promise.all([readCart(), authApi.profile()]);
      if (!items.length || items.some(item => item.kind !== "service")) throw Error("Only service selections are supported.");
      const services = items.filter((item):item is ServiceSelection => item.kind === "service");
      const fingerprint = JSON.stringify([account.email, services]);
      const previous = JSON.parse(sessionStorage.getItem("octalve-service-cart-review") ?? "null");
      const id = previous?.fingerprint === fingerprint && typeof previous.id === "string" ? previous.id : crypto.randomUUID();
      sessionStorage.setItem("octalve-service-cart-review", JSON.stringify({fingerprint, id}));
      const quote = await clientApi.quoteOrder(payload(id, services));
      if (quote.items.length !== services.length) throw Error("Incomplete invoice quote");
      if(active) { setDraft({id, items:services, quote}); setProfile(account); }
    }
    void quote().catch(() => { if(active) setError("The current price couldn’t be confirmed. Return to your cart and review your selections."); });
    return () => { active = false; };
  }, []);

  async function placeOrder() {
    if (!draft || submitting.current || confirmation) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const order = await clientApi.createOrder(payload(draft.id, draft.items)) as unknown as OrderResult;
      if (!order.invoice?.id) throw Error("Missing invoice");
      setConfirmation(order.invoice);
      try {
        for (const item of draft.items) await removeFromCart(cartSelectionId(item));
        sessionStorage.removeItem("octalve-service-cart-review");
      } catch { /* The confirmed invoice remains accessible even if local storage fails. */ }
    } catch { setError("We couldn’t confirm the invoice. You can retry with the same checkout reference."); }
    finally { setBusy(false); submitting.current = false; }
  }

  const address = [profile?.address, profile?.city, profile?.state, profile?.country, profile?.postal_code].filter(Boolean).join(", ");
  return <DashboardShell role="client" title="Checkout" description="Review your order and invoice.">
    <CommerceCheckoutFrame stage={confirmation?2:1} title={confirmation?"Your invoice is ready":"Review your order"} back={()=>router.push("/client/order/checkout?view=cart")}>
      {error && <p role="alert" className="mb-4 text-sm text-rose-700">{error}</p>}
      {!draft && !error && <p role="status">Checking current prices…</p>}
      {confirmation ? <OrderConfirmation reference={confirmation.invoice_number} title="Invoice created">
        <p>Invoice {confirmation.invoice_number} is ready.</p>
        <Link className="mt-3 inline-flex min-h-11 items-center font-medium text-console-primary" href={`/client/invoices/${confirmation.id}`}>View invoice</Link><Link href={"/client/order/processing?invoice="+confirmation.id} className={primary}>Continue to payment</Link>
      </OrderConfirmation> : draft && <CheckoutColumns summary={<CheckoutSummary title="Invoice summary">
          <p className="text-2xl font-medium tabular-nums">{formatPlanAmount(Number(draft.quote.total), draft.quote.currency)}</p>
          <h3 className="mt-4 text-sm font-medium">Billing address</h3>
          <p className="mt-1 text-sm text-console-muted">{address || "No address saved"}</p>
          <Link href="/client/profile" className="inline-flex min-h-11 items-center text-sm font-medium text-console-primary">Edit billing address</Link>
          <button type="button" disabled={busy} onClick={() => void placeOrder()} className={primary+" mt-3 w-full"}>{busy ? "Creating invoice…" : "Create one invoice"}</button>
        </CheckoutSummary>}>
        <CommercePanel>
          <h2 className="text-lg font-medium">Your services</h2>
          <ul className="mt-3 divide-y divide-console-line">
            {draft.quote.items.map((item,index) => <li key={cartSelectionId(draft.items[index])} className="flex flex-wrap justify-between gap-3 py-4 text-sm">
              <div><p className="font-medium">{item.name}</p><p className="text-console-muted">{item.domain_name || "Connect a domain later"}</p></div>
              <p>{formatPlanAmount(Number(item.unit_price), draft.quote.currency)}</p>
            </li>)}
          </ul>
        </CommercePanel>
      </CheckoutColumns>}
    </CommerceCheckoutFrame>
  </DashboardShell>;
}

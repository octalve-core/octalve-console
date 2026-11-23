"use client";

import {useEffect, useRef, useState} from "react";
import Link from "next/link";
import {ArrowLeft} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {Panel} from "@/components/design-system/Panel";
import {authApi, type AccountProfile} from "@/lib/api/endpoints";
import {formatPlanAmount} from "../data/client-order-data";
import {cartSelectionId, readCart, removeFromCart, type CartSelection} from "./cart-selections";

type Quote = {quote:string; total:string; currency:string; lines:{name:string; amount:string; kind:string; domain?:string}[]};
type Purchase = {invoice_id:number; invoice:string; order:string; total:string; currency:string;
  payment_verified:boolean; domains:{id:number; name:string; state:string; registered_at?:string; expires_at?:string}[]};

const reviewHref = "/client/order/checkout?view=combined-review";
const actionStyle = "inline-flex min-h-12 items-center justify-center rounded-xl bg-console-primary px-5 text-sm font-medium text-white disabled:opacity-50";
const statuses: Record<string,string> = {
  awaiting_payment:"Awaiting test payment", registration_uncertain:"Registration unconfirmed",
  registration_rejected:"Registration declined", registration_action_required:"Action required",
  registration_pending:"Registration pending", registered:"Test registration confirmed",
};

async function request<T>(invoice?: number, body?: Record<string,unknown>) {
  const url = "/api/cloud/domains/combined-cart" + (invoice ? `?invoice=${invoice}` : "");
  const response = await fetch(url, {
    cache:"no-store",
    ...(body ? {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)} : {}),
  });
  const data = await response.json();
  if (!response.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : Array.isArray(data) && typeof data[0] === "string" ? data[0] : "";
    throw Error(detail || "We couldn’t confirm this checkout step. Check your invoice before retrying.");
  }
  return data as T;
}

export function CombinedCartCheckout({invoice}: {invoice?:number}) {
  const [quote, setQuote] = useState<Quote>();
  const [items, setItems] = useState<CartSelection[]>([]);
  const [account, setAccount] = useState<AccountProfile>();
  const [checkoutId, setCheckoutId] = useState("");
  const [purchase, setPurchase] = useState<Purchase>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (invoice) {
        const current = await request<Purchase>(invoice);
        if (active) setPurchase(current);
        return;
      }
      const [selections, profile] = await Promise.all([readCart(), authApi.profile()]);
      const domains = selections.flatMap(item => item.kind === "domain" ? [item.domain] : []);
      const services = selections.flatMap(item => item.kind === "service" ? [{
        plan_id:Number(item.plan), offer_revision:item.revision, cycle_key:item.cycle,
        domain_name:item.domain ?? "", quantity:1,
      }] : []);
      if (!domains.length) throw Error("Add a domain to your cart first.");
      const fingerprint = JSON.stringify([profile.email, selections]);
      const cached = JSON.parse(sessionStorage.getItem("octalve-combined-cart-review") ?? "null");
      const key = cached?.fingerprint === fingerprint && typeof cached.id === "string" ? cached.id : crypto.randomUUID();
      sessionStorage.setItem("octalve-combined-cart-review", JSON.stringify({fingerprint,id:key}));
      const result = await request<Quote>(undefined, {action:"quote", domains, services});
      if (active) {
        setCheckoutId(key);
        setItems(selections);
        setAccount(profile);
        setQuote(result);
      }
    }
    void load().catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Checkout could not load."); });
    return () => { active = false; };
  }, [invoice]);

  async function run(action: "accept" | "checkout" | "reconcile", line?: number) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      if (action === "accept" && quote && checkoutId) {
        const result = await request<Purchase>(undefined, {action, quote:quote.quote, checkout_id:checkoutId});
        setPurchase(result);
        window.history.replaceState(null, "", `${reviewHref}&invoice=${result.invoice_id}`);
        for (const item of items) await removeFromCart(cartSelectionId(item)).catch(() => {});
      }
      if (action === "checkout" && purchase) {
        const {checkout_url} = await request<{checkout_url:string}>(purchase.invoice_id, {action});
        const url = new URL(checkout_url);
        if (url.origin !== "https://checkout.paystack.com" || url.username || url.password) throw Error("Payment link could not be verified.");
        window.location.assign(url);
      }
      if (action === "reconcile" && purchase && line) {
        setPurchase(await request<Purchase>(purchase.invoice_id, {action, line_id:line}));
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Checkout could not be confirmed."); }
    finally { setBusy(false); inFlight.current = false; }
  }

  const address = [account?.address, account?.city, account?.state, account?.country, account?.postal_code].filter(Boolean).join(", ");
  return <DashboardShell role="client" title="Checkout" description="Review your products and payment.">
    <DashboardPage eyebrow="Checkout" title="Review your order" description="Your items share one invoice and one test payment.">
      <Link href="/client/order/checkout?view=cart" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-console-primary"><ArrowLeft size={16} aria-hidden="true"/> Back to cart</Link>
      {error && <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      {!purchase && !quote && !error && <p role="status">Checking current prices and availability…</p>}
      {purchase ? <Panel className="space-y-4">
        <h2 className="text-lg font-medium">{purchase.order}</h2>
        <Link href={`/client/invoices/${purchase.invoice_id}`} className="text-sm font-medium text-console-primary">View invoice {purchase.invoice}</Link>
        <p className="text-sm">{formatPlanAmount(Number(purchase.total), purchase.currency)}</p>
        <p className="text-sm text-console-muted">{purchase.payment_verified ? "Test payment verified. Hosting will not be activated in this test." : "Awaiting test payment."}</p>
        {!purchase.payment_verified && <button type="button" disabled={busy} className={actionStyle} onClick={() => void run("checkout")}>Continue to test payment</button>}
        <ul className="divide-y divide-console-line">
          {purchase.domains.map(domain => <li key={domain.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div><p className="break-all font-medium">{domain.name}</p><p className="text-sm text-console-muted">{statuses[domain.state] ?? domain.state}</p>
              {domain.registered_at && domain.expires_at && <p className="text-sm text-console-muted">Registered {domain.registered_at.slice(0,10)} · Expires {domain.expires_at.slice(0,10)}</p>}
            </div>
            {domain.state !== "registered" && domain.state !== "registration_rejected" &&
              <button type="button" disabled={busy} className="min-h-11 rounded-lg border border-console-line px-3 text-sm font-medium text-console-primary disabled:opacity-50" onClick={() => void run("reconcile", domain.id)}>{purchase.payment_verified ? "Check registration" : "Verify payment and check domain"}</button>}
          </li>)}
        </ul>
      </Panel> : quote && <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <Panel>
          <h2 className="text-lg font-medium">Your items</h2>
          <ul className="mt-3 divide-y divide-console-line">
            {quote.lines.map((line,index) => <li key={index} className="flex flex-wrap justify-between gap-3 py-4 text-sm">
              <div><p className="font-medium">{line.name}</p><p className="text-console-muted">{line.kind === "domain" ? "Domain registration · 1 year" : line.domain || "Connect a domain later"}</p></div>
              <p>{formatPlanAmount(Number(line.amount),quote.currency)}</p>
            </li>)}
          </ul>
        </Panel>
        <Panel className="h-fit space-y-4">
          <h2 className="text-lg font-medium">Invoice summary</h2>
          <p className="text-xl font-medium">{formatPlanAmount(Number(quote.total),quote.currency)}</p>
          <div className="border-t border-console-line pt-4"><h3 className="text-sm font-medium">Billing address</h3>
            <p className="mt-1 text-sm text-console-muted">{address || "No address saved"}</p>
            <Link href="/client/profile" className="inline-flex min-h-11 items-center text-sm font-medium text-console-primary">Edit billing address</Link>
          </div>
          <button type="button" disabled={busy} className={actionStyle + " w-full"} onClick={() => void run("accept")}>{busy ? "Creating invoice…" : "Create one invoice"}</button>
        </Panel>
      </div>}
    </DashboardPage>
  </DashboardShell>;
}

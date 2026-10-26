"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ShieldCheck } from "lucide-react";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { authApi, clientApi, type AccountProfile } from "@/lib/api/endpoints";
import { loadSellablePlans, defaultCycle, formatPlanAmount, type ClientOrderPlan } from "../data/client-order-data";

type Confirmation = {
  order_number?: string;
  invoice?: { invoice_number: string; status: string; amount_due: string };
};

export function ClientCheckoutView() {
  const [plans, setPlans] = useState<ClientOrderPlan[]>([]);
  const [account, setAccount] = useState<AccountProfile|null>(null);
  const [planId, setPlanId] = useState("");
  const [cycleKey, setCycleKey] = useState("");
  const [domain, setDomain] = useState("");
  const [checkoutId, setCheckoutId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  useEffect(() => {
    let active = true;
    const qs = new URLSearchParams(window.location.search);
    const requestedPlan = qs.get("plan") || "";
    const requestedCycle = qs.get("cycle") || "";
    setCheckoutId(crypto.randomUUID());
    authApi.profile().then(value=>{if(active)setAccount(value);}).catch(()=>{});
    loadSellablePlans().then(items => {
      if (!active) return;
      setPlans(items);
      const chosen = items.find(p => p.id === requestedPlan) || (!requestedPlan ? items[0] : undefined);
      if (!chosen) {setError("This plan is not available. Return to plan selection.");return;}
      const cycle = chosen.cycles.find(c => c.key === requestedCycle) || (!requestedCycle ? defaultCycle(chosen) : undefined);
      if (!cycle) {setError("This billing period is unavailable. Return to plan selection.");return;}
      setPlanId(chosen.id);
      setCycleKey(cycle.key);
    }).catch(() => {if(active)setError("We couldn’t load your chosen package. Please try again; no order was created.");})
      .finally(() => {if(active)setLoading(false);});
    return () => {active = false;};
  }, []);

  const selected = plans.find(p => p.id === planId);
  const cycle = selected?.cycles.find(c => c.key === cycleKey);
  const total = (cycle?.price || 0) + (cycle?.setupFee || 0);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected || !cycle || !checkoutId || submitting || confirmation) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await clientApi.createOrder({
        checkout_id: checkoutId,
        items: [{plan_id:Number(selected.id), offer_revision:selected.revision ?? undefined,
          cycle_key:cycle.key, quantity:1, domain_name:domain.trim()}],
      });
      const record = result as unknown as Confirmation;
      if (!record.order_number || !record.invoice?.invoice_number || record.invoice.status !== "unpaid") {
        setError("Order response requires review. Check Orders and Invoices before retrying.");
        return;
      }
      setConfirmation(record);
    } catch {
      setError("Order creation was not confirmed. Retrying this form uses the same checkout key to prevent duplicate invoices.");
    } finally {
      setSubmitting(false);
    }
  }

  return <DashboardShell role="client" title="Checkout" description="Review your hosting order.">
    <DashboardPage eyebrow="Checkout" title="Review your hosting order"
      description="Check the details below before placing your order. No payment will be taken at this stage.">
      {loading ? <p role="status" className="rounded-2xl bg-white p-6 text-sm text-slate-500">Loading your selected plan...</p> : null}
      {error ? <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p> : null}
      {!loading && (!selected || !cycle) ? <Link className="text-sm font-semibold text-[#0064E0]" href="/client/order">Choose an available plan</Link> : null}
      {confirmation ? <div className="max-w-xl rounded-2xl border border-[#D9E9FA] bg-white p-6">
        <ShieldCheck className="h-8 w-8 text-[#0064E0]"/>
        <h2 className="mt-3 text-xl font-semibold text-[#142A43]">Order recorded</h2>
        <p className="mt-2 text-sm text-slate-600">Order {confirmation.order_number} has a pending invoice {confirmation.invoice?.invoice_number}. Payment is not yet confirmed.</p>
        <div className="mt-5 flex flex-wrap gap-3"><Link className="rounded-full bg-[#0064E0] px-5 py-3 text-sm font-semibold text-white" href="/client/invoices">View invoices</Link>
          <Link className="rounded-full border border-slate-200 px-5 py-3 text-sm" href="/client/orders">View orders</Link></div>
      </div> : null}
      {selected && cycle && !confirmation ? <form onSubmit={submit} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="rounded-2xl border border-[#E5EBF3] bg-white p-5">
          <label htmlFor="checkout-plan" className="text-xs font-medium text-slate-600">Hosting plan</label>
          <p id="checkout-plan" className="mt-2 text-base font-semibold text-[#142A43]">{selected.product} — {selected.name}</p>
          <p className="mt-1 text-sm text-slate-500">{cycle.label}</p>
          <label htmlFor="checkout-domain" className="mt-6 block text-xs font-medium text-slate-600">Domain or project name (optional)</label>
          <input id="checkout-domain" value={domain} onChange={e=>setDomain(e.target.value)} maxLength={255}
            placeholder="example.com" className="mt-2 h-11 w-full rounded-xl border border-[#E5EBF3] px-4 text-sm focus:border-[#0064E0] focus:outline-none"/>
          <p className="mt-2 text-xs leading-5 text-slate-500">You can provide a domain later. Domain registration is not included in this hosting order.</p>
          <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">Your billing details</h3>
              <Link href="/client/profile" className="text-sm font-semibold text-[#0064E0]">Edit details</Link>
            </div>
            {account?<div className="mt-3 text-sm leading-6 text-slate-600">
              <p className="font-medium text-slate-900">{account.full_name||"Name not saved"}</p>
              <p>{account.email}</p>
              <p>{account.phone_number||"Telephone not saved"}</p>
              <p>{[account.address,account.city,account.state,account.postal_code,account.country].filter(Boolean).join(", ")||"Billing address not saved"}</p>
            </div>:<p className="mt-3 text-sm text-slate-600">Save your contact and billing details in My account to reuse them during checkout.</p>}
          </section>
          <div className="mt-6 flex gap-3 rounded-xl bg-[#EFF6FF] p-4 text-sm leading-6 text-[#26476B]">
            <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-[#0064E0]"/>
            An unpaid invoice will be issued. Payment collection, verification and service activation are separate steps.
          </div>
        </section>
        <section className="h-fit rounded-2xl border border-[#E5EBF3] bg-white p-5">
          <h2 className="text-base font-semibold text-[#142A43]">Order summary</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Plan</dt><dd>{formatPlanAmount(cycle.price,selected.currency)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Setup fee</dt><dd>{formatPlanAmount(cycle.setupFee,selected.currency)}</dd></div>
            <div className="flex justify-between gap-4 border-t border-slate-100 pt-3 font-semibold"><dt>Estimated due</dt><dd>{formatPlanAmount(total,selected.currency)}</dd></div>
          </dl>
          <p className="mt-4 text-xs leading-5 text-slate-500">The backend calculates the final authoritative invoice amount.</p>
          <button disabled={submitting || !checkoutId} type="submit" className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#0064E0] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {submitting && <Loader2 size={16} className="animate-spin"/>}{submitting ? "Creating pending invoice..." : "Create order and pending invoice"}
          </button>
          <Link href="/client/order" className="mt-4 block text-center text-xs font-semibold text-[#0064E0]">Change plan</Link>
        </section>
      </form> : null}
    </DashboardPage>
  </DashboardShell>;
}

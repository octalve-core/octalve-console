"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ShoppingCart } from "lucide-react";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { loadSellablePlans, defaultCycle, formatPlanAmount, type ClientOrderPlan } from "../data/client-order-data";

export function ClientOrderView() {
  const [plans, setPlans] = useState<ClientOrderPlan[]>([]);
  const [planId, setPlanId] = useState("");
  const [cycleKey, setCycleKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    loadSellablePlans().then(items => {
      if (!live) return;
      setPlans(items);
      const first = items[0];
      setPlanId(first?.id || "");
      setCycleKey(defaultCycle(first)?.key || "");
    }).catch(() => { if(live) setError("The live catalog is temporarily unavailable. No order has been placed."); })
      .finally(() => {if(live) setLoading(false);});
    return () => {live = false;};
  }, []);

  const selected = plans.find(p => p.id === planId);
  const cycle = selected?.cycles.find(c => c.key === cycleKey) || defaultCycle(selected);
  function selectPlan(plan: ClientOrderPlan) {
    setPlanId(plan.id);
    setCycleKey(defaultCycle(plan)?.key || "");
  }

  return <DashboardShell role="client" title="Order service" description="Choose an available hosting plan.">
    <DashboardPage eyebrow="Services" title="Choose your hosting plan"
      description="Only active plans and prices provided by the Octalve Cloud catalog are shown.">
      {loading ? <div role="status" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading available plans...</div> : null}
      {error ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p> : null}
      {!loading && !error && plans.length === 0 ? <div className="rounded-2xl border border-[#E5EBF3] bg-white p-6 text-sm text-slate-600">No hosting plans are currently available for purchase.</div> : null}
      {plans.length > 0 && <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {plans.map(plan => {
            const chosen = selected?.id === plan.id;
            const pricing = defaultCycle(plan);
            return <button key={plan.id} type="button" aria-pressed={chosen} onClick={() => selectPlan(plan)}
              className={`rounded-2xl border bg-white p-5 text-left transition hover:border-[#AFCFFF] ${chosen ? "border-[#0064E0] ring-2 ring-[#0064E0]/10" : "border-[#E5EBF3]"}`}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3FF] text-[#0064E0]"><ShoppingCart size={19}/></span>
              <h2 className="mt-4 text-base font-semibold text-[#142A43]">{plan.name}</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">{plan.description}</p>
              <p className="mt-4 text-xl font-semibold text-[#142A43]">{pricing ? formatPlanAmount(pricing.price,plan.currency) : "—"}</p>
              <p className="mt-1 text-xs text-slate-500">{pricing?.label}{pricing?.setupFee ? " + setup fee" : ""}</p>
              <ul className="mt-4 space-y-2">{plan.features.map((feature,index) => <li key={index} className="flex gap-2 text-xs text-slate-600"><CheckCircle2 className="h-4 w-4 shrink-0 text-[#0064E0]"/>{feature}</li>)}</ul>
            </button>;
          })}
        </div>
        <div className="h-fit rounded-2xl border border-[#E5EBF3] bg-white p-5">
          <h3 className="text-base font-semibold text-[#142A43]">Order summary</h3>
          <p className="mt-2 text-sm text-slate-600">{selected?.name}</p>
          <label htmlFor="order-cycle" className="mt-5 block text-xs font-medium text-slate-600">Billing period</label>
          <select id="order-cycle" value={cycle?.key || ""} onChange={e => setCycleKey(e.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-[#E5EBF3] bg-white px-3 text-sm">
            {selected?.cycles.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <dl className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Plan</dt><dd>{formatPlanAmount(cycle?.price || 0,selected?.currency || "NGN")}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Setup fee</dt><dd>{formatPlanAmount(cycle?.setupFee || 0,selected?.currency || "NGN")}</dd></div>
            <div className="flex justify-between gap-4 border-t border-slate-100 pt-3 font-semibold"><dt>Estimated total</dt><dd>{formatPlanAmount((cycle?.price || 0)+(cycle?.setupFee || 0),selected?.currency || "NGN")}</dd></div>
          </dl>
          {selected && cycle && <Link href={`/client/order/checkout?plan=${encodeURIComponent(selected.id)}&cycle=${encodeURIComponent(cycle.key)}`}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0064E0] px-4 py-3 text-sm font-semibold text-white">
            Continue to checkout <ArrowRight size={17}/>
          </Link>}
          <p className="mt-3 text-xs leading-5 text-slate-500">Final amounts are confirmed by the server when you place an order. No payment is collected on this page.</p>
        </div>
      </div>}
    </DashboardPage>
  </DashboardShell>;
}

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
      const params = new URLSearchParams(window.location.search);
      const requestedPlan = params.get("plan") || "";
      const requestedCycle = params.get("cycle") || "";
      const chosen = items.find(item => item.id === requestedPlan) || items[0];
      setPlanId(chosen?.id || "");
      setCycleKey(chosen?.cycles.find(c => c.key === requestedCycle)?.key || defaultCycle(chosen)?.key || "");
      if (requestedPlan && !items.some(item => item.id === requestedPlan)) {
        setError("That package is no longer available. Please choose a currently published hosting plan.");
      }
    }).catch(() => { if(live) setError("We couldn’t load hosting plans right now. Please try again. No order has been placed."); })
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
    <DashboardPage eyebrow="Step 1 of 4 · Hosting" title="Choose your hosting plan"
      description="Find the right hosting package for your website, with clear pricing and flexible billing.">
      {loading ? <div role="status" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Finding hosting plans for you…</div> : null}
      {error ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p> : null}
      {!loading && !error && plans.length === 0 ? <div className="rounded-2xl border border-[#E5EBF3] bg-white p-6 text-sm text-slate-600">We’re preparing our hosting packages. Please check back soon, or <a href="/client/support/new" className="font-semibold text-[#0064E0] underline">contact our team</a> for help choosing a solution.</div> : null}
      {plans.length > 0 && <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {plans.map(plan => {
            const chosen = selected?.id === plan.id;
            const pricing = defaultCycle(plan);
            return <button key={plan.id} type="button" aria-pressed={chosen} onClick={() => selectPlan(plan)}
              className={`rounded-2xl border bg-white p-5 text-left transition hover:border-[#AFCFFF] ${chosen ? "border-[#0064E0] ring-2 ring-[#0064E0]/10" : "border-[#E5EBF3]"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3FF] text-[#0064E0]"><ShoppingCart size={19}/></span>
                {plan.popular?<span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-[#0064E0]">Popular</span>:null}
              </div>
              <h2 className="mt-4 text-lg font-medium text-[#142A43]">{plan.name}</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">{plan.description}</p>
              <p className="mt-4 text-2xl font-medium text-[#142A43]">{pricing ? formatPlanAmount(pricing.price,plan.currency) : "—"}</p>
              <p className="mt-1 text-xs text-slate-500">{pricing?.label}{pricing?.setupFee ? " + setup fee" : ""}</p>
              <ul className="mt-4 space-y-2">{plan.features.map((feature,index) => <li key={index} className="flex gap-2 text-xs text-slate-600"><CheckCircle2 className="h-4 w-4 shrink-0 text-[#0064E0]"/>{feature}</li>)}</ul>
            </button>;
          })}
        </div>
        <div className="h-fit rounded-2xl border border-[#E5EBF3] bg-white p-5">
          <h3 className="text-base font-semibold text-[#142A43]">Order summary</h3>
          <p className="mt-2 text-sm text-slate-600">{selected?.name}</p>
          <p className="mt-5 text-xs font-medium text-slate-600">Billing period</p>
          <div role="group" aria-label="Billing period" className="mt-2 grid grid-cols-2 gap-2">
            {selected?.cycles.map(c=><button key={c.key} type="button" aria-pressed={cycle?.key===c.key}
              onClick={()=>setCycleKey(c.key)}
              className={`rounded-xl border px-3 py-3 text-xs font-medium transition ${cycle?.key===c.key?"border-[#0064E0] bg-[#EFF6FF] text-[#0064E0]":"border-slate-200 bg-white text-slate-600"}`}>
              {c.label}
            </button>)}
          </div>
          <dl className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Plan</dt><dd>{formatPlanAmount(cycle?.price || 0,selected?.currency || "NGN")}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Setup fee</dt><dd>{formatPlanAmount(cycle?.setupFee || 0,selected?.currency || "NGN")}</dd></div>
            <div className="flex justify-between gap-4 border-t border-slate-100 pt-3 font-semibold"><dt>Estimated total</dt><dd>{formatPlanAmount((cycle?.price || 0)+(cycle?.setupFee || 0),selected?.currency || "NGN")}</dd></div>
          </dl>
          {selected && cycle && <Link href={`/client/order/checkout?plan=${encodeURIComponent(selected.id)}&cycle=${encodeURIComponent(cycle.key)}`}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0064E0] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#0052B8]">
            Connect domain <ArrowRight size={17}/>
          </Link>}
          <p className="mt-3 text-xs leading-5 text-slate-500">Review your order before checkout. You won’t be charged on this page.</p>
        </div>
      </div>}
    </DashboardPage>
  </DashboardShell>;
}

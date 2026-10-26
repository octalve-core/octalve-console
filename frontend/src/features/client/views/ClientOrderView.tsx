"use client";

import { useEffect, useState } from "react";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { loadSellablePlans, defaultCycle, type ClientOrderPlan } from "../data/client-order-data";
import {HostingPlanCards} from "../components/commerce/HostingPlanCards";
import {HostingOrderSummary} from "../components/commerce/HostingOrderSummary";

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
      {plans.length > 0 && <div className="grid min-w-0 gap-5 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <HostingPlanCards plans={plans} selectedId={planId} onSelect={selectPlan}/>
        </div>
        <HostingOrderSummary plan={selected} cycleKey={cycleKey} onCycleChange={setCycleKey}/>
      </div>}
    </DashboardPage>
  </DashboardShell>;
}

"use client";

import { useEffect, useState } from "react";
import {useSearchParams} from "next/navigation";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import {WorkspaceGrid} from "@/components/design-system/WorkspaceGrid";
import { loadSellablePlans, defaultCycle, type ClientOrderPlan } from "../data/client-order-data";
import {HostingPlanCards} from "../components/commerce/HostingPlanCards";
import {HostingOrderSummary} from "../components/commerce/HostingOrderSummary";

export function ClientOrderView() {
  const searchParams=useSearchParams();
  const [plans, setPlans] = useState<ClientOrderPlan[]>([]);
  const [categorySlug, setCategorySlug] = useState("");
  const [planId, setPlanId] = useState("");
  const [cycleKey, setCycleKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    loadSellablePlans().then(items => {
      if (!live) return;
      setPlans(items);
      const params = searchParams;
      const requestedPlan = params.get("plan") || "";
      const requestedProduct = params.get("product") || "";
      const requestedRevision = params.get("revision") || "";
      const selectedCategory = params.get("category") || "";
      const requestedCycle = params.get("cycle") || "";
      setCategorySlug(selectedCategory);
      const allowed = selectedCategory ? items.filter(item => item.categorySlug === selectedCategory) : items;
      // Public website uses immutable product+plan slugs; retain numeric plan
      // IDs only for legacy Console links. Reject ambiguity and mismatches.
      const chosen = requestedPlan
        ? allowed.find(item => item.id === requestedPlan ||
            (requestedProduct && item.productSlug === requestedProduct && item.slug === requestedPlan))
        : allowed[0];
      const selectedCycle = requestedCycle
        ? chosen?.cycles.find(c => c.key === requestedCycle)
        : defaultCycle(chosen);
      const mismatch = Boolean(
        requestedProduct && chosen?.productSlug !== requestedProduct ||
        requestedPlan && !chosen ||
        requestedCycle && !selectedCycle ||
        requestedRevision && (!/^[1-9][0-9]{0,9}$/.test(requestedRevision) ||
          chosen?.revision !== Number(requestedRevision))
      );
      if(mismatch){
        setPlanId("");setCycleKey("");
        setError("The selected package, billing period or published offer has changed. Please review and choose an available plan; your cart was not substituted.");
      }else{
        setError("");
        setPlanId(chosen?.id || "");
        setCycleKey(selectedCycle?.key || "");
      }
    }).catch(() => { if(live) setError("We couldn’t load hosting plans right now. Please try again. No order has been placed."); })
      .finally(() => {if(live) setLoading(false);});
    return () => {live = false;};
  }, [searchParams]);

  const visiblePlans = categorySlug ? plans.filter(p => p.categorySlug === categorySlug) : plans;
  const selected = visiblePlans.find(p => p.id === planId);
  function selectPlan(plan: ClientOrderPlan) {
    setPlanId(plan.id);
    setCycleKey(defaultCycle(plan)?.key || "");
    setError("");
  }

  return <DashboardShell role="client" title="Order service" description="Choose an available hosting plan.">
    <DashboardPage eyebrow="Step 1 of 4 · Hosting" title="Choose your hosting plan"
      description="Find the right hosting package for your website, with clear pricing and flexible billing.">
      {loading ? <div role="status" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Finding hosting plans for you…</div> : null}
      {error ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p> : null}
      {!loading && !error && plans.length === 0 ? <div className="rounded-2xl border border-[#E5EBF3] bg-white p-6 text-sm text-slate-600">We’re preparing our hosting packages. Please check back soon, or <a href="/client/support/new" className="font-medium text-[#0064E0] underline">contact our team</a> for help choosing a solution.</div> : null}
      {!loading && categorySlug && visiblePlans.length === 0 && !error ?
        <div role="status" className="rounded-2xl border border-console-line bg-white p-6 text-sm text-console-muted">
          No online checkout plans are available in this category yet. Only offers with an approved
          hosting checkout contract can currently be ordered. You can browse all eligible plans instead.
          <a href="/client/order" className="ml-2 font-medium text-console-primary underline">Browse plans</a>
        </div> : null}
      {visiblePlans.length > 0 && <WorkspaceGrid variant="commerceColumns">
        <div className="min-w-0 lg:col-span-2">
          <HostingPlanCards plans={visiblePlans} selectedId={planId} onSelect={selectPlan}/>
        </div>
        <HostingOrderSummary plan={selected} cycleKey={cycleKey} onCycleChange={setCycleKey}/>
      </WorkspaceGrid>}
    </DashboardPage>
  </DashboardShell>;
}

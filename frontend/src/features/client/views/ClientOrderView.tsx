"use client";

import { useEffect, useState } from "react";
import {useSearchParams} from "next/navigation";
import Link from "next/link";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";

import { loadPublishedPlans, defaultCycle, type ClientOrderPlan } from "../data/client-order-data";
import {HostingPlanCards} from "../components/commerce/HostingPlanCards";


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
    loadPublishedPlans().then(items => {
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
        : allowed.find(item => item.canOrder);
      const selectedCycle = requestedCycle
        ? chosen?.cycles.find(c => c.key === requestedCycle)
        : defaultCycle(chosen);
      const mismatch = Boolean(
        requestedProduct && chosen?.productSlug !== requestedProduct ||
        requestedPlan && !chosen ||
        requestedCycle && !selectedCycle ||
        requestedRevision && (!/^[1-9][0-9]{0,9}$/.test(requestedRevision) ||
          chosen?.revision !== Number(requestedRevision)) || chosen && !chosen.canOrder
      );
      if(mismatch){
        setPlanId("");setCycleKey("");
        setError("That offer is unavailable. Choose a current plan.");
      }else{
        setError("");
        setPlanId(chosen?.id || "");
        setCycleKey(selectedCycle?.key || "");
      }
    }).catch(() => { if(live) setError("Plans could not be loaded. Try again."); })
      .finally(() => {if(live) setLoading(false);});
    return () => {live = false;};
  }, [searchParams]);

  const visiblePlans = categorySlug ? plans.filter(p => p.categorySlug === categorySlug) : plans;

  return <DashboardShell role="client" title="Order service" description="Choose an available service plan.">
    <DashboardPage eyebrow="Order service" title="Choose a service plan"
      description="Review available plans and billing periods before checkout.">
      <Link href="/client/order/checkout?view=cart" className="mb-4 inline-flex min-h-11 items-center text-sm font-medium text-console-primary">View cart</Link>
      {loading ? <div role="status" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading service plans…</div> : null}
      {error ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p> : null}
      {!loading && !error && !categorySlug && plans.length === 0 ? <div className="rounded-2xl border border-[#E5EBF3] bg-white p-6 text-sm text-slate-600">No service plans are available to order yet. You can still <a href="/client/domains/register" className="font-medium text-[#0064E0] underline">search for a domain</a>.</div> : null}
      {!loading && categorySlug && visiblePlans.length === 0 && !error ?
        <div role="status" className="rounded-2xl border border-console-line bg-white p-6 text-sm text-console-muted">
          No plans in this category are available to order yet.
          <a href="/client/order" className="ml-2 font-medium text-console-primary underline">Browse plans</a>
        </div> : null}
      {plans.length>0&&<div role="group" aria-label="Service categories" className="my-5 flex flex-wrap gap-2"><button type="button" aria-pressed={!categorySlug} onClick={()=>setCategorySlug("")} className={"min-h-11 rounded-xl px-4 text-sm "+(!categorySlug?"bg-[#0064E0] text-white":"bg-slate-100 text-slate-600")}>All packages</button>{[...new Map(plans.filter(p=>p.categorySlug).map(p=>[p.categorySlug,p.categoryName||p.categorySlug]))].map(([slug,name])=><button key={slug} type="button" aria-pressed={categorySlug===slug} onClick={()=>setCategorySlug(slug)} className={"min-h-11 rounded-xl px-4 text-sm "+(categorySlug===slug?"bg-[#0064E0] text-white":"bg-slate-100 text-slate-600")}>{name}</button>)}</div>}
      {visiblePlans.length>0&&<HostingPlanCards plans={visiblePlans} selectedId={planId} selectedCycle={cycleKey} forDomain={searchParams.get("forDomain")??""}/>} 
    </DashboardPage>
  </DashboardShell>;
}

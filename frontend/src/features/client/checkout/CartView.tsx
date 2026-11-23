"use client";

import Link from "next/link";
import {ArrowLeft, ArrowRight, Plus, Trash2} from "lucide-react";
import {useEffect, useState} from "react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {Panel} from "@/components/design-system/Panel";
import {authApi, type AccountProfile} from "@/lib/api/endpoints";
import {ClientDomainSearch} from "../components/ClientDomainSearch";
import {formatPlanAmount, loadSellablePlans, type ClientOrderPlan} from "../data/client-order-data";
import {cartCheckoutHref, cartSelectionId, readCart, removeFromCart, type CartSelection} from "./cart-selections";

const linkStyle = "inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-console-primary hover:bg-blue-50";

export function CartView() {
  const [items, setItems] = useState<CartSelection[] | null>(null);
  const [plans, setPlans] = useState<ClientOrderPlan[]>([]);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(false);

  function refresh() {
    return readCart().then(setItems).catch(() => setError("Your cart couldn’t be loaded. Try refreshing the page."));
  }

  useEffect(() => {
    void refresh();
    void loadSellablePlans().then(setPlans).catch(() => {});
    void authApi.profile().then(setProfile).catch(() => {});
  }, []);

  async function remove(id: string) {
    setRemoving(true);
    setError("");
    try { setItems(await removeFromCart(id)); }
    catch { setError("Couldn’t remove this item. Try again."); }
    finally { setRemoving(false); }
  }

  const single = items?.length === 1 ? items[0] : undefined;
  const singlePlan = single?.kind === "service" ? plans.find(plan => plan.id === single.plan) : undefined;
  const canCheckout = single && (single.kind === "domain" || (
    singlePlan?.revision === single.revision && singlePlan.cycles.some(cycle => cycle.key === single.cycle)
  ));
  const serviceBasket = !!items && items.length > 1 && items.every(item => item.kind === "service");
  const address = [profile?.address, profile?.city, profile?.state, profile?.country, profile?.postal_code].filter(Boolean).join(", ");

  return <DashboardShell role="client" title="Cart" description="Review your selected products.">
    <DashboardPage eyebrow="Purchases" title="Shopping cart" description="Review your products and billing details.">
      <Link href="/client/domains/register" className={linkStyle}><ArrowLeft size={16} aria-hidden="true"/> Continue shopping</Link>
      {error && <p role="alert" className="my-3 text-sm text-rose-700">{error}</p>}
      <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="space-y-4">
          {items === null && !error && <p role="status" className="text-sm text-console-muted">Loading cart…</p>}
          {items?.length === 0 && <Panel>Your cart is empty.</Panel>}
          {items?.map(item => {
            const plan = item.kind === "service" ? plans.find(value => value.id === item.plan) : undefined;
            const cycle = item.kind === "service" ? plan?.cycles.find(value => value.key === item.cycle) : undefined;
            const id = cartSelectionId(item);
            const name = item.kind === "domain" ? item.domain : plan?.name ?? "Service plan";
            return <Panel key={id} className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-lg font-medium">{name}</h2>
                  <p className="mt-1 text-sm text-console-muted">{item.kind === "domain" ? "Domain registration · 1 year" : cycle?.label ?? "Plan availability unconfirmed"}</p>
                </div>
                <button type="button" aria-label={`Remove ${name}`} disabled={removing}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                  onClick={() => void remove(id)}><Trash2 size={16} aria-hidden="true"/> Remove</button>
              </div>
              {plan && cycle && <p className="text-sm">{formatPlanAmount(cycle.price + cycle.setupFee, plan.currency)} estimated</p>}
              {item.kind === "domain" && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-console-line pt-3">
                <ul className="flex flex-wrap gap-2" aria-label="Domain add-ons">{["SSL certificate", "Email forwarding", "Domain privacy"].map(name => <li key={name} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">{name}<span className="mt-1 block text-xs text-console-muted">Unavailable</span></li>)}</ul>
                <Link className={linkStyle} href={`/client/order?forDomain=${encodeURIComponent(item.domain)}`}><Plus size={16} aria-hidden="true"/> Add hosting</Link>
              </div>}
              {item.kind === "service" && item.domain && <p className="text-sm text-console-muted">Domain · {item.domain}</p>}
            </Panel>;
          })}
          <ClientDomainSearch onAdded={() => void refresh()}/>
        </div>
        <Panel className="space-y-4 lg:sticky lg:top-24">
          <h2 className="text-lg font-medium">Order summary</h2>
          <p className="text-sm text-console-muted">{items?.length ?? 0} {(items?.length ?? 0) === 1 ? "item" : "items"}</p>
          <div className="border-t border-console-line pt-4">
            <h3 className="text-sm font-medium">Billing address</h3>
            <p className="mt-1 text-sm text-console-muted">{address || "No address saved"}</p>
            <Link className={linkStyle} href="/client/profile">{address ? "Edit billing address" : "Add billing address"}</Link>
          </div>
          {canCheckout && <Link href={cartCheckoutHref(single)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-console-primary px-4 text-sm font-medium text-white">
            Review order <ArrowRight size={16} aria-hidden="true"/>
          </Link>}
          {serviceBasket && <Link href="/client/order/checkout?view=service-review" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-console-primary px-4 text-sm font-medium text-white">Review order <ArrowRight size={16} aria-hidden="true"/></Link>}
          {!serviceBasket && (items?.length ?? 0) > 1 && <Link href="/client/order/checkout?view=combined-review" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-console-primary px-4 text-sm font-medium text-white">Review order <ArrowRight size={16} aria-hidden="true"/></Link>}
        </Panel>
      </div>
    </DashboardPage>
  </DashboardShell>;
}

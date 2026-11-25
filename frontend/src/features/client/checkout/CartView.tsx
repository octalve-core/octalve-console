"use client";

import Link from "next/link";
import {ArrowLeft, ArrowRight} from "lucide-react";
import {useEffect, useState} from "react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {Panel} from "@/components/design-system/Panel";
import {CartLine} from "./ui/CartLine";
import {CheckoutColumns,CheckoutSteps,CheckoutSummary} from "./ui/CheckoutSections";
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
  const lines = items?.map(item => {
    const plan = item.kind === "service"
      ? plans.find(value => value.id === item.plan && value.revision === item.revision)
      : undefined;
    const cycle = item.kind === "service" ? plan?.cycles.find(value => value.key === item.cycle) : undefined;
    const price = plan && cycle ? {amount: cycle.price + cycle.setupFee, currency: plan.currency} : undefined;
    return {item, plan, cycle, price};
  });
  const currency = lines?.[0]?.price?.currency;
  const estimate = currency && lines?.every(line=>line.price?.currency===currency)
    ? formatPlanAmount(lines.reduce((sum,line)=>sum+(line.price?.amount??0),0),currency)
    : undefined;
  const address = [profile?.address, profile?.city, profile?.state, profile?.country, profile?.postal_code].filter(Boolean).join(", ");

  return <DashboardShell role="client" title="Cart" description="Review your items.">
    <DashboardPage eyebrow="Purchases" title="Shopping cart">
      <Link href="/client/domains/register" className={linkStyle}><ArrowLeft size={16} aria-hidden="true"/> Continue shopping</Link>
      {error && <p role="alert" className="my-3 text-sm text-rose-700">{error}</p>}
      <CheckoutSteps current="Cart"/>
      <CheckoutColumns summary={<CheckoutSummary title="Order summary">
          <p className="text-sm text-console-muted">{items?.length ?? 0} {(items?.length ?? 0) === 1 ? "item" : "items"}</p>
          {estimate&&<div className="flex flex-wrap justify-between gap-2 text-sm">
            <span className="text-console-muted">Estimated total</span><strong className="tabular-nums">{estimate}</strong>
          </div>}
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
        </CheckoutSummary>}>
          {items === null && !error && <p role="status" className="text-sm text-console-muted">Loading cart…</p>}
          {items?.length === 0 && <Panel>Your cart is empty.</Panel>}
          {lines?.map(({item,plan,cycle,price}) => {
            const id = cartSelectionId(item);
            const name = item.kind === "domain" ? item.domain : plan?.name ?? "Service plan";
            return <CartLine key={id} name={name} domain={item.domain} registration={item.kind === "domain"}
              detail={item.kind === "domain" ? "Domain registration · 1 year" : cycle?.label ?? "Check plan availability"}
              price={price ? formatPlanAmount(price.amount,price.currency) : undefined}
              busy={removing} onRemove={() => void remove(id)}/>;
          })}
          <Panel>
            <details>
              <summary className="cursor-pointer rounded text-sm font-medium text-console-primary focus-visible:ring-2 focus-visible:ring-console-primary">Search for another domain</summary>
              <div className="mt-4"><ClientDomainSearch onAdded={() => void refresh()}/></div>
            </details>
          </Panel>
      </CheckoutColumns>
    </DashboardPage>
  </DashboardShell>;
}

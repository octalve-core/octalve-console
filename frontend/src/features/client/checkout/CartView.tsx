"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {Panel} from "@/components/design-system/Panel";
import {loadSellablePlans,type ClientOrderPlan} from "../data/client-order-data";
import {cartCheckoutHref,cartSelectionId,readCart,removeFromCart,type CartSelection} from "./cart-selections";

export function CartView(){
  const [items,setItems]=useState<CartSelection[]|null>(null);
  const [plans,setPlans]=useState<ClientOrderPlan[]|null>(null);
  const [error,setError]=useState("");
  const [removing,setRemoving]=useState(false);

  useEffect(()=>{
    let active=true;
    void readCart().then(value=>{if(active)setItems(value);}).catch(()=>{
      if(active)setError("Your cart couldn’t be loaded. Try refreshing the page.");
    });
    void loadSellablePlans().then(value=>{if(active)setPlans(value);}).catch(()=>{});
    return ()=>{active=false;};
  },[]);

  async function remove(id:string){
    setRemoving(true);setError("");
    try {setItems(await removeFromCart(id));}
    catch {setError("Couldn’t remove this item. Try again.");}
    finally {setRemoving(false);}
  }

  return <DashboardShell role="client" title="Cart" description="Review your selected products.">
    <DashboardPage eyebrow="Purchases" title="Your cart" description="Review your items and continue to checkout.">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-console-primary">
          <Link href="/client/domains/register">Find a domain</Link><Link href="/client/order">Browse service plans</Link>
        </div>
        {error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}
        {items===null&&!error&&<p role="status" className="text-sm text-console-muted">Loading cart…</p>}
        {items?.length===0&&<Panel>Your cart is empty.</Panel>}
        {!!items?.length&&<p className="text-xs text-console-muted">Each item is checked out separately. Prices and availability are confirmed at checkout.</p>}
        {items?.map(item=>{
          const plan=item.kind==="service"?plans?.find(value=>value.id===item.plan):undefined;
          const cycle=item.kind==="service"?plan?.cycles.find(value=>value.key===item.cycle):undefined;
          const available=item.kind==="domain"||(plan&&cycle&&plan.revision===item.revision);
          const id=cartSelectionId(item);
          return <Panel key={id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><h2 className="break-words text-base font-medium">{item.kind==="domain"?item.domain:plan?.name??"Service plan"}</h2>
              <p className="mt-1 text-sm text-console-muted">{item.kind==="domain"?"Domain registration":cycle?.label??"Plan availability unconfirmed"}</p></div>
            <div className="flex flex-wrap gap-3 text-sm font-medium">
              {available&&<Link href={cartCheckoutHref(item)} className="inline-flex min-h-11 items-center rounded-lg bg-console-primary px-4 text-white">Continue to checkout</Link>}
              <button type="button" disabled={removing} className="min-h-11 px-3 text-console-primary disabled:opacity-50" onClick={()=>void remove(id)}>Remove</button>
            </div>
          </Panel>;
        })}
      </div>
    </DashboardPage>
  </DashboardShell>;
}

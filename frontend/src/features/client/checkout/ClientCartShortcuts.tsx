"use client";

import Link from "next/link";
import {ArrowRight, ShoppingCart} from "lucide-react";
import {useEffect, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {useAuth} from "@/context/AuthContext";
import {CartDrawer,CartTrigger} from "@/components/shared-commerce/CommerceUI";
import type {CartView,CartActions} from "@/components/shared-commerce/types";
import {sharedCartLines} from "./shared-cart-adapter";
import {formatPlanAmount} from "../data/client-order-data";
import {accountCartSnapshot,cartAddedEvent,cartChangedEvent,cartHref,readCart,removeFromCart,type AccountSnapshot} from "./cart-selections";

export function useClientCartCount(email: string | undefined) {
  const [cart, setCart] = useState<{email:string; count:number}>();
  useEffect(() => {
    if (!email) return;
    const account = email;
    let request = 0;
    function refresh() {
      const current = ++request;
      void readCart(account).then(items => {
        if (current === request) setCart({email:account, count:items.length});
      }).catch(() => {
        if (current === request) setCart({email:account, count:0});
      });
    }
    refresh();
    window.addEventListener(cartChangedEvent, refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      request++;
      window.removeEventListener(cartChangedEvent, refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [email]);

  return cart && cart.email === email ? cart.count : 0;
}

function LegacyCartButton({count}: {count:number}) {
  const label = count === 0 ? "Shopping cart" : `Shopping cart, ${count} ${count === 1 ? "item" : "items"}`;
  return <Link href={cartHref} aria-label={label} title={label}
    className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-console-primary">
    <ShoppingCart className="h-5 w-5" aria-hidden="true"/>
    {count > 0 && <span className="absolute right-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-medium leading-none text-white" aria-hidden="true">{count}</span>}
  </Link>;
}

function SharedAccountCartButton({count,identity}:{count:number;identity:string}){
 const router=useRouter();
 const [snapshot,setSnapshot]=useState<AccountSnapshot|null>(null),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const epoch=useRef(0),writing=useRef(false),active=useRef(true),opener=useRef<HTMLElement|null>(null);
 async function refresh(reveal=false){
  if(writing.current)return;
  const id=++epoch.current;
  try{const next=await accountCartSnapshot();if(!active.current||id!==epoch.current)return;setSnapshot(next);if(!next)setOpen(false);else if(reveal){opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setOpen(true);}}
  catch{if(active.current&&id===epoch.current){setSnapshot(null);setOpen(false);}}
 }
 useEffect(()=>{active.current=true;void refresh();const changed=()=>void refresh();const added=()=>void refresh(true);const focus=()=>{if(document.visibilityState==="visible")void refresh();else{epoch.current++;setSnapshot(null);setOpen(false);}};window.addEventListener(cartChangedEvent,changed);window.addEventListener(cartAddedEvent,added);window.addEventListener("focus",focus);document.addEventListener("visibilitychange",focus);return()=>{active.current=false;epoch.current++;window.removeEventListener(cartChangedEvent,changed);window.removeEventListener(cartAddedEvent,added);window.removeEventListener("focus",focus);document.removeEventListener("visibilitychange",focus)}},[identity]);
 function close(){setOpen(false);requestAnimationFrame(()=>opener.current?.focus());}
 async function remove(id:string){if(writing.current)return;writing.current=true;const e=++epoch.current;setBusy(true);setError("");try{await removeFromCart(id);const next=await accountCartSnapshot();if(active.current&&e===epoch.current)setSnapshot(next);}catch{if(active.current&&e===epoch.current)setError("Could not confirm the cart update.");}finally{writing.current=false;if(active.current){setBusy(false);if(e!==epoch.current)void refresh();}}}
 if(!snapshot)return <LegacyCartButton count={count}/>;
 const cart:CartView={lines:sharedCartLines(snapshot),subtotal:snapshot.subtotal&&snapshot.currency?formatPlanAmount(Number(snapshot.subtotal),snapshot.currency):"Confirmed at review",tax:"Calculated at review",total:"Confirmed at review",checkoutAllowed:!!snapshot.currency&&snapshot.lines.every(l=>l.ready),busy,error};
 const go=()=>{close();router.push(cartHref)};
 const actions:CartActions={remove:id=>{void remove(id);},configure:async()=>{throw Error("Configure your services in the full cart.")},review:go,checkout:go,continueShopping:close};
 return <><CartTrigger count={snapshot.lines.length} onOpen={()=>{opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setOpen(true)}}/><CartDrawer open={open} close={close} cart={cart} actions={actions}/></>;
}
export function ClientCartButton({count}:{count:number}){const {user}=useAuth();return user?.role==="client"?<SharedAccountCartButton key={user.id} identity={user.id} count={count}/>:<LegacyCartButton count={count}/>;}

export function ClientCartBar({count}: {count:number}) {
  return <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 px-3 lg:bottom-5 lg:left-64 lg:px-6">
    <aside aria-label="Cart shortcut" className="pointer-events-auto mx-auto flex w-full max-w-2xl items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-950 p-2.5 text-white shadow-xl sm:px-4">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/10 min-[360px]:grid"><ShoppingCart className="h-5 w-5" aria-hidden="true"/></span>
        <p className="text-sm font-medium">{count} {count === 1 ? "item" : "items"} <span className="hidden sm:inline">in your cart</span></p>
      </div>
      <Link href={cartHref} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-console-primary px-3 text-sm font-medium text-white hover:bg-console-hover focus-visible:ring-2 focus-visible:ring-white sm:px-4">
        Proceed to checkout <ArrowRight className="h-4 w-4" aria-hidden="true"/>
      </Link>
    </aside>
  </div>;
}

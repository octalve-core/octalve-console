"use client";

import {useEffect, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {useAuth} from "@/context/AuthContext";
import {CartDrawer,CartTrigger,CommerceNotice} from "@/components/shared-commerce/CommerceUI";
import type {CartView,CartActions} from "@/components/shared-commerce/types";
import {sharedCartLines} from "./shared-cart-adapter";
import {formatPlanAmount} from "../data/client-order-data";
import {accountCartSnapshot,confirmedCartEvent,cartAddedEvent,cartChangedEvent,cartHref,readCart,removeFromCart,cartSelectionId,type CartSelection,type AccountSnapshot} from "./cart-selections";

export function useClientCartCount(email: string | undefined) {
  const [cart, setCart] = useState<{email:string; count:number}>();
  useEffect(() => {
    if (!email) return;
    const account = email;
    let request = 0;
    function refresh(event?:Event) {
      const current = ++request;
      const confirmed=event&&confirmedCartEvent(event);
      if(confirmed){setCart({email:account,count:confirmed.lines.length});return;}
      void accountCartSnapshot().then(snapshot => snapshot?.lines.map(line=>line.selection)??[]).then(items => {
        if (current === request) setCart({email:account, count:items.length});
      }).catch(() => {
        // Keep the last confirmed count during a transient outage.
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

function SharedAccountCartButton({count,identity}:{count:number;identity:string}){
 const router=useRouter();
 const [notice,setNotice]=useState(false);
 const [snapshot,setSnapshot]=useState<AccountSnapshot|null>(null),[draft,setDraft]=useState<CartSelection[]|null>(null),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const epoch=useRef(0),writing=useRef(false),active=useRef(true),opener=useRef<HTMLElement|null>(null);
 async function refresh(reveal=false){
  if(writing.current)return;
  const id=++epoch.current;
  try{const next=await accountCartSnapshot();if(!active.current||id!==epoch.current)return;const selections=next?null:await readCart();if(!active.current||id!==epoch.current)return;setSnapshot(next);setDraft(selections);setError("");if(reveal){opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setOpen(true);}}
  catch{if(active.current&&id===epoch.current){setError("Could not refresh your cart. Open the cart to retry.");}}
 }
 useEffect(()=>{active.current=true;void refresh();let refreshTimer:ReturnType<typeof setTimeout>|undefined;const changed=(event:Event)=>{clearTimeout(refreshTimer);const next=confirmedCartEvent(event);if(next){epoch.current++;setSnapshot(next);setDraft(null);setError("");}else refreshTimer=setTimeout(()=>void refresh(),40)};const added=(event:Event)=>{clearTimeout(refreshTimer);if(confirmedCartEvent(event)){setNotice(true);return;}void refresh();};const focus=()=>{if(document.visibilityState==="visible")void refresh();else{epoch.current++;setSnapshot(null);setDraft(null);setOpen(false);setNotice(false);}};window.addEventListener(cartChangedEvent,changed);window.addEventListener(cartAddedEvent,added);window.addEventListener("focus",focus);document.addEventListener("visibilitychange",focus);return()=>{active.current=false;clearTimeout(refreshTimer);epoch.current++;window.removeEventListener(cartChangedEvent,changed);window.removeEventListener(cartAddedEvent,added);window.removeEventListener("focus",focus);document.removeEventListener("visibilitychange",focus)}},[identity]);
 function close(){setOpen(false);requestAnimationFrame(()=>opener.current?.focus());}
 async function remove(id:string){if(writing.current)return;writing.current=true;const e=++epoch.current;setBusy(true);setError("");try{const selections=await removeFromCart(id);const next=await accountCartSnapshot();if(active.current&&e===epoch.current){setSnapshot(next);setDraft(next?null:selections);}}catch{if(active.current&&e===epoch.current)setError("Could not confirm the cart update.");}finally{writing.current=false;if(active.current){setBusy(false);if(e!==epoch.current)void refresh();}}}
 const cart:CartView={lines:snapshot?sharedCartLines(snapshot):(draft??[]).map(item=>({id:cartSelectionId(item),kind:item.kind==="domain"?"domain":"hosting",name:item.kind==="domain"?item.domain:"Service selection",description:"",period:item.kind==="domain"?"1 year":item.cycle,priceLabel:"Price not confirmed"})),subtotal:snapshot?.subtotal&&snapshot.currency?formatPlanAmount(Number(snapshot.subtotal),snapshot.currency):"Confirmed at review",tax:"Calculated at review",total:"Confirmed at review",checkoutAllowed:!!snapshot&&!!snapshot.currency&&!snapshot.checkout_issue&&!error&&snapshot.lines.every(l=>l.ready),busy:busy||(!snapshot&&!draft&&!error),error:error||snapshot?.checkout_issue||(!snapshot&&draft?"Your saved selections are preserved. Reconnect to confirm pricing.":"")};
 const go=()=>{close();router.push(cartHref)};
 useEffect(()=>{router.prefetch(cartHref);},[router]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(false),5000);return()=>clearTimeout(timer)},[notice]);
 const actions:CartActions={remove:id=>{void remove(id);},configure:async()=>{throw Error("Configure your services in the full cart.")},review:go,checkout:go,continueShopping:close};
 return <>{notice&&!open&&<CommerceNotice message="Added to your cart" onDismiss={()=>setNotice(false)} onView={()=>{setNotice(false);setOpen(true)}}/>}<CartTrigger count={snapshot?.lines.length??draft?.length??(error?null:count)} onOpen={()=>{opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setOpen(true);void refresh()}}/><CartDrawer open={open} close={close} cart={cart} actions={actions}/></>;
}
export function ClientCartButton({count}:{count:number}){const {user}=useAuth();return user?.role==="client"?<SharedAccountCartButton key={user.id} identity={user.id} count={count}/>:null;}


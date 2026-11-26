"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {useAuth} from "@/context/AuthContext";
import {CartReview,CommercePanel,CommerceRecommendations,CommerceProductCard,primary} from "@/components/shared-commerce/CommerceUI";
import type {CartActions,CartLine,CartView as View} from "@/components/shared-commerce/types";
import {CheckoutBillingDetails} from "./CheckoutBillingDetails";
import {AddToCartButton} from "./AddToCartButton";
import {ClientDomainSearch} from "../components/ClientDomainSearch";
import {defaultCycle,formatPlanAmount,loadSellablePlans,type ClientOrderPlan} from "../data/client-order-data";
import {accountCartSnapshot,recoverAccountCart,confirmedCartEvent,cartSelectionId,readCart,configureCartItem,removeFromCart,cartChangedEvent,type CartSelection,type AccountSnapshot} from "./cart-selections";
import {searchCartDomains,sharedCartLines} from "./shared-cart-adapter";

function AccountCartView({identity,email}:{identity:string;email:string}){
 const router=useRouter();
 const [items,setItems]=useState<CartSelection[]|null>(null),[snapshot,setSnapshot]=useState<AccountSnapshot|null>(null),[plans,setPlans]=useState<ClientOrderPlan[]>([]);
 const [chosenCycles,setChosenCycles]=useState<Record<string,string>>({});
 const [error,setError]=useState(""),[busy,setBusy]=useState(false);
 const epoch=useRef(0),writing=useRef(false),mounted=useRef(true);
 async function refresh(claimGuest=false){
  if(writing.current)return;
  const current=++epoch.current;
  try{const recovered=claimGuest?await recoverAccountCart(email):null;const remote=recovered?recovered.snapshot:await accountCartSnapshot();const displayed=remote?.lines.map(l=>l.selection)??recovered?.selections??await readCart(email,false);if(mounted.current&&epoch.current===current){setItems(displayed);setSnapshot(remote);setError("");}}
  catch{if(mounted.current&&epoch.current===current){setError("Your cart couldn’t be refreshed. Try again.");}}
 }
 useEffect(()=>{mounted.current=true;void refresh(true);router.prefetch("/client/order/checkout?view=combined-review");void loadSellablePlans().then(p=>{if(mounted.current)setPlans(p)}).catch(()=>{});const reload=(event:Event)=>{if(document.visibilityState!=="visible")return;const next=confirmedCartEvent(event);if(next){epoch.current++;setSnapshot(next);setItems(next.lines.map(l=>l.selection));setError("");}else void refresh()};window.addEventListener(cartChangedEvent,reload);window.addEventListener("focus",reload);window.addEventListener("pageshow",reload);return()=>{mounted.current=false;epoch.current++;window.removeEventListener(cartChangedEvent,reload);window.removeEventListener("focus",reload);window.removeEventListener("pageshow",reload);};},[identity]);
 async function mutate(id:string,domain?:string,register=false){
  if(writing.current)throw Error("Cart update in progress.");
  writing.current=true;epoch.current++;setBusy(true);setError("");
  try{let remote:AccountSnapshot|null;if(domain===undefined){await removeFromCart(id);remote=await accountCartSnapshot();}else{remote=await configureCartItem(id,domain,register);}const selection=remote?.lines.map(l=>l.selection)??await readCart();
   if(mounted.current){setSnapshot(remote);setItems(selection);}
  }catch{if(mounted.current)setError("Couldn’t confirm the cart update. Refresh and retry.");throw Error("Cart update could not be confirmed.")}
  finally{writing.current=false;if(mounted.current)setBusy(false);}
 }
 const next=items?.length?"/client/order/checkout?view=combined-review":null;
 const lines:CartLine[]=snapshot?sharedCartLines(snapshot):(items??[]).map(item=>{
  const plan=item.kind==="service"?plans.find(p=>p.id===item.plan&&p.revision===item.revision):undefined;
  const cycle=item.kind==="service"?plan?.cycles.find(c=>c.key===item.cycle):undefined;
  return {id:cartSelectionId(item),kind:item.kind==="domain"?"domain":"hosting",name:item.kind==="domain"?item.domain:plan?.name??"Service plan",description:"",period:item.kind==="domain"?"1 year":cycle?.label??"Check availability",priceLabel:plan&&cycle?formatPlanAmount(cycle.price+cycle.setupFee,plan.currency)+" estimated":"Price not confirmed",domain:item.domain};
 });
 const cart:View={lines,subtotal:snapshot?.subtotal&&snapshot.currency?formatPlanAmount(Number(snapshot.subtotal),snapshot.currency):"Price not confirmed",tax:snapshot?.currency?formatPlanAmount(0,snapshot.currency)+" est.":"—",total:snapshot?.subtotal&&snapshot.currency?formatPlanAmount(Number(snapshot.subtotal),snapshot.currency)+" est.":"—",busy:busy||items===null&&!error,error:error||snapshot?.checkout_issue||(!snapshot&&items!==null?"Your saved selections are preserved. Reconnect to the account cart to confirm prices.":""),checkoutAllowed:!!next&&!!snapshot&&!snapshot.checkout_issue&&!error&&snapshot.lines.every(l=>l.ready)&&!!snapshot.currency};
 const actions:CartActions={remove:id=>{void mutate(id).catch(()=>{});},configure:(id,domain)=>mutate(id,domain),domainPicker:snapshot?{search:searchCartDomains,addAndConfigure:(id,domain)=>mutate(id,domain,true)}:undefined,review:()=>{},checkout:()=>{if(next&&cart.checkoutAllowed)router.push(next)},continueShopping:()=>router.push("/client/order"),addHosting:()=>{document.getElementById("commerce-recommendations")?.scrollIntoView({behavior:"smooth"});if(!plans.some(p=>!items?.some(i=>i.kind==="service"&&i.plan===p.id)))router.push("/client/order")}};
 return <CartReview cart={cart} actions={actions} recommendations={lines.length>0&&plans.length>0&&<CommerceRecommendations>{plans.filter(p=>!items?.some(i=>i.kind==="service"&&i.plan===p.id)).slice(0,3).map(p=>{const cycle=p.cycles.find(c=>c.key===chosenCycles[p.id])??defaultCycle(p);if(!cycle||!p.revision)return null;return <CommerceProductCard key={p.id} line={{id:p.id,kind:"hosting",name:p.name,description:p.description,period:cycle.label,priceLabel:formatPlanAmount(cycle.price+cycle.setupFee,p.currency)}} features={p.features.slice(0,3)} configuration={<label className="mt-3 block text-xs text-slate-600">Billing period<select value={cycle.key} onChange={e=>setChosenCycles(old=>({...old,[p.id]:e.target.value}))} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">{p.cycles.map(c=><option key={c.key} value={c.key}>{c.label}</option>)}</select></label>} action={<AddToCartButton item={{kind:"service",plan:p.id,cycle:cycle.key,revision:p.revision}}/>}/>})}</CommerceRecommendations>}><CommercePanel><details><summary className="cursor-pointer text-sm font-medium text-[#0064E0]">Search for another domain</summary><div className="mt-4"><ClientDomainSearch discovery onAdded={()=>{}}/></div></details></CommercePanel><CheckoutBillingDetails/></CartReview>;
}
export function CartView(){const {user,isLoading}=useAuth();return <DashboardShell role="client" title="Cart" description="Review your items.">{isLoading?<p role="status">Loading cart…</p>:user?.role==="client"?<AccountCartView key={user.id} identity={user.id} email={user.email}/>:<p role="status">Sign in to view your cart.</p>}</DashboardShell>;}

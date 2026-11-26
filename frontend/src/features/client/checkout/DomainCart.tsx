"use client";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {ArrowRight, CalendarDays, Server, ShieldCheck} from "lucide-react";
import {CommerceCheckoutFrame,CheckoutColumns,CheckoutSummary,CommercePanel,ProductIcon,OrderConfirmation,primary,secondary} from "@/components/shared-commerce/CommerceUI";
import type {CartView} from "@/components/shared-commerce/types";
import {formatPlanAmount} from "../data/client-order-data";
import {invoiceDownloadHref,invoiceHref} from "../components/commerce/invoice-links";

type Action = {action:string;text:string};
export function checkoutDate(value?:string|null){
  if(!value)return "Pending confirmation";
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"Pending confirmation":new Intl.DateTimeFormat("en-NG",{dateStyle:"medium",timeZone:"Africa/Lagos"}).format(date);
}
export function DomainCart({domain,amount,status,order,invoice,invoiceId,registeredAt,expiresAt,paymentVerified,actions,busy,error,onAction}:{
 domain:string;amount?:string;status?:string;order?:string;invoice?:string;invoiceId?:number;registeredAt?:string|null;expiresAt?:string|null;
 paymentVerified:boolean;actions:readonly Action[];busy:boolean;error:string;onAction:(action:string)=>void;
}){
 const router=useRouter();
 const price=amount&&Number.isFinite(Number(amount))&&Number(amount)>0?formatPlanAmount(Number(amount),"NGN"):null;
 const cart:CartView={lines:[{id:"domain:"+domain,kind:"domain",name:domain,description:"",period:"1 year",priceLabel:price??"Pending quote"}],subtotal:price??"Pending quote",tax:price?"Included in quoted total":"Pending quote",total:price??"Pending quote",busy,error,checkoutAllowed:false};
 const stage=paymentVerified?5:order?4:3;
 return <CommerceCheckoutFrame stage={stage} title={paymentVerified?"Test payment confirmed":order?"Complete your payment":"Review your order"} back={()=>router.push("/client/order/checkout?view=cart")}>
  <CheckoutColumns summary={<CheckoutSummary cart={cart}>
   <p className="flex items-start gap-2 text-xs text-slate-600"><ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true"/>Test checkout. No money will be charged.</p>
   {actions.map((action,index)=><button key={action.action} type="button" disabled={busy} onClick={()=>onAction(action.action)} className={(index===0?primary:secondary)+" w-full"}>{busy&&index===0?"Working…":action.text}{!busy&&index===0&&<ArrowRight size={16} aria-hidden="true"/>}</button>)}
   {error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}
  </CheckoutSummary>}>
   {paymentVerified&&order?<OrderConfirmation reference={order} title="Test payment verified"><p className="text-sm text-slate-600">{status}</p><p className="text-sm text-slate-600">No live charge or live registration has been made.</p></OrderConfirmation>:null}
   <CommercePanel>
    <div className="flex flex-wrap items-start gap-3"><ProductIcon kind="domain"/><div className="min-w-0 flex-1"><h2 className="break-all text-base font-medium">{domain}</h2><p className="mt-1 text-xs text-slate-500">Domain registration · 1 year</p><p className="mt-2 text-sm font-medium">{price??"Pending quote"}</p></div></div>
    {order&&<><dl className="mt-5 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-3"><dt className="flex items-center gap-2 text-xs text-slate-500"><CalendarDays size={16} aria-hidden="true"/>Registration date</dt><dd className="mt-1 text-sm">{checkoutDate(registeredAt)}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Expiry date</dt><dd className="mt-1 text-sm">{checkoutDate(expiresAt)}</dd></div></dl>{!paymentVerified&&status&&<p role="status" className="mt-4 text-sm">{status}</p>}<p className="mt-2 break-words text-xs text-slate-600">{order}{invoice?" · "+invoice:""}</p></>}
    {invoiceId&&<div className="mt-3 flex flex-wrap gap-3"><Link href={invoiceHref(invoiceId)} className={secondary}>View invoice</Link><a href={invoiceDownloadHref(invoiceId)} className={secondary}>Download PDF</a></div>}
   </CommercePanel>
   {!order&&<><CommercePanel className="flex flex-wrap items-center gap-3"><Server size={20} className="text-[#0064E0]" aria-hidden="true"/><div className="min-w-0 flex-1"><h3 className="text-sm font-medium">Add web hosting</h3><p className="mt-1 text-xs text-slate-600">Optional. Browse plans for this domain.</p></div><Link href={"/client/order?forDomain="+encodeURIComponent(domain)} className={secondary}>Explore hosting</Link></CommercePanel><Link href="/client/domains/register" className="inline-flex min-h-11 items-center text-sm text-[#0064E0]">Choose a different domain</Link></>}
  </CheckoutColumns>
 </CommerceCheckoutFrame>;
}

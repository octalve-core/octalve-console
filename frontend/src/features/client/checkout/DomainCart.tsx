"use client";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {ArrowRight, CalendarDays, Server, ShieldCheck} from "lucide-react";
import {CommerceCheckoutFrame,CheckoutColumns,CheckoutSummary,CommercePanel,CartItem,CheckoutPayment,OrderConfirmation,primary,secondary} from "@/components/shared-commerce/CommerceUI";
import type {CartView} from "@/components/shared-commerce/types";
import {formatPlanAmount} from "../data/client-order-data";
import {invoiceDownloadHref,invoiceHref} from "../components/commerce/invoice-links";

type Action = {action:string;text:string};
export function checkoutDate(value?:string|null){
  if(!value)return "Pending confirmation";
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"Pending confirmation":new Intl.DateTimeFormat("en-NG",{dateStyle:"medium",timeZone:"Africa/Lagos"}).format(date);
}
export function DomainCart({domain,amount,status,order,invoice,invoiceId,registeredAt,expiresAt,paymentVerified,publicPaymentTest=false,actions,busy,error,onAction}:{
 domain:string;amount?:string;status?:string;order?:string;invoice?:string;invoiceId?:number;registeredAt?:string|null;expiresAt?:string|null;
 paymentVerified:boolean;publicPaymentTest?:boolean;actions:readonly Action[];busy:boolean;error:string;onAction:(action:string)=>void;
}){
 const router=useRouter();
 const price=amount&&Number.isFinite(Number(amount))&&Number(amount)>0?formatPlanAmount(Number(amount),"NGN"):null;
 const cart:CartView={lines:[{id:"domain:"+domain,kind:"domain",name:domain,description:"",period:"1 year",priceLabel:price??"—"}],subtotal:price??"—",tax:price?formatPlanAmount(0,"NGN"):"—",total:price??"—",busy,error,checkoutAllowed:false};
 const stage=paymentVerified?3:order?2:1;
 return <CommerceCheckoutFrame stage={stage} title={paymentVerified?"Test payment confirmed":order?"Complete your payment":"Review your order"} back={()=>router.push(invoiceId?"/client/invoices":"/client/order/checkout?view=cart")} backLabel={invoiceId?"Back to invoices":"Back to cart"}>
  <CheckoutColumns summary={<CheckoutSummary cart={cart}>
   <p className="flex items-start gap-2 text-xs text-slate-600"><ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true"/>Test checkout. No money will be charged.</p>
   {actions.map((action,index)=><button key={action.action} type="button" disabled={busy} onClick={()=>onAction(action.action)} className={(index===0?primary:secondary)+" w-full"}>{busy&&index===0?"Working…":action.text}{!busy&&index===0&&<ArrowRight size={16} aria-hidden="true"/>}</button>)}
   {error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}
  </CheckoutSummary>}>
   {paymentVerified&&order?<OrderConfirmation reference={order} title="Test payment verified"><p className="text-sm text-slate-600">{status}</p><p className="text-sm text-slate-600">No live charge or live registration has been made.</p></OrderConfirmation>:null}
   <CartItem line={cart.lines[0]} readOnly remove={()=>{}} configure={()=>{}}/>
   {order&& !paymentVerified&&<CheckoutPayment><p className="mt-3 text-sm text-slate-600">Paystack Test Mode. Use test payment details only; no money will be charged.</p><p className="mt-2 text-sm text-slate-600">After returning, check payment status to verify your transaction.</p></CheckoutPayment>}
   {publicPaymentTest&&!paymentVerified&&<CommercePanel><p className="text-sm text-slate-600">Public payment test only. No domain registration or hosting activation will occur.</p></CommercePanel>}
   {order&&<CommercePanel>
    {!publicPaymentTest&&<><dl className="mt-5 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-3"><dt className="flex items-center gap-2 text-xs text-slate-500"><CalendarDays size={16} aria-hidden="true"/>Registration date</dt><dd className="mt-1 text-sm">{checkoutDate(registeredAt)}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Expiry date</dt><dd className="mt-1 text-sm">{checkoutDate(expiresAt)}</dd></div></dl>{!paymentVerified&&status&&<p role="status" className="mt-4 text-sm">{status}</p>}<p className="mt-2 break-words text-xs text-slate-600">{order}{invoice?" · "+invoice:""}</p></>}
    {invoiceId&&<div className="mt-3 flex flex-wrap gap-3"><Link href={invoiceHref(invoiceId)} className={secondary}>View invoice</Link><a href={invoiceDownloadHref(invoiceId)} className={secondary}>Download PDF</a></div>}
   </CommercePanel>}
   {!order&&<><CommercePanel className="flex flex-wrap items-center gap-3"><Server size={20} className="text-[#0064E0]" aria-hidden="true"/><div className="min-w-0 flex-1"><h3 className="text-sm font-medium">Add web hosting</h3><p className="mt-1 text-xs text-slate-600">Optional. Browse plans for this domain.</p></div><Link href={"/client/order?forDomain="+encodeURIComponent(domain)} className={secondary}>Explore hosting</Link></CommercePanel><Link href="/client/domains/register" className="inline-flex min-h-11 items-center text-sm text-[#0064E0]">Choose a different domain</Link></>}
  </CheckoutColumns>
 </CommerceCheckoutFrame>;
}

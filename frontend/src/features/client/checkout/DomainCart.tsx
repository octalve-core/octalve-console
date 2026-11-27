"use client";
import Link from "next/link";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {ArrowRight, CalendarDays, Server, ShieldCheck} from "lucide-react";
import {CommerceCheckoutFrame,CheckoutColumns,CheckoutSummary,CommercePanel,CartItem,CheckoutPayment,VerifiedPaymentReceipt,PaymentGatewayChoices,CheckoutConsent,primary,secondary} from "@/components/shared-commerce/CommerceUI";
import type {CartView,GatewayOption,GatewayCode} from "@/components/shared-commerce/types";
import {formatPlanAmount} from "../data/client-order-data";
import {invoiceDownloadHref,invoiceHref} from "../components/commerce/invoice-links";
import {TestLifecyclePanel} from "@/components/modules/TestLifecyclePanel";
import {PendingInvoiceReferences} from "./PendingInvoiceReferences";

type Action = {action:string;text:string};
export function checkoutDate(value?:string|null){
  if(!value)return "Pending confirmation";
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"Pending confirmation":new Intl.DateTimeFormat("en-NG",{dateStyle:"medium",timeZone:"Africa/Lagos"}).format(date);
}
export function DomainCart({domain,amount,status,order,invoice,invoiceId,registeredAt,expiresAt,paymentVerified,publicPaymentTest=false,actions,busy,error,onAction,gatewayOptions,paymentReference,verifiedAt,paymentGateway,checkoutState,testLifecycle,years=1,onYearsChange}:{
 domain:string;amount?:string;status?:string;order?:string;invoice?:string;invoiceId?:number|string;registeredAt?:string|null;expiresAt?:string|null;
 paymentVerified:boolean;publicPaymentTest?:boolean;actions:readonly Action[];busy:boolean;error:string;onAction:(action:string,gateway?:GatewayCode,consent?:boolean)=>void;
 testLifecycle?:unknown;years?:number;onYearsChange?:(years:number)=>void;
 gatewayOptions:readonly GatewayOption[];paymentReference?:string;verifiedAt?:string;paymentGateway?:string;checkoutState?:string;
}){
 const router=useRouter();
 const [gateway,setGateway]=useState<GatewayCode|null>(null),[consent,setConsent]=useState(false);
 const options=gatewayOptions.map(item=>({...item,enabled:item.enabled&&item.code==="paystack"}));
 const selected=options.some(item=>item.enabled&&item.code===gateway)?gateway:options.find(item=>item.enabled)?.code??null;
 const canPay=actions.some(a=>a.action==="checkout")&&!!selected;
 const price=amount&&Number.isFinite(Number(amount))&&Number(amount)>0?formatPlanAmount(Number(amount),"NGN"):null;
 const cart:CartView={lines:[{id:"domain:"+domain,kind:"domain",name:domain,description:"",period:years===1?"1 year":`${years} years`,priceLabel:price??"—"}],subtotal:price??"—",tax:price?formatPlanAmount(0,"NGN"):"—",total:price??"—",busy,error,checkoutAllowed:false};
 const stage=paymentVerified?3:order?2:1;
 const details=<PendingInvoiceReferences invoice={invoice} order={order} invoiceId={invoiceId}/>;
 const registration=paymentVerified&&!publicPaymentTest?<CommercePanel><h3 className="font-medium">Domain registration</h3><p className="mt-2 text-sm text-slate-600">{status}</p>{(registeredAt||expiresAt)&&<dl className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-3"><dt className="flex items-center gap-2 text-xs text-slate-500"><CalendarDays size={16} aria-hidden="true"/>Registration date</dt><dd className="mt-1 text-sm">{checkoutDate(registeredAt)}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Expiry date</dt><dd className="mt-1 text-sm">{checkoutDate(expiresAt)}</dd></div></dl>}{actions.filter(a=>a.action!=="checkout").map(a=><button key={a.action} type="button" className={secondary+" mt-3"} disabled={busy} onClick={()=>onAction(a.action)}>{a.text}</button>)}</CommercePanel>:null;
 return <CommerceCheckoutFrame stage={stage} title={paymentVerified?"Payment confirmation":order?"Complete your payment":"Review your order"} back={()=>router.push(invoiceId?"/client/invoices":"/client/order/checkout?view=cart")} backLabel={invoiceId?"Back to invoices":"Back to cart"}>
  {paymentVerified&&order&&invoice?<VerifiedPaymentReceipt amount={cart.total} reference={paymentReference} order={order} invoice={invoice} method={paymentGateway==="paystack"?"Paystack":paymentGateway} paidAt={verifiedAt?new Date(verifiedAt).toLocaleString("en-NG"):undefined} test actions={<><Link href="/client" className={primary}>Go to dashboard</Link>{invoiceId&&<a href={invoiceDownloadHref(invoiceId)} className={secondary}>Download invoice</a>}</>}><CartItem line={cart.lines[0]} readOnly remove={()=>{}} configure={()=>{}}/>{registration}<TestLifecyclePanel value={testLifecycle}/></VerifiedPaymentReceipt>:
  <CheckoutColumns summary={<CheckoutSummary cart={cart}>
   {order?<><PaymentGatewayChoices options={options} selected={selected} onChange={setGateway}/>
    {canPay?<><CheckoutConsent checked={consent} onChange={setConsent} disabled={busy}/><button type="button" disabled={busy||!consent} onClick={()=>onAction("checkout",selected??undefined,consent)} className={primary+" w-full"}>{busy?"Preparing secure payment…":"Pay now"}{!busy&&<ArrowRight size={16} aria-hidden="true"/>}</button></>:<p role="status" className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Your previous payment needs confirmation, or the payment method is temporarily unavailable. If you have already paid, do not pay again.</p>}
    {actions.filter(a=>a.action!=="checkout").map(a=><button key={a.action} type="button" disabled={busy} onClick={()=>onAction(a.action)} className={secondary+" w-full"}>{a.action==="reconcile"?"Verify previous payment":a.text}</button>)}
    <p className="flex items-start gap-2 text-xs text-slate-600"><ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true"/>Secure test payment · No real charge</p>
   </>:actions.map((a,i)=><button key={a.action} type="button" disabled={busy} onClick={()=>onAction(a.action)} className={(i===0?primary:secondary)+" w-full"}>{busy&&i===0?"Working…":a.text}</button>)}
   {error&&<p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
  </CheckoutSummary>}>
   <CartItem line={cart.lines[0]} readOnly remove={()=>{}} configure={()=>{}}/>
   {onYearsChange&&!order&&<CommercePanel><label className="block text-sm">Registration term (private sandbox)<select value={years} disabled={busy} onChange={e=>onYearsChange(Number(e.target.value))} className="mt-2 block w-full rounded-lg border p-2">{[1,2,5,10].map(n=><option key={n} value={n}>{n} year(s)</option>)}</select></label><p className="mt-2 text-xs text-slate-500">A fresh supplier term and price check is required before creating an invoice.</p></CommercePanel>}
   {order&&<CheckoutPayment><p className="mt-2 text-sm text-slate-600">{checkoutState==="retry_check"?"We’ll verify your previous attempt before opening secure checkout.":canPay?"You’ll be redirected to the secure payment page to complete this invoice.":"Your invoice is saved. Verify any previous payment before trying again."}</p><p className="mt-2 text-xs text-slate-500">Test mode · No real money will be charged.</p></CheckoutPayment>}
   {order&&details}
   {!order&&<><CommercePanel className="flex flex-wrap items-center gap-3"><Server size={20} className="text-[#0064E0]" aria-hidden="true"/><div className="min-w-0 flex-1"><h3 className="text-sm font-medium">Add web hosting</h3><p className="mt-1 text-xs text-slate-600">Optional. Browse plans for this domain.</p></div><Link href={"/client/order?forDomain="+encodeURIComponent(domain)} className={secondary}>Explore hosting</Link></CommercePanel><Link href="/client/domains/register" className="inline-flex min-h-11 items-center text-sm text-[#0064E0]">Choose a different domain</Link></>}
  </CheckoutColumns>}
 </CommerceCheckoutFrame>;
}

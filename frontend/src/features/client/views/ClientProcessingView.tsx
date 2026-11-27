"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import Link from "next/link";
import {Loader2} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {useRouter} from "next/navigation";
import {CommercePanel,CommerceCheckoutFrame,VerifiedPaymentReceipt,CheckoutColumns,CheckoutSummary,CartItem,CheckoutPayment,PaymentGatewayChoices,CheckoutConsent,primary,secondary} from "@/components/shared-commerce/CommerceUI";
import {StatusBadge} from "@/components/design-system/StatusBadge";
import {GooglePayReviewButton} from "../components/commerce/GooglePayReviewButton";
import {clientApi,type CheckoutOptions} from "@/lib/api/endpoints";
import {CombinedCartCheckout} from "../checkout/CombinedCartCheckout";
import {DomainCheckout} from "../checkout/DomainCheckout";
import type {CartLine,CartView,GatewayCode} from "@/components/shared-commerce/types";
import {invoiceDownloadHref,invoiceHref} from "../components/commerce/invoice-links";

type InvoiceState={id:number;subtotal:string;discount_total:string;tax_total:string;items?:{id:number;description:string;domain_name?:string;plan_id?:number|null;quantity:number;subtotal:string}[];checkout_context?:{kind:string;domain?:string};payment_attempt?:{state:string;gateway:string|null;test?:boolean};invoice_number?:string;status:string;currency:string;total:string;amount_due:string;payment_action_allowed?:boolean;order_number?:string;payment_details?:{reference:string;gateway:string;verified_at?:string;test:boolean}|null};
const doneStates=["paid","void","cancelled","refunded"];
const allowedHosts=new Set(["checkout.paystack.com","checkout.flutterwave.com"]);

export function ClientProcessingView(){
  const router=useRouter();
  const [invoiceId,setInvoiceId]=useState<number|null>(null);
  const [invoice,setInvoice]=useState<InvoiceState|null>(null);
  const [options,setOptions]=useState<CheckoutOptions|null>(null);
  const [error,setError]=useState("");
  const [pending,setPending]=useState(true);
  const [paying,setPaying]=useState(false);
  const payingRef=useRef(false);
  const [gateway,setGateway]=useState<GatewayCode|null>(null);
  const [consent,setConsent]=useState(false);
  const [finishedChecking,setFinishedChecking]=useState(false);

  useEffect(()=>{
    const query=new URLSearchParams(window.location.search);
    const raw=query.get("invoice")||"";
    if(!/^[1-9]\d{0,14}$/.test(raw)){setError("Open an invoice from your account to view its status.");setPending(false);return;}
    const id=Number(raw);
    if(!Number.isSafeInteger(id)){setError("Invalid invoice.");setPending(false);return;}
    setInvoiceId(id);
    let active=true;
    void clientApi.checkoutOptions().then(d=>{if(active)setOptions(d);})
      .catch(()=>{if(active)setOptions({enabled:false,gateways:[],currency:"NGN",google_pay_review_enabled:false});});
    return()=>{active=false;};
  },[]);

  const reload=useCallback(async(id:number)=>{
    const data=await clientApi.invoice(String(id)) as unknown as InvoiceState;
    if(!data||data.id!==id||typeof data.status!=="string"||typeof data.amount_due!=="string")
      throw Error("Invoice response unavailable");
    setInvoice(data);setError("");setPending(false);
    return data;
  },[]);

  useEffect(()=>{
    if(invoiceId===null)return;
    const id:number=Number(invoiceId);
    let active=true;
    let fetching=false;
    let attempts=0;
    let status="";
    async function check(){
      if(!active||fetching||document.visibilityState!=="visible"||attempts>=15||
         doneStates.includes(status))return;
      fetching=true;attempts++;
      try{
        const record=await reload(id);
        if(active)status=record.checkout_context&&record.checkout_context.kind!=="invoice"?"void":record.status;
      }catch{
        if(active){setError("We couldn't confirm the latest invoice status. Your order has not been changed.");setPending(false);}
      }finally{fetching=false;if(active&&attempts>=15)setFinishedChecking(true);}
    }
    void check();
    const timer=window.setInterval(()=>{void check();},20000);
    const focus=()=>{void check();};
    document.addEventListener("visibilitychange",focus);
    return()=>{active=false;window.clearInterval(timer);document.removeEventListener("visibilitychange",focus);};
  },[invoiceId,reload]);

  async function beginPayment(gateway:"paystack"|"flutterwave"){
    if(!invoiceId||!invoice||invoice.status!=="unpaid"||!invoice.payment_action_allowed||!consent||payingRef.current||invoice.payment_attempt?.state==="reconciliation_required"||!options?.gateways.includes(gateway)||!!invoice.payment_attempt?.gateway&&invoice.payment_attempt.gateway!==gateway)return;
    payingRef.current=true;
    setPaying(true);setError("");
    try{
      const response=await clientApi.initializeHostedPayment(invoiceId,gateway);
      const target=new URL(response.checkout_url);
      if(target.protocol!=="https:"||!allowedHosts.has(target.hostname)||
        target.username||target.password||target.hash||target.search||target.port)throw Error("Unapproved payment destination");
      window.location.assign(target.toString());
    }catch{
      setError("Secure payment could not be started or its previous attempt requires review. Do not pay twice; check your invoice or contact support.");
      payingRef.current=false;setPaying(false);
      try{await reload(invoiceId);}catch{/* Preserve the original invoice and error. */}
    }
  }

  // Resolve the controller only from the authenticated invoice response.
  if(invoiceId&&invoice?.checkout_context?.kind==="combined_domain")return <CombinedCartCheckout invoice={invoiceId}/>;
  if(invoiceId&&invoice?.checkout_context?.kind==="domain"&&typeof invoice.checkout_context.domain==="string")return <DomainCheckout domain={invoice.checkout_context.domain} invoiceId={invoiceId}/>;
  if(invoiceId&&invoice?.checkout_context?.kind==="legacy_domain")return <DomainCheckout invoiceId={invoiceId}/>;
  const paid=invoice?.status==="paid";
  const offered=!!(options?.enabled&&invoice?.currency===options.currency&&invoice?.status==="unpaid"&&invoice.payment_action_allowed);
  const reconciliation=invoice?.payment_attempt?.state==="reconciliation_required";
  const lockedGateway=invoice?.payment_attempt?.gateway;
  const choices=(["paystack","flutterwave","monnify","google_pay"] as const).map(code=>({code,enabled:offered&&!reconciliation&&!!options?.gateways.includes(code)&&(!lockedGateway||lockedGateway===code),test:invoice?.payment_attempt?.test===true}));
  const selected=choices.some(c=>c.code===gateway&&c.enabled)?gateway:choices.find(c=>c.enabled)?.code??null;
  const money=(value:string|undefined)=>invoice&&typeof value==="string"&&/^\d+(?:\.\d{1,2})?$/.test(value)?new Intl.NumberFormat("en-NG",{style:"currency",currency:invoice.currency}).format(Number(value)):"—";
  const lines:CartLine[]=(invoice?.items??[]).map(item=>({id:String(item.id),kind:item.domain_name&&!item.plan_id?"domain":"hosting",name:item.description,description:item.quantity>1?"Quantity: "+item.quantity:"",period:"Invoiced item",priceLabel:money(item.subtotal),domain:item.domain_name||undefined}));
  const cart:CartView={lines,subtotal:money(invoice?.subtotal),tax:money(invoice?.tax_total),total:money(invoice?.total),checkoutAllowed:false,busy:paying};
  const verified=paid&&invoice?.payment_details&&!invoice.payment_details.test;
  return <DashboardShell role="client" title="Checkout" description="Continue the existing invoice and secure payment.">
    <CommerceCheckoutFrame stage={paid?3:2} title={paid?"Payment confirmed":"Complete your payment"} back={()=>router.push("/client/invoices")} backLabel="Back to invoices">
      {verified&&invoice&&invoice.payment_details?<VerifiedPaymentReceipt amount={money(invoice.total)} reference={invoice.payment_details.reference} order={invoice.order_number||"—"} invoice={invoice.invoice_number||"—"} method={invoice.payment_details.gateway==="paystack"?"Paystack":invoice.payment_details.gateway} paidAt={invoice.payment_details.verified_at?new Date(invoice.payment_details.verified_at).toLocaleString("en-NG"):undefined} test={false} actions={<><Link href="/client" className={primary}>Go to dashboard</Link><a href={invoiceDownloadHref(invoice.id)} className={secondary}>Download receipt</a></>}><p className="text-sm text-slate-600">Your payment is recorded. Track service activation in your account.</p></VerifiedPaymentReceipt>:<>
      {pending&&<CommercePanel><p role="status" className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin"/>Checking the existing invoice…</p></CommercePanel>}
      {error&&<p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}
      {invoice&&<CheckoutColumns summary={<CheckoutSummary cart={cart}>
        {Number(invoice.discount_total)>0&&<p className="text-sm text-slate-600">Discount: {money(invoice.discount_total)}</p>}
        <p className="text-sm font-medium">Amount due: {money(invoice.amount_due)}</p>
        {invoice.status==="unpaid"&&<PaymentGatewayChoices options={choices} selected={selected} onChange={setGateway}/>}
        {reconciliation&&<p role="status" className="text-sm text-slate-600">Your original payment needs verification. No second payment will be created.</p>}
        {offered&&!reconciliation&&<><CheckoutConsent checked={consent} onChange={setConsent} disabled={paying}/><button type="button" disabled={!consent||paying||(selected!=="paystack"&&selected!=="flutterwave")} className={primary+" w-full"} onClick={()=>{if(selected==="paystack"||selected==="flutterwave")void beginPayment(selected);}}>{paying?"Connecting…":invoice.payment_attempt?.state==="resumable"?"Resume payment":"Pay now"}</button></>}
        {options?.google_pay_review_enabled&&invoiceId&&invoice?.status==="unpaid"&&invoice.payment_action_allowed&&!reconciliation?<GooglePayReviewButton invoiceId={invoiceId}/>:null}
        <button type="button" disabled={paying} className={secondary+" w-full"} onClick={()=>{if(invoiceId)void reload(invoiceId).catch(()=>setError("Invoice status could not be refreshed."));}}>Check payment status</button>
        <Link href={invoiceHref(invoice.id)} className={secondary+" w-full"}>View invoice</Link>
        <a href={invoiceDownloadHref(invoice.id)} className={secondary+" w-full"}>Download invoice</a>
      </CheckoutSummary>}>
        {lines.map(line=><CartItem key={line.id} line={line} readOnly remove={()=>{}} configure={()=>{}}/>)}
        <CheckoutPayment><p className="mt-3 break-words text-sm text-slate-600">Invoice {invoice.invoice_number||"—"} · Order {invoice.order_number||"—"}</p><div className="mt-3"><StatusBadge tone={paid?"success":invoice.status==="unpaid"?"warning":"neutral"}>{invoice.status.replaceAll("_"," ")}</StatusBadge></div>
          <p className="mt-3 text-sm text-slate-600">{paid?"Payment is recorded. Service activation is verified separately.":invoice.status==="void"?"No payment is due for this invoice.":!offered?"Payment is not currently available. Your invoice is preserved.":"Continue this existing invoice. Payment is verified independently."}</p>
          {finishedChecking&&!paid&&<p className="mt-3 text-xs text-slate-600">Automatic checks paused. Use Check payment status to refresh.</p>}
          <Link href="/client/support/new" className={secondary+" mt-4"}>Contact support</Link>
        </CheckoutPayment>
      </CheckoutColumns>}
      </>}
    </CommerceCheckoutFrame>
  </DashboardShell>;
}

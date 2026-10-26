"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {CreditCard,FileText,Loader2,ShieldCheck,AlertCircle} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {clientApi,type CheckoutOptions} from "@/lib/api/endpoints";

type InvoiceState={id:number;invoice_number?:string;status:string;currency:string;total:string;amount_due:string};
const doneStates=["paid","void","cancelled","refunded"];
const allowedHosts=new Set(["checkout.paystack.com","checkout.flutterwave.com"]);

export function ClientProcessingView(){
  const [invoiceId,setInvoiceId]=useState<number|null>(null);
  const [invoice,setInvoice]=useState<InvoiceState|null>(null);
  const [options,setOptions]=useState<CheckoutOptions|null>(null);
  const [error,setError]=useState("");
  const [pending,setPending]=useState(true);
  const [paying,setPaying]=useState(false);
  const [finishedChecking,setFinishedChecking]=useState(false);

  useEffect(()=>{
    const query=new URLSearchParams(window.location.search);
    const raw=query.get("invoice")||"";
    if(!/^[1-9]\d{0,11}$/.test(raw)){setError("Open an invoice from your account to view its status.");setPending(false);return;}
    const id=Number(raw);
    if(!Number.isSafeInteger(id)){setError("Invalid invoice.");setPending(false);return;}
    setInvoiceId(id);
    let active=true;
    void clientApi.checkoutOptions().then(d=>{if(active)setOptions(d);})
      .catch(()=>{if(active)setOptions({enabled:false,gateways:[],currency:"NGN"});});
    return()=>{active=false;};
  },[]);

  const reload=useCallback(async(id:number)=>{
    const data=await clientApi.invoice(String(id)) as unknown as InvoiceState;
    if(!data||typeof data.status!=="string"||typeof data.amount_due!=="string")
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
        if(active)status=record.status;
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
    if(!invoiceId||!invoice||invoice.status!=="unpaid"||paying)return;
    setPaying(true);setError("");
    try{
      const response=await clientApi.initializeHostedPayment(invoiceId,gateway);
      const target=new URL(response.checkout_url);
      if(target.protocol!=="https:"||!allowedHosts.has(target.hostname)||
        target.username||target.password||target.hash)throw Error("Unapproved payment destination");
      window.location.assign(target.toString());
    }catch{
      setError("Secure payment could not be started or its previous attempt requires review. Do not pay twice; check your invoice or contact support.");
      setPaying(false);
    }
  }

  const paid=invoice?.status==="paid";
  const offered=options?.enabled&&invoice?.currency===options.currency&&invoice?.status==="unpaid";
  return <DashboardShell role="client" title="Order status" description="Track your invoice and secure payment.">
    <DashboardPage eyebrow="Checkout · Order status" title="Your order progress"
      description="Your order status updates automatically while this page is open.">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-9">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#0064E0]">
            {paid?<ShieldCheck/>:<FileText/>}
          </div>
          <div>
            <h2 className="text-xl font-medium text-slate-950">
              {paid?"Payment recorded":invoice?"Your invoice is ready":"Checking your order"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {paid?"Your payment is recorded. Hosting readiness is verified separately.":
               "Payment and service activation are not yet confirmed."}
            </p>
          </div>
        </div>
        {pending?<p role="status" className="mt-6 flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin"/>Checking the latest invoice status…</p>:null}
        {invoice?<div className="mt-7 grid gap-4 rounded-xl bg-slate-50 p-5 sm:grid-cols-2">
          <div><p className="text-xs text-slate-500">Invoice</p><p className="mt-1 font-medium">{invoice.invoice_number||"—"}</p></div>
          <div><p className="text-xs text-slate-500">Status</p><p className="mt-1 font-medium capitalize">{invoice.status.replaceAll("_"," ")}</p></div>
          <div><p className="text-xs text-slate-500">Total</p><p className="mt-1 font-medium">{invoice.currency} {invoice.total}</p></div>
          <div><p className="text-xs text-slate-500">Amount due</p><p className="mt-1 font-medium">{invoice.currency} {invoice.amount_due}</p></div>
        </div>:null}
        {error?<p role="alert" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900"><AlertCircle className="mr-2 inline h-4 w-4"/>{error}</p>:null}
        {invoice&&invoice.status==="unpaid"&&!offered?<p className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-800">
          Secure payment methods are being prepared. Your invoice remains unpaid. You can review it in Billing without paying or creating another order.
        </p>:null}
        {offered?<section className="mt-6">
          <h3 className="mb-3 text-base font-medium">Choose a secure payment method</h3>
          <div className="flex flex-wrap gap-3">
            {options.gateways.filter((v):v is "paystack"|"flutterwave"=>v==="paystack"||v==="flutterwave").map(gateway=>
              <button type="button" key={gateway} disabled={paying} onClick={()=>{void beginPayment(gateway);}}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0064E0] px-5 py-3 text-sm font-medium text-white disabled:opacity-50">
                <CreditCard className="h-4 w-4"/>{paying?"Connecting…":`Pay with ${gateway==="paystack"?"Paystack":"Flutterwave"}`}
              </button>)}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">Only an independently verified gateway settlement can mark this invoice paid.</p>
        </section>:null}
        {finishedChecking&&!paid?<p className="mt-5 text-xs leading-5 text-slate-500">
          Automatic status checks have paused. Your account will show the latest recorded state when reopened.
        </p>:null}
        <div className="mt-7 flex flex-wrap gap-3">
          {invoiceId?<a href={`/api/cloud/billing/invoices/${encodeURIComponent(String(invoiceId))}/download_pdf/`}
            className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-[#0064E0]">Download invoice</a>:null}
          <Link href="/client/orders" className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium">View orders</Link>
          <Link href="/client/support/new" className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium">Contact support</Link>
        </div>
      </div>
    </DashboardPage>
  </DashboardShell>;
}

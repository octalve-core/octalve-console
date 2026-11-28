"use client";
import {useState,useRef} from "react";
import {useRouter} from "next/navigation";
import {CommerceCheckoutFrame,CommercePanel,CheckoutColumns,CheckoutSummary,CheckoutConsent,CartItem,primary,secondary} from "@/components/shared-commerce/CommerceUI";
import type {CartView} from "@/components/shared-commerce/types";
import {formatPlanAmount} from "../data/client-order-data";
import {invoiceCheckoutHref} from "../components/commerce/invoice-links";
import {removeFromCart} from "./cart-selections";

const endpoint="/api/cloud/domains/live-registration/";
type Readiness={available:boolean;invoice_public_id?:string};
type Quote={quote:string;domain:string;amount:string;currency:string;years:number};
const validId=(id:unknown):id is string=>typeof id==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
export async function liveRegistrationReadiness(domain:string):Promise<Readiness>{
 const response=await fetch(endpoint+"?domain="+encodeURIComponent(domain),{cache:"no-store",signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error("Registration options unavailable");
 const data=await response.json();
 if(typeof data.available!=="boolean"||data.invoice_public_id!==undefined&&!validId(data.invoice_public_id))throw Error("Invalid registration options");
 return data;
}
async function submit<T>(body:Record<string,unknown>):Promise<T>{
 const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store"});
 if(!response.ok)throw Error("Registration could not be confirmed. Check your invoice before retrying.");
 return response.json();
}
export function LiveDomainRegistration({domain,existingInvoice}:{domain:string;existingInvoice?:string}){
 const router=useRouter(),running=useRef(false);
 const [quote,setQuote]=useState<Quote>(),[busy,setBusy]=useState(false),[error,setError]=useState(""),[consent,setConsent]=useState(false);
 const [operation,setOperation]=useState<"register"|"transfer">("register"),[authCode,setAuthCode]=useState("");
 const [contact,setContact]=useState({name:"",phone:"",street:"",city:"",state:"",country_code:"NG",postal_code:""});
 async function run(action:"quote"|"accept"){
  if(running.current)return;running.current=true;setBusy(true);setError("");
  try{
   if(action==="quote"){
    const result=await submit<Quote>({domain,operation});
    if(result.domain!==domain||result.currency!=="NGN"||result.years!==1||!/^\d+(?:\.\d{1,2})?$/.test(result.amount)||Number(result.amount)<=0||typeof result.quote!=="string")throw Error("Invalid quote");
    setQuote(result);
   }else if(quote&&consent){
    const result=await submit<{invoice_public_id:string;domain:string}>({quote:quote.quote,contact,consent:true,...(operation==="transfer"?{auth_code:authCode}:{})});
    if(!validId(result.invoice_public_id)||result.domain!==domain)throw Error("Invoice mismatch");
    setAuthCode("");
    try{await removeFromCart("domain:"+domain);}catch{/* Accepted invoice is preserved. */}
    router.replace(invoiceCheckoutHref(result.invoice_public_id));
   }
  }catch{setError("Registration could not be confirmed. Check your existing invoices before retrying.");}
  finally{running.current=false;setBusy(false);}
 }
 const amount=quote?formatPlanAmount(Number(quote.amount),"NGN"):"Awaiting quote";
 const line={id:"domain:"+domain,kind:"domain" as const,name:domain,description:"Live domain registration",period:"1 year",priceLabel:amount,domain};
 const cart:CartView={lines:[line],subtotal:amount,tax:quote?formatPlanAmount(0,"NGN"):"—",total:amount,busy,error,checkoutAllowed:false};
 return <CommerceCheckoutFrame stage={1} title="Domain registration" back={()=>router.push("/client/order/checkout?view=cart")} backLabel="Back to cart">
  {existingInvoice&&validId(existingInvoice)?<CommercePanel><p>An existing registration invoice is available. Continue it instead of creating another order.</p><button type="button" className={primary+" mt-3"} onClick={()=>router.push(invoiceCheckoutHref(existingInvoice))}>Continue invoice</button></CommercePanel>:<CheckoutColumns summary={<CheckoutSummary cart={cart}>
   <label className="block text-sm">Domain operation<select value={operation} disabled={busy} onChange={e=>{setOperation(e.target.value as "register"|"transfer");setQuote(undefined);setAuthCode("");setConsent(false)}} className="block w-full rounded border p-2"><option value="register">Register new domain</option><option value="transfer">Transfer existing domain (ResellerClub)</option></select></label><p className="text-sm">Real payment is required. The registrar must confirm fulfillment after payment. Contact information is shared with the registrar under its registration agreement.</p>
   {!quote?<button type="button" disabled={busy} className={primary+" w-full"} onClick={()=>void run("quote")}>Check availability and price</button>:<><CheckoutConsent checked={consent} onChange={setConsent} disabled={busy}/><button type="submit" form="live-domain-contact" disabled={!consent||busy} className={primary+" w-full"}>Create invoice</button><button type="button" disabled={busy} className={secondary+" w-full"} onClick={()=>void run("quote")}>Refresh quote</button></>}
   {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  </CheckoutSummary>}>
   <CartItem line={line} readOnly remove={()=>{}} configure={()=>{}}/>
   {quote&&<CommercePanel><form id="live-domain-contact" onSubmit={e=>{e.preventDefault();void run("accept");}} className="grid gap-3 sm:grid-cols-2"><h2 className="font-medium sm:col-span-2">Registrant details</h2><p className="text-sm sm:col-span-2">Your verified account email will be supplied to the registrar. Enter the actual domain holder's details.</p>
    {([["name","Full legal name"],["phone","Phone (e.g. +234.8012345678)"],["street","Street address"],["city","City"],["state","State"],["country_code","Two-letter country code"],["postal_code","Postal code"]] as const).map(([key,label])=><label key={key} className="block text-sm">{label}<input required maxLength={key==="country_code"?2:200} value={contact[key]} onChange={e=>setContact(old=>({...old,[key]:key==="country_code"?e.target.value.toUpperCase():e.target.value}))} disabled={busy} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3"/></label>)}
    {operation==="transfer"?<label className="block text-sm sm:col-span-2">Transfer authorization code<input type="password" autoComplete="off" required value={authCode} onChange={e=>setAuthCode(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border px-3"/></label>:null}
   </form></CommercePanel>}
  </CheckoutColumns>}
 </CommerceCheckoutFrame>;
}

"use client";
import {useState,useRef,useEffect} from "react";
import {useRouter} from "next/navigation";
import {CommercePanel,CheckoutColumns,CheckoutSummary,CartItem,CheckoutConsent,primary,secondary} from "@/components/shared-commerce/CommerceUI";
import type {CartView,CartLine} from "@/components/shared-commerce/types";
import {formatPlanAmount} from "../data/client-order-data";
import {invoiceCheckoutHref} from "../components/commerce/invoice-links";
import {cartSelectionId,removePurchasedItems,type CartSelection} from "./cart-selections";
type Quote={quote:string;total:string;currency:string;lines:{name:string;amount:string;kind:string;period:string;domain?:string}[]};
const url="/api/cloud/domains/live-cart/";
async function post(body:Record<string,unknown>){const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store"});if(!r.ok)throw Error();return r.json();}
export function LiveCartReview({items}:{items:CartSelection[]}){
 const router=useRouter(),running=useRef(false),key=useRef("");
 const [q,setQ]=useState<Quote>(),[busy,setBusy]=useState(false),[error,setError]=useState(""),[consent,setConsent]=useState(false);
 const [contact,setContact]=useState({name:"",phone:"",street:"",city:"",state:"",country_code:"NG",postal_code:""});
 async function refresh(){if(running.current)return;running.current=true;setBusy(true);setError("");try{const domains=items.flatMap(i=>i.kind==="domain"?[i.domain]:[]);const services=items.flatMap(i=>i.kind==="service"?[{plan_id:Number(i.plan),offer_revision:i.revision,cycle_key:i.cycle,domain_name:i.domain??"",quantity:1}]:[]);const result:Quote=await post({domains,services});if(result.currency!=="NGN"||!result.quote||!Array.isArray(result.lines)||Number(result.total)<=0)throw Error();setQ(result);key.current=crypto.randomUUID();}catch{setError("Live quotation unavailable. Review your cart.");}finally{running.current=false;setBusy(false)}}
 useEffect(()=>{void refresh()},[]);
 async function accept(){if(running.current||!q||!consent)return;running.current=true;setBusy(true);setError("");try{const result=await post({quote:q.quote,contact,checkout_id:key.current,consent:true});if(typeof result.invoice_public_id!=="string"||!/^[0-9a-f-]{36}$/.test(result.invoice_public_id))throw Error();try{await removePurchasedItems(items.map(cartSelectionId))}catch{}router.replace(invoiceCheckoutHref(result.invoice_public_id));}catch{setError("Invoice creation could not be confirmed. Check existing invoices before retrying.");}finally{running.current=false;setBusy(false)}}
 const lines:CartLine[]=(q?.lines??[]).map((l,i)=>({id:String(i),kind:l.kind==="domain"?"domain":"hosting",name:l.name,description:"",period:l.period,domain:l.domain,priceLabel:formatPlanAmount(Number(l.amount),"NGN")}));
 const amount=q?formatPlanAmount(Number(q.total),"NGN"):"Awaiting quote";const cart:CartView={lines,subtotal:amount,tax:q?formatPlanAmount(0,"NGN"):"—",total:amount,busy,error,checkoutAllowed:false};
 return <CheckoutColumns summary={<CheckoutSummary cart={cart}><p className="text-sm">Live payment. Registrar and hosting confirmations are tracked separately. Your registrant details are shared with the selected registrar under its registration agreement.</p>{q?<><CheckoutConsent checked={consent} onChange={setConsent} disabled={busy}/><button className={primary+" w-full"} type="submit" form="live-basket-contact" disabled={busy||!consent}>Create invoice</button></>:<button className={secondary} disabled={busy} onClick={()=>void refresh()}>Refresh quote</button>}{error?<p role="alert">{error}</p>:null}</CheckoutSummary>}>{lines.map(line=><CartItem key={line.id} line={line} readOnly remove={()=>{}} configure={()=>{}}/>)}{q?<CommercePanel><form id="live-basket-contact" className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();void accept()}}><h3 className="font-medium sm:col-span-2">Registrant details</h3>{(["name","phone","street","city","state","country_code","postal_code"] as const).map(field=><label key={field} className="block text-sm">{field.replaceAll("_"," ")}<input required maxLength={field==="country_code"?2:200} value={contact[field]} onChange={e=>setContact(c=>({...c,[field]:e.target.value}))} className="block w-full rounded border p-2"/></label>)}</form></CommercePanel>:null}</CheckoutColumns>
}

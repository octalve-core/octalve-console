"use client";
import {useEffect,useState} from "react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DomainSandboxPurchase} from "../components/DomainSandboxPurchase";
import {LiveDomainRegistration,liveRegistrationReadiness} from "./LiveDomainRegistration";

export function DomainCheckout({domain,invoiceId}:{domain?:string;invoiceId?:number}){
 const [mode,setMode]=useState<"checking"|"live"|"test"|"unavailable">("checking");
 const [existing,setExisting]=useState<string>();
 useEffect(()=>{
  let current=true;
  if(!domain||invoiceId){setMode("test");return;}
  setMode("checking");
  void liveRegistrationReadiness(domain).then(result=>{if(current){setExisting(result.invoice_public_id);setMode(result.available?"live":"test");}}).catch(()=>{if(current)setMode("unavailable");});
  return()=>{current=false;};
 },[domain,invoiceId]);
 return <DashboardShell role="client" title="Checkout" description="Review your domain order.">
  {mode==="checking"?<p role="status">Checking registration options…</p>:mode==="unavailable"?<p role="alert">Registration options could not be confirmed. Refresh before continuing.</p>:mode==="live"&&domain?<LiveDomainRegistration key={domain} domain={domain} existingInvoice={existing}/>:<DomainSandboxPurchase key={invoiceId??domain??"existing-test-order"} domain={domain} invoiceId={invoiceId} checkoutPage/>}
 </DashboardShell>;
}

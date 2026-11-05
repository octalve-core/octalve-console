"use client";

import {useState,type FormEvent} from "react";
import {ShieldCheck,ShieldAlert} from "lucide-react";
import {api} from "@/lib/api/client";

type Quote={
  verified:true;provider:"cloudflare-registrar";domain:string;
  availability:{name:string;registrable:boolean;tier?:string;currency?:string;
   registration_cost?:string;renewal_cost?:string;reason?:string};
  supplier_price_only:true;quote_is_retail_offer:false;checkout_enabled:false;
  registration_enabled:false;execution_enabled:false;checked_at:string;expires_at:string;
};

export function RegistrarQuotePanel({connectionId}:{connectionId:string}){
 const [working,setWorking]=useState(false);
 const [result,setResult]=useState<Quote|null>(null);
 const [error,setError]=useState("");
 async function check(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(working)return;
  const form=event.currentTarget;
  const input=new FormData(form);
  const domain=String(input.get("domain")||"").trim().toLowerCase();
  const confirm_password=String(input.get("confirm_password")||"");
  const totp_code=String(input.get("totp_code")||"");
  form.reset();setWorking(true);setError("");setResult(null);
  try{
   const response=await api.post<Quote>(
    "/providers/connections/"+encodeURIComponent(connectionId)+"/registrar-quote/",
    {domain,confirm_password,totp_code}
   );
   if(response.verified!==true||response.domain!==domain||
     response.checkout_enabled!==false||response.registration_enabled!==false||
     response.execution_enabled!==false||response.quote_is_retail_offer!==false||
     response.supplier_price_only!==true||
     response.availability?.name!==domain||typeof response.availability.registrable!=="boolean")
    throw Error("Unexpected registrar response");
   setResult(response);
  }catch{
   setError("The live quote could not be verified. This provider may not yet be approved for readback. No purchase was made.");
  }finally{setWorking(false);}
 }
 const inputStyle="min-h-11 w-full rounded-lg border border-console-line bg-white px-3 text-sm text-console-ink focus-visible:outline-2 focus-visible:outline-console-primary";
 return <section aria-label="Live registrar price check" className="mt-3 space-y-3 rounded-xl border border-console-line bg-white p-3">
  <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-console-primary" aria-hidden="true"/><h4 className="text-sm font-medium">Live domain availability and supplier quote</h4></div>
  <p className="text-xs leading-5 text-console-muted">
   Read-only lookup for .com and .net domains. Prices are supplier costs, not Octalve sale prices.
   Purchasing, registration, contact changes and DNS modifications remain disabled.
  </p>
  <form onSubmit={check} className="space-y-3" autoComplete="off">
   <label className="block text-xs">Domain to check
    <input type="text" name="domain" required maxLength={253} placeholder="candidate-example.com" spellCheck={false} autoCapitalize="off" autoComplete="off" className={inputStyle}/>
   </label>
   <label className="block text-xs">Current Super Admin password
    <input type="password" name="confirm_password" required autoComplete="off" className={inputStyle}/>
   </label>
   <label className="block text-xs">Fresh authenticator code
    <input type="text" name="totp_code" required pattern="[0-9]{6}" maxLength={6} inputMode="numeric" autoComplete="one-time-code" className={inputStyle}/>
   </label>
   <button type="submit" disabled={working} className="min-h-11 w-full rounded-lg bg-console-primary px-3 py-2 text-xs font-medium text-white disabled:opacity-50">
    {working?"Checking supplier…":"Check live availability only"}
   </button>
  </form>
  {result?<div role="status" className="space-y-1 rounded-lg bg-slate-50 p-3 text-xs">
   <p className="font-medium">{result.domain}: {result.availability.registrable?"Available for registration at supplier":"Not registrable through provider"}</p>
   {result.availability.registrable?<p>Supplier registration: {result.availability.currency} {result.availability.registration_cost} · Renewal: {result.availability.currency} {result.availability.renewal_cost}</p>
   :<p>Provider reason: {result.availability.reason||"Not available"}</p>}
   <p className="text-console-muted">Lookup valid for up to five minutes. Not an offer, invoice, payment approval or registration receipt.</p>
  </div>:null}
  {error?<p role="alert" className="flex gap-2 text-xs text-rose-700"><ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true"/>{error}</p>:null}
 </section>;
}

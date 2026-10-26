"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {Globe2,ShieldCheck} from "lucide-react";
import {DomainSearchForm} from "./domain-search/DomainSearchForm";
import {DomainSearchResult} from "./domain-search/DomainSearchResult";
import type {DomainLookup} from "./domain-search/domain-types";
import {Panel} from "@/components/design-system/Panel";
import {SectionHeading} from "@/components/design-system/SectionHeading";

const API_BASE=process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/,"")||"https://api.cloud.octalve.com/api";
export function ClientDomainSearch(){
 const [domain,setDomain]=useState(""),[result,setResult]=useState<DomainLookup|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const abort=useRef<AbortController|null>(null);
 useEffect(()=>{
   const input=new URLSearchParams(window.location.search).get("domain");
   if(input)setDomain(input.slice(0,253));
   return ()=>abort.current?.abort();
 },[]);
 async function submit(event:FormEvent<HTMLFormElement>){
   event.preventDefault();abort.current?.abort();
   const next=new AbortController();abort.current=next;
   setBusy(true);setError("");setResult(null);
   const clean=domain.trim().toLowerCase().replace(/^https?:\/\//,"").replace(/\/$/,"");
   try{
     const url=`${API_BASE}/storefront/domains/lookup/?domain=${encodeURIComponent(clean)}`;
     const response=await fetch(url,{signal:next.signal,credentials:"omit",cache:"no-store"});
     if(!response.ok)throw new Error(response.status===400?"Enter a valid domain name, for example yourbrand.com.":"Domain search is temporarily unavailable.");
     const data=await response.json() as DomainLookup;
     if(!next.signal.aborted)setResult(data);
   }catch(e){if(!next.signal.aborted)setError(e instanceof Error?e.message:"Domain search is temporarily unavailable.");}
   finally{if(!next.signal.aborted)setBusy(false);}
 }
 return <Panel padded={false} id="domain-search" aria-label="Find and check a domain name"
   className="scroll-mt-24 overflow-hidden">
   <div className="border-b border-slate-200 bg-slate-50 px-5 py-6 text-slate-950 sm:px-7 sm:py-7">
     <div className="flex items-start gap-3">
       <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
         <Globe2 className="h-5 w-5" aria-hidden="true"/>
       </span>
       <SectionHeading className="min-w-0" eyebrow="Domain search" title="Find the right domain for your business."
         description="Search an extension and review our published registration rates."/>
     </div>
   </div>
   <div className="px-5 py-5 sm:px-7 sm:py-6">
     <DomainSearchForm domain={domain} onChange={setDomain} busy={busy} onSubmit={submit}/>
     <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-[#64748B]">
       <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0064E0]"/>
       Domain availability and final charges require registrar verification before checkout.
     </p>
     {error&&<p role="alert" className="mt-4 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
   </div>
   {result&&<DomainSearchResult value={result}/>}
 </Panel>;
}

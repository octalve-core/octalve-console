"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import Link from "next/link";
import {ArrowLeftRight,Globe2,ShieldCheck} from "lucide-react";
import {DomainBundleImport} from "./domain-search/DomainBundleImport";
import {DomainSearchForm} from "./domain-search/DomainSearchForm";
import {DomainSearchResult} from "./domain-search/DomainSearchResult";
import {PublishedDomainCatalogue} from "./domain-search/PublishedDomainCatalogue";
import type {DomainLookup,PublishedDomainPrice} from "./domain-search/domain-types";
import {Panel} from "@/components/design-system/Panel";
import {SectionHeading} from "@/components/design-system/SectionHeading";

const API_BASE=process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/,"")||"https://api.cloud.octalve.com/api";
export function ClientDomainSearch({onAdded,discovery=false}: {onAdded?: () => void;discovery?:boolean} = {}){
 const [domain,setDomain]=useState(""),[result,setResult]=useState<DomainLookup|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const [catalogue,setCatalogue]=useState<{currency:string;tlds:PublishedDomainPrice[]}>();
 const [catalogueFailed,setCatalogueFailed]=useState(false);
 const searchArea=useRef<HTMLDivElement|null>(null);
 useEffect(()=>{
   if(!discovery)return;
   const controller=new AbortController();
   void fetch(`${API_BASE}/storefront/domains/prices/`,{signal:controller.signal,credentials:"omit"})
     .then(async response=>{
       if(!response.ok)throw new Error("Catalogue unavailable");
       const data=await response.json() as {currency:string;tlds:PublishedDomainPrice[]};
       if(!Array.isArray(data.tlds)||typeof data.currency!=="string")throw new Error("Catalogue unavailable");
       if(!controller.signal.aborted)setCatalogue(data);
     }).catch(()=>{if(!controller.signal.aborted)setCatalogueFailed(true);});
   return ()=>controller.abort();
 },[discovery]);
 function selectTld(tld:string){
   setDomain(value=>{
     const input=value.trim().toLowerCase().replace(/^https?:\/\//,"").replace(/\/$/,"");
     const base=input.startsWith(".")?"":input.split(".")[0];
     return base?base+tld:tld;
   });
   searchArea.current?.querySelector("input")?.focus();
 }
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
 return <div className="min-w-0 space-y-6">{discovery&&<DomainBundleImport/>}<Panel padded={false} id="domain-search" aria-label="Find and check a domain name"
   className="scroll-mt-24 overflow-hidden">
   {discovery?<div ref={searchArea} className="relative isolate overflow-hidden rounded-[22px] bg-[#123bc4] px-4 py-7 text-white sm:px-8 sm:py-10">
     <div className="mx-auto max-w-4xl">
       <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">Find your perfect domain</h2>
       <p className="mb-5 mt-2 text-sm leading-6 text-blue-100">Your next big idea starts with the right domain name.</p>
       <DomainSearchForm domain={domain} onChange={setDomain} busy={busy} onSubmit={submit}/>
       <div className="mt-3 flex flex-wrap items-center gap-2">
         {catalogue?.tlds.slice(0,6).map(price=><button key={price.tld} type="button" onClick={()=>selectTld(price.tld)} className="min-h-11 rounded-lg border border-white/40 px-3 text-sm hover:bg-white/15">{price.tld}</button>)}
         <Link href="/client/domains/transfer" className="inline-flex min-h-11 items-center gap-2 px-2 text-sm underline underline-offset-4"><ArrowLeftRight aria-hidden="true" size={16}/>Transfer a domain</Link>
       </div>
       {error&&<p role="alert" className="mt-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
     </div>
   </div>:<>
   <div className="border-b border-slate-200 bg-slate-50 px-5 py-6 text-slate-950 sm:px-7 sm:py-7">
     <div className="flex items-start gap-3">
       <span className="flex h-11 w-11 shrink-0 items-center justify-center text-blue-700">
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
   </>}
   {busy&&<p className="sr-only" role="status">Checking domain availability</p>}
   {result&&<DomainSearchResult value={result} onAdded={onAdded}/>}
 </Panel>
 {discovery && (catalogue?.tlds.length ? <PublishedDomainCatalogue prices={catalogue.tlds} currency={catalogue.currency} onSelect={selectTld}/>
  : <p role="status" className="text-sm text-console-muted">{catalogueFailed?"Published prices are temporarily unavailable.":catalogue?"No extensions are currently published.":"Loading published extensions…"}</p>)}
 </div>;
}

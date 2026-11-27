"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import Link from "next/link";
import {ArrowLeftRight,Globe2,ShieldCheck} from "lucide-react";
import {DomainBundleImport} from "./domain-search/DomainBundleImport";
import {DomainSearchForm} from "./domain-search/DomainSearchForm";
import {DomainDiscoveryPanel,DomainAvailabilityBanner} from "@/components/shared-commerce/DomainCommerce";
import {DomainSearchResult,DomainSearchAction} from "./domain-search/DomainSearchResult";
import {PublishedDomainCatalogue} from "./domain-search/PublishedDomainCatalogue";
import {formatDomainPrice,type DomainLookup,type PublishedDomainPrice} from "./domain-search/domain-types";
import {Panel} from "@/components/design-system/Panel";
import {SectionHeading} from "@/components/design-system/SectionHeading";

const API_BASE=process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/,"")||"https://api.cloud.octalve.com/api";
export function ClientDomainSearch({onAdded,discovery=false}: {onAdded?: () => void;discovery?:boolean} = {}){
 const [domain,setDomain]=useState(""),[result,setResult]=useState<DomainLookup|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const [catalogue,setCatalogue]=useState<{currency:string;tlds:PublishedDomainPrice[]}>();
 const [catalogueFailed,setCatalogueFailed]=useState(false);
 const [selected,setSelected]=useState(".com");
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
 function selectTld(tld:string){setSelected(tld);const base=domain.trim().toLowerCase().replace(/^https?:\/\//,"").split(".")[0];if(base){const name=base+tld;setDomain(name);void lookup(name)}else searchArea.current?.querySelector("input")?.focus();}
 const abort=useRef<AbortController|null>(null);
 useEffect(()=>{
   const input=new URLSearchParams(window.location.search).get("domain");
   if(input)setDomain(input.slice(0,253));
   return ()=>abort.current?.abort();
 },[]);
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const name=domain.includes(".")?domain:domain+selected;setDomain(name);await lookup(name);}
 async function lookup(value:string){
   abort.current?.abort();
   const next=new AbortController();abort.current=next;
   setBusy(true);setError("");setResult(null);
   const clean=value.trim().toLowerCase().replace(/^https?:\/\//,"").replace(/\/$/,"");
   try{
     const url=`${API_BASE}/storefront/domains/lookup/?domain=${encodeURIComponent(clean)}`;
     const response=await fetch(url,{signal:AbortSignal.any([next.signal,AbortSignal.timeout(15000)]),credentials:"omit",cache:"no-store"});
     if(!response.ok)throw new Error(response.status===400?"Enter a valid domain name, for example yourbrand.com.":"Domain search is temporarily unavailable.");
     const data=await response.json() as DomainLookup;
     if(data.domain!==clean)throw Error("Mismatched domain lookup.");
     if(!next.signal.aborted){setResult(data);if(data.tld)setSelected("."+data.tld.replace(/^\./,""));}
   }catch(e){if(!next.signal.aborted)setError(e instanceof Error&&e.name==="TimeoutError"?"Domain lookup timed out. Please retry.":e instanceof Error?e.message:"Domain search is temporarily unavailable.");}
   finally{if(!next.signal.aborted)setBusy(false);}
 }
 return <div className="min-w-0 space-y-6">{discovery&&<DomainBundleImport/>}<Panel padded={false} id="domain-search" aria-label="Find and check a domain name"
   className="scroll-mt-24 overflow-hidden">
   {discovery?<div ref={searchArea}><DomainDiscoveryPanel controls={<><span className="rounded-xl border border-white/20 bg-white/5 px-3 py-2">{selected}</span><Link href="/client/domains/transfer" className="inline-flex min-h-11 items-center gap-2 text-slate-300 underline underline-offset-4"><ArrowLeftRight size={16}/>Transfer a domain</Link></>} result={<>{error&&<p role="alert" className="mt-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}{result?.registrar_connected&&result.availability==="available"&&result.registration_price&&Number(result.registration_price)>0&&result.currency&&<DomainAvailabilityBanner name={result.domain} price={formatDomainPrice(result.registration_price,result.currency)+"/yr"} renewal={result.renewal_price&&Number(result.renewal_price)>0?"Renews at "+formatDomainPrice(result.renewal_price,result.currency)+"/yr":undefined} action={<DomainSearchAction value={result} onAdded={onAdded}/>}/>}</>}>
 <DomainSearchForm domain={domain} onChange={value=>{abort.current?.abort();setBusy(false);setResult(null);setError("");setDomain(value)}} busy={busy} onSubmit={submit}/>
 </DomainDiscoveryPanel></div>:<>
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
     <DomainSearchForm domain={domain} onChange={value=>{abort.current?.abort();setBusy(false);setResult(null);setError("");setDomain(value)}} busy={busy} onSubmit={submit}/>
     <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-[#64748B]">
       <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0064E0]"/>
       Domain availability and final charges require registrar verification before checkout.
     </p>
     {error&&<p role="alert" className="mt-4 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
   </div>
   </>}
   {busy&&<p className="sr-only" role="status">Checking domain availability</p>}
   {result&&(!discovery||!result.registrar_connected||result.availability!=="available"||!result.registration_price||Number(result.registration_price)<=0||!result.currency)&&<DomainSearchResult value={result} onAdded={onAdded}/>}
   {result&&result.registrar_connected&&["registered","unavailable"].includes(result.availability)&&<div className="mx-4 mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:mx-6"><h3 className="font-medium">Try another name</h3><p className="mt-1 text-sm text-slate-600">These are name ideas, not confirmed availability. Select one to check the registrar.</p><div className="mt-3 flex flex-wrap gap-2">{[result.domain.split(".")[0]+"hq.com","get"+result.domain.split(".")[0]+".com",result.domain.split(".")[0]+"online.com"].filter(name=>name.length<=67).map(name=><button key={name} type="button" className="min-h-11 break-all rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-blue-700" onClick={()=>{setDomain(name);void lookup(name)}}>{name}</button>)}</div><Link href="/client/domains/transfer" className="mt-3 inline-flex min-h-11 items-center text-sm text-blue-700">Already own this domain? Explore transfer</Link></div>}
 </Panel>
 {discovery && (catalogue?.tlds.length ? <PublishedDomainCatalogue prices={catalogue.tlds} currency={catalogue.currency} selected={selected} onSelect={selectTld} renderAction={tld=>result?.tld&&"."+result.tld.replace(/^\./,"")===tld&&result.registrar_connected&&result.availability==="available"?<div className="mt-2"><DomainSearchAction value={result} onAdded={onAdded}/></div>:null}/>
  : <p role="status" className="text-sm text-console-muted">{catalogueFailed?"Published prices are temporarily unavailable.":catalogue?"No extensions are currently published.":"Loading published extensions…"}</p>)}
 </div>;
}

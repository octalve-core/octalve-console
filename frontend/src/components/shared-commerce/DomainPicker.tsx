"use client";

import {useEffect,useId,useRef,useState} from "react";
import {ArrowUp,Check,ChevronDown,Globe2,Plus,Search,X} from "lucide-react";
import type {DomainPickerActions,DomainPickerOffer} from "./types";
import {canSelectOffer,uniquePickerOffers} from "./domain-picker-model";

type Props={lineId:string;serviceName:string;value?:string;domains:readonly string[];busy?:boolean;configure:(id:string,domain:string)=>void|Promise<void>;actions?:DomainPickerActions};
const focus="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0064E0]";
const action="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0064E0] px-4 py-2 text-sm font-medium text-white hover:bg-[#0054BC] disabled:cursor-not-allowed disabled:opacity-50 "+focus;

export function DomainPicker({lineId,serviceName,value,domains,busy,configure,actions}:Props){
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),closeButton=useRef<HTMLButtonElement>(null);
 const active=useRef<AbortController|null>(null),applying=useRef(false);
 const title=useId(),description=useId(),inputId=useId();
 const [open,setOpen]=useState(false),[tab,setTab]=useState<"cart"|"search">("cart");
 const [query,setQuery]=useState(""),[results,setResults]=useState<readonly DomainPickerOffer[]>([]);
 const [loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[searched,setSearched]=useState(false),[error,setError]=useState("");
 const options=[...new Set(domains)];
 function invalidate(){active.current?.abort();active.current=null;setLoading(false);setSearched(false);setResults([]);setError("")}
 function dismiss(){if(applying.current)return;invalidate();setOpen(false)}
 function show(){if(busy)return;invalidate();setTab(options.length||!actions?"cart":"search");setQuery("");setOpen(true)}
 useEffect(()=>{
  const d=dialog.current;if(!d)return;
  if(open&&!d.open){d.showModal();closeButton.current?.focus()}
  if(!open&&d.open){d.close();trigger.current?.focus()}
 },[open]);
 useEffect(()=>{if(!open)return;const previous=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.body.style.overflow=previous}},[open]);
 useEffect(()=>()=>{active.current?.abort();active.current=null},[]);
 async function search(){
  if(!actions||applying.current)return;
  invalidate();
  if(!query.trim()){setError("Enter a domain or business name.");return}
  const c=new AbortController();active.current=c;setLoading(true);
  try{
   const items=await actions.search(query,"",c.signal);
   if(active.current!==c||c.signal.aborted)return;
   setResults(uniquePickerOffers(items));setSearched(true);
  }catch(e){if(active.current===c&&!c.signal.aborted)setError(e instanceof Error?e.message:"Domain search is temporarily unavailable.")}
  finally{if(active.current===c){active.current=null;setLoading(false)}}
 }
 async function apply(domain:string,offer?:DomainPickerOffer){
  if(applying.current||busy)return;
  if(offer&&(!actions||!canSelectOffer(offer)||offer.domain!==domain))return;
  if(!offer&&domain&&!options.includes(domain))return;
  applying.current=true;setSaving(true);setError("");
  try{
   if(offer&&actions&&!options.includes(domain))await actions.addAndConfigure(lineId,domain);
   else await configure(lineId,domain);
   invalidate();setOpen(false);
  }catch(e){setError(e instanceof Error?e.message:"Could not connect this domain. Please retry.")}
  finally{applying.current=false;setSaving(false)}
 }
 return <div className="mt-4">
  <span className="block text-sm text-slate-600">Connected domain</span>
  <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open} aria-label={"Choose domain for "+serviceName} disabled={busy} onClick={show} className={"mt-2 flex min-h-12 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-blue-300 disabled:opacity-50 "+focus}>
   <Globe2 size={18} className="shrink-0 text-[#0064E0]" aria-hidden="true"/><span className="min-w-0 flex-1 break-all">{value||"Choose or search for a domain"}</span>{value?<span className="shrink-0 text-xs text-[#0064E0]">Change</span>:<ChevronDown size={16} className="shrink-0 text-slate-500" aria-hidden="true"/>}
  </button>
  <dialog ref={dialog} aria-labelledby={title} aria-describedby={description} onCancel={e=>{e.preventDefault();dismiss()}} onClose={()=>{if(open)dismiss()}} className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none overflow-hidden rounded-t-[24px] border-0 bg-white p-0 text-[#000A16] shadow-2xl backdrop:bg-black/45 sm:inset-0 sm:m-auto sm:max-h-[85dvh] sm:w-[min(640px,calc(100%-2rem))] sm:rounded-[24px]">
   <div className="flex max-h-[90dvh] flex-col sm:max-h-[85dvh]">
    <header className="shrink-0 border-b border-slate-100 px-5 pb-4 pt-3 sm:p-6">
     <div aria-hidden="true" className="mx-auto mb-3 h-1 w-9 rounded-full bg-slate-300 sm:hidden"/>
     <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 id={title} className="text-xl font-medium tracking-tight">Choose a domain</h2><p id={description} className="mt-1 break-words text-sm text-slate-500">Connect a domain to {serviceName}.</p></div><button ref={closeButton} type="button" aria-label="Close domain picker" disabled={saving} onClick={dismiss} className={"grid h-11 w-11 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 "+focus}><X size={21}/></button></div>
     <div role="group" aria-label="Domain source" className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-[#F1F5F9] p-1">
      <button type="button" disabled={saving} aria-pressed={tab==="cart"} onClick={()=>{invalidate();setTab("cart")}} className={"min-h-11 rounded-lg px-2 text-sm "+(tab==="cart"?"bg-white font-medium text-[#0064E0] shadow-sm":"text-slate-600")+" "+focus}>In your cart ({options.length})</button>
      <button type="button" disabled={!actions||saving} aria-pressed={tab==="search"} onClick={()=>{invalidate();setTab("search")}} className={"min-h-11 rounded-lg px-2 text-sm disabled:opacity-50 "+(tab==="search"?"bg-white font-medium text-[#0064E0] shadow-sm":"text-slate-600")+" "+focus}>Search new domain</button>
     </div>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
     {tab==="cart"?<div className="space-y-2">
      {options.length===0?<div className="rounded-xl border border-dashed border-slate-200 p-5 text-center"><Globe2 className="mx-auto text-slate-400" size={28}/><p className="mt-3 text-sm text-slate-600">No domains in your cart yet.</p>{actions&&<button type="button" onClick={()=>setTab("search")} className={"mt-3 min-h-11 text-sm text-[#0064E0] "+focus}>Search for a new domain</button>}</div>:options.map(domain=><button key={domain} type="button" disabled={saving||busy} onClick={()=>void apply(domain)} className={"flex min-h-14 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-blue-300 disabled:opacity-50 "+focus}><Globe2 size={18} className="shrink-0 text-[#0064E0]"/><span className="min-w-0 flex-1 break-all text-sm font-medium">{domain}</span>{domain===value?<Check size={18} className="shrink-0 text-[#0064E0]"/>:<span className="shrink-0 text-xs text-[#0064E0]">Use domain</span>}</button>)}
     </div>:<>
      <form onSubmit={e=>{e.preventDefault();void search()}} className="rounded-2xl bg-[#141414] p-2 text-white">
       <label htmlFor={inputId} className="sr-only">Domain or business name</label>
       <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-[#202020] p-2 focus-within:border-violet-400"><Search size={18} className="ml-1 shrink-0 text-violet-300" aria-hidden="true"/><input id={inputId} value={query} onChange={e=>{invalidate();setQuery(e.target.value)}} maxLength={253} disabled={saving} autoCapitalize="none" autoComplete="off" spellCheck={false} placeholder="Find your domain…" className="h-11 min-w-0 flex-1 border-0 bg-transparent px-1 text-base text-white outline-none placeholder:text-zinc-400 focus:ring-0"/><button type="submit" disabled={saving||loading||!query.trim()} aria-label="Search domain availability" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#A05ACC] text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><ArrowUp size={19}/></button></div>
      </form>
      {loading&&<p role="status" className="mt-4 text-sm text-slate-500">Checking availability and published prices…</p>}
      {searched&&<div className="mt-4 space-y-2"><p role="status" className="text-xs text-slate-500">{results.length?"Select an available domain.":"No verified results returned."}</p>{results.map(offer=>{const inCart=options.includes(offer.domain),allowed=inCart||canSelectOffer(offer);return <article key={offer.domain} className="rounded-xl border border-slate-200 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 flex-1"><p className="break-all text-sm font-medium">{offer.domain}</p><p className="mt-1 text-sm text-slate-600">{offer.priceLabel}</p>{offer.renewalLabel&&<p className="mt-1 text-xs text-slate-500">{offer.renewalLabel}</p>}<p className={"mt-1 text-xs "+(offer.available===true?"text-emerald-700":offer.available===false?"text-rose-700":"text-amber-700")}>{inCart?"Already in cart":offer.available===true?(offer.selectable?"Available":"Not eligible to add"):offer.available===false?"Unavailable":"Availability unverified"}</p></div><button type="button" disabled={!allowed||saving||busy} onClick={()=>void apply(offer.domain,inCart?undefined:offer)} className={action}>{inCart?"Use domain":allowed?"Add & connect":"Cannot add"}{allowed&&<Plus size={14} aria-hidden="true"/>}</button></div>{allowed&&!inCart&&offer.checkoutEnabled!==true&&<p className="mt-2 text-xs text-slate-500">Draft selection only. Live checkout not qualified.</p>}</article>})}</div>}
      {searched&&results.length>0&&<p className="mt-4 text-xs leading-5 text-slate-500">Availability and pricing may change. Adding a domain does not reserve it.</p>}
     </>}
     {error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
     {saving&&<p role="status" className="mt-3 text-sm text-slate-600">Connecting domain…</p>}
    </div>
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6"><button type="button" disabled={saving||busy} onClick={()=>void apply("")} className={"min-h-11 text-sm text-slate-600 hover:text-[#0064E0] "+focus}>Choose a domain later</button><button type="button" disabled={saving} onClick={dismiss} className={"min-h-11 rounded-xl border border-slate-200 px-5 text-sm font-medium "+focus}>Cancel</button></footer>
   </div>
  </dialog>
 </div>
}

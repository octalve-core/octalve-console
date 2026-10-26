import {Search,ArrowRight,Globe2} from "lucide-react";
import type {FormEvent} from "react";

export function DomainSearchForm({domain,onChange,busy,onSubmit}:{
 domain:string;onChange:(text:string)=>void;busy:boolean;onSubmit:(event:FormEvent<HTMLFormElement>)=>void;
}){
 return <form onSubmit={onSubmit} className="grid min-w-0 gap-3 sm:grid-cols-3" aria-label="Domain search">
  <div className="flex h-14 min-h-14 w-full min-w-0 items-center sm:col-span-2 gap-3 rounded-xl border border-slate-200 bg-white px-4 shadow-sm transition focus-within:border-[#0064E0] focus-within:ring-2 focus-within:ring-blue-100">
   <label htmlFor="client-domain-search" className="sr-only">Enter a domain name</label>
   <Globe2 aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-500"/>
   <input id="client-domain-search" required maxLength={253} type="search" autoComplete="off" spellCheck={false}
    value={domain} onChange={e=>onChange(e.target.value)}
    placeholder="Find yourbusiness.com"
    className="block h-12 min-h-12 w-full min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-base font-medium text-slate-950 placeholder:font-normal placeholder:text-slate-400 focus:outline-none"/>
  </div>
  <button type="submit" disabled={busy}
   className="inline-flex h-14 w-full min-w-0 items-center justify-center gap-2 rounded-xl bg-[#0064E0] px-8 text-sm font-bold text-white shadow-sm transition hover:bg-[#0052B8] disabled:cursor-not-allowed disabled:opacity-60">
   <Search className="h-4 w-4"/>{busy?"Checking domain…":"Search domain"}<ArrowRight className="h-4 w-4"/>
  </button>
 </form>;
}

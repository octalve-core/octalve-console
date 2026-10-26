import {Search,ArrowRight,Globe2} from "lucide-react";
import type {FormEvent} from "react";

export function DomainSearchForm({domain,onChange,busy,onSubmit}:{
 domain:string;onChange:(text:string)=>void;busy:boolean;onSubmit:(event:FormEvent<HTMLFormElement>)=>void;
}){
 return <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-stretch" aria-label="Domain search">
  <label className="relative block min-w-0 flex-1">
   <span className="sr-only">Enter a domain name</span>
   <Globe2 className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#64748B]"/>
   <input required maxLength={253} type="search" autoComplete="off" spellCheck={false}
    value={domain} onChange={e=>onChange(e.target.value)}
    placeholder="Find yourbusiness.com"
    className="block h-14 w-full rounded-xl border border-[#DCE6F2] bg-white pl-12 pr-4 text-base font-medium text-[#13243B] placeholder:font-normal placeholder:text-[#93A1B5] outline-none transition focus:border-[#0064E0] focus:ring-2 focus:ring-blue-100"/>
  </label>
  <button type="submit" disabled={busy}
   className="inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0064E0] px-8 text-sm font-bold text-white shadow-sm transition hover:bg-[#0052B8] disabled:cursor-not-allowed disabled:opacity-60">
   <Search className="h-4 w-4"/>{busy?"Checking domain…":"Search domain"}<ArrowRight className="h-4 w-4"/>
  </button>
 </form>;
}

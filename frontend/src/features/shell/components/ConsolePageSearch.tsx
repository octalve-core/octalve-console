"use client";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {Search} from "lucide-react";
import {useId,useMemo,useState} from "react";
import {getDashboardNavGroups,type DashboardRole} from "@/lib/navigation/dashboard-nav";
import {useLocale} from "@/lib/i18n/LocaleProvider";
import {messages,translateNavigationLabel} from "@/lib/i18n/dictionary";

export function ConsolePageSearch({role,onNavigate}:{
 role:DashboardRole;onNavigate?:()=>void;
}){
 const router=useRouter(),resultsId=useId();
 const {locale}=useLocale(),m=messages(locale);
 const [query,setQuery]=useState("");
 const pages=useMemo(()=>getDashboardNavGroups(role).flatMap(group=>group.items),[role]);
 const matches=query.trim()?pages.filter(page=>
  (page.label+" "+translateNavigationLabel(page.label,locale)+" "+(page.description??"")).toLowerCase().includes(query.trim().toLowerCase())
 ).slice(0,7):[];
 function select(href:string){setQuery("");onNavigate?.();router.push(href);}
 return <div className="relative min-w-0 w-full">
  <div className="flex h-11 items-center gap-2 rounded-xl border border-console-line bg-slate-50 px-3 focus-within:border-console-primary focus-within:ring-2 focus-within:ring-blue-100">
   <Search aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-500"/>
   <input type="search" aria-label={m.searchLabel} placeholder={m.searchHint}
    value={query} onChange={event=>setQuery(event.target.value)}
    aria-controls={resultsId} aria-expanded={matches.length>0}
    onKeyDown={event=>{if(event.key==="Escape")setQuery("");if(event.key==="Enter"&&matches[0]){event.preventDefault();select(matches[0].href);}}}
    className="h-full min-w-0 flex-1 border-0 bg-transparent text-base text-console-ink outline-none placeholder:text-slate-400 sm:text-sm"/>
  </div>
  {matches.length>0?<nav id={resultsId} aria-label={m.searchResults}
   className="absolute inset-x-0 top-12 z-50 rounded-xl border border-console-line bg-white p-2 shadow-xl">
   {matches.map(page=><Link key={page.href} href={page.href} onClick={()=>{setQuery("");onNavigate?.();}}
    className="block rounded-lg px-3 py-2.5 text-sm text-console-ink hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary">
    {translateNavigationLabel(page.label,locale)}</Link>)}
  </nav>:null}
 </div>;
}

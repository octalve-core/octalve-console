"use client";
import Link from "next/link";
import {Download,Plus,Search,SlidersHorizontal} from "lucide-react";
import type {DirectoryCreate} from "./types";
/** No Export button unless an authorized working export callback is supplied. */
export function DirectoryToolbar({label,count,query,onQuery,onFilters,create,onExport,countLabel="loaded",ordering,onOrdering}:{
 label:string;count:number;query:string;onQuery:(value:string)=>void;onFilters:()=>void;
 create?:DirectoryCreate;onExport?:()=>void;countLabel?:"loaded"|"total";ordering?:string;onOrdering?:(next:string)=>void;
}){
 return <div className="border-b border-console-line px-3 py-3 sm:px-5">
  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
   <span className="hidden shrink-0 text-xs font-medium text-console-muted sm:block">{count} {countLabel} {label.toLowerCase()}</span>
   <label className="relative min-w-0 flex-1 sm:max-w-xs">
    <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400"/>
    <span className="sr-only">Search {label}</span>
    <input type="search" value={query} onChange={e=>onQuery(e.target.value)} placeholder="Search"
     className="h-10 w-full min-w-0 rounded-lg border border-console-line bg-white pl-9 pr-3 text-[13px] text-console-ink outline-none focus:border-console-primary focus:ring-1 focus:ring-console-primary"/>
   </label>
   <div className="flex items-center gap-2 sm:ml-auto">
    {onOrdering?<label className="sr-only sm:not-sr-only sm:flex sm:items-center sm:gap-1.5">
     <span className="sr-only">Sort {label}</span>
     <select aria-label={"Sort "+label} value={ordering||"-date_joined"} onChange={e=>onOrdering(e.target.value)}
      className="h-10 min-w-0 max-w-32 rounded-lg border border-console-line bg-white px-2 text-xs text-console-ink focus-visible:ring-2 focus-visible:ring-console-primary">
      <option value="-date_joined">Newest</option><option value="date_joined">Oldest</option>
      <option value="full_name">Name A–Z</option><option value="-full_name">Name Z–A</option>
      <option value="email">Email A–Z</option>
     </select>
    </label>:null}
    {onExport?<button type="button" onClick={onExport}
     className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-console-line px-3 text-[13px] font-medium text-console-primary hover:bg-blue-50">
     <Download className="h-4 w-4" aria-hidden="true"/>Export</button>:null}
    <button type="button" onClick={onFilters} aria-label="Filter records" aria-haspopup="dialog"
     className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-console-line px-3 text-[13px] font-medium text-console-ink hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-console-primary">
     <SlidersHorizontal className="h-4 w-4" aria-hidden="true"/><span className="hidden sm:inline">Filters</span></button>
    {create?<Link href={create.href} className="hidden h-10 items-center gap-1.5 rounded-lg bg-console-primary px-4 text-[13px] font-medium text-white hover:bg-console-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-console-primary sm:inline-flex">
     <Plus className="h-4 w-4" aria-hidden="true"/>{create.label}</Link>:null}
   </div>
  </div>
  <div className="mt-2 text-xs text-console-muted sm:hidden">{count} {countLabel} {label.toLowerCase()}</div>
  {create?<Link href={create.href} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-console-primary px-4 text-[13px] font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-console-primary sm:hidden">
   <Plus className="h-4 w-4" aria-hidden="true"/>{create.label}</Link>:null}
 </div>;
}

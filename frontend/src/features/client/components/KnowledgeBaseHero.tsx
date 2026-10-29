"use client";
import {BookOpen,Search} from "lucide-react";
export function KnowledgeBaseHero({query,onQueryChange}:{
 query:string;onQueryChange:(value:string)=>void;
}){
 return <section aria-label="Search the knowledge base" className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-950 shadow-sm sm:p-8">
   <div className="flex items-start gap-4">
     <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
       <BookOpen className="h-6 w-6" aria-hidden="true"/>
     </span>
     <div className="min-w-0">
       <p className="text-xs font-medium uppercase tracking-widest text-blue-700">Octalve guides</p>
       <h2 className="mt-1 text-2xl font-medium tracking-tight text-slate-950 sm:text-3xl">How can we help you?</h2>
       <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">Find answers about hosting, DNS, domains, payments and your account.</p>
     </div>
   </div>
   <label className="mt-6 flex h-12 w-full max-w-2xl items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-500 focus-within:border-blue-600">
     <Search className="h-5 w-5 shrink-0" aria-hidden="true"/>
     <span className="sr-only">Search help articles</span>
     <input type="search" value={query} onChange={e=>onQueryChange(e.target.value)}
       placeholder="Search by question, topic or keyword"
       className="w-full min-w-0 bg-transparent text-sm text-slate-950 placeholder:text-slate-400 outline-none"/>
   </label>
 </section>;
}

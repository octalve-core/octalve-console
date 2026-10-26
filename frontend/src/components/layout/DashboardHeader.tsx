"use client";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useMemo,useState} from "react";
import {ChevronDown,LogOut,Menu,MessageSquare,Search,Settings,UserRound} from "lucide-react";
import {useAuth} from "@/context/AuthContext";
import {getDashboardNavGroups,type DashboardRole} from "@/lib/navigation/dashboard-nav";

export function DashboardHeader({role,onMenuClick,onLogout,loggingOut}:{
 role:DashboardRole;onMenuClick:()=>void;onLogout:()=>void;loggingOut:boolean;
}){
 const router=useRouter();
 const {user}=useAuth();
 const [query,setQuery]=useState(""),[open,setOpen]=useState(false);
 const nav=useMemo(()=>getDashboardNavGroups(role).flatMap(g=>g.items),[role]);
 const found=query.trim().length?nav.filter(x=>x.label.toLowerCase().includes(query.toLowerCase().trim())).slice(0,6):[];
 const display=user?.name||user?.full_name||"My account";
 const settings=role==="admin"?"/admin/settings":role==="staff"?"/staff/security":"/client/profile";
 const support=role==="admin"?"/admin/support":role==="staff"?"/staff/tickets":"/client/support";
 return <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-[#E5EBF3] bg-white px-4 sm:px-6">
   <button type="button" onClick={onMenuClick} aria-label="Open navigation"
     className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 lg:hidden">
     <Menu className="h-5 w-5"/>
   </button>
   <div className="relative hidden min-w-0 w-full max-w-md sm:block">
     <label className="relative block">
       <Search className="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-slate-400"/>
       <input type="search" aria-label="Find a workspace page" placeholder="Find a page"
         value={query} onChange={e=>setQuery(e.target.value)}
         onKeyDown={e=>{if(e.key==="Escape")setQuery("");if(e.key==="Enter"&&found[0]){router.push(found[0].href);setQuery("");}}}
         className="h-10 w-full rounded-lg border border-slate-200 bg-[#F6F8FB] pl-10 pr-4 text-sm text-[#142A43] outline-none focus:border-[#0064E0]"/>
     </label>
     {found.length>0&&<div role="navigation" aria-label="Workspace search results" className="absolute inset-x-0 top-11 z-50 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
       {found.map(x=><Link key={x.href} href={x.href} onClick={()=>setQuery("")}
         className="block rounded-lg px-3 py-2 text-xs font-semibold text-[#142A43] hover:bg-[#EAF3FF]">{x.label}</Link>)}
     </div>}
   </div>
   <div className="ml-auto flex items-center gap-2">
     <Link href={support} title="Support" aria-label="Support centre"
       className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><MessageSquare className="h-5 w-5"/></Link>
     <div className="relative border-l border-slate-200 pl-3">
       <button type="button" onClick={()=>setOpen(v=>!v)} aria-haspopup="menu" aria-expanded={open}
         aria-label="Account menu" className="flex items-center gap-2 rounded-lg p-1 hover:bg-slate-50">
         <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0064E0] text-white"><UserRound className="h-5 w-5"/></span>
         <span className="hidden max-w-40 truncate text-sm font-semibold text-slate-950 sm:block">{display}</span>
         <ChevronDown className="h-4 w-4 text-slate-500"/>
       </button>
       {open&&<>
         <button className="fixed inset-0 z-40 cursor-default" type="button" aria-label="Close account menu" onClick={()=>setOpen(false)}/>
         <div role="menu" className="absolute right-0 top-12 z-50 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
           <p className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500">{role==="client"?"Client workspace":role==="admin"?"Admin workspace":"Staff workspace"}</p>
           <Link role="menuitem" href={settings} onClick={()=>setOpen(false)}
             className="mt-1 flex items-center gap-2 rounded-lg px-3 py-3 text-sm hover:bg-slate-50"><Settings className="h-4 w-4"/>Profile and settings</Link>
           <button role="menuitem" type="button" disabled={loggingOut} onClick={()=>{setOpen(false);onLogout();}}
             className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-50"><LogOut className="h-4 w-4"/>Log out</button>
         </div>
       </>}
     </div>
   </div>
 </header>;
}

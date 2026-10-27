"use client";
import Link from "next/link";
import {Bell,Menu,MessageSquare,Search,X} from "lucide-react";
import {useState} from "react";
import {ConsoleAccountMenu} from "@/features/shell/components/ConsoleAccountMenu";
import {ConsolePageSearch} from "@/features/shell/components/ConsolePageSearch";
import type {DashboardRole} from "@/lib/navigation/dashboard-nav";
import {useLocale} from "@/lib/i18n/LocaleProvider";
import {messages} from "@/lib/i18n/dictionary";

export function DashboardHeader({role,onMenuClick,onLogout,loggingOut}:{
 role:DashboardRole;onMenuClick:()=>void;onLogout:()=>void;loggingOut:boolean;
}){
 const [searchOpen,setSearchOpen]=useState(false);
 const {locale}=useLocale(),m=messages(locale);
 const support=role==="admin"?"/admin/support":role==="staff"?"/staff/tickets":"/client/support";
 return <header className="sticky top-0 z-30 border-b border-console-line bg-white">
  <div className="flex min-h-16 items-center gap-2 px-3 sm:gap-3 sm:px-6">
   <button type="button" onClick={onMenuClick} aria-label={m.menu}
    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-console-line text-console-ink focus-visible:ring-2 focus-visible:ring-console-primary lg:hidden">
    <Menu aria-hidden="true" className="h-5 w-5"/>
   </button>
   <div className="hidden w-full max-w-md min-w-0 sm:block"><ConsolePageSearch role={role}/></div>
   <div className="ml-auto flex items-center gap-1 sm:gap-2">
    <button type="button" aria-label={searchOpen?m.searchClose:m.searchOpen}
     aria-expanded={searchOpen} onClick={()=>setSearchOpen(v=>!v)}
     className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-console-primary sm:hidden">
     {searchOpen?<X aria-hidden="true" className="h-5 w-5"/>:<Search aria-hidden="true" className="h-5 w-5"/>}
    </button>
    <Link href={support} aria-label={m.support} title={m.support}
     className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-console-primary">
     <MessageSquare aria-hidden="true" className="h-5 w-5"/>
    </Link>
    {role==="client"?<Link href="/client/notifications" aria-label={m.notifications}
      title={m.notifications} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-console-primary">
      <Bell aria-hidden="true" className="h-5 w-5"/>
    </Link>:null}
    <ConsoleAccountMenu role={role} onLogout={onLogout} loggingOut={loggingOut}/>
   </div>
  </div>
  {searchOpen?<div className="border-t border-console-line px-3 pb-3 pt-2 sm:hidden">
   <ConsolePageSearch role={role} onNavigate={()=>setSearchOpen(false)}/>
  </div>:null}
 </header>;
}

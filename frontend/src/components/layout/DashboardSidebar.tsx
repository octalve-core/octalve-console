"use client";
import Link from "next/link";
import {LifeBuoy,LogOut,X} from "lucide-react";
import {CloudBrandLogo} from "@/components/branding/CloudBrandLogo";
import {getDashboardNavGroups,type DashboardRole} from "@/lib/navigation/dashboard-nav";
import {ConsoleNavigationGroup} from "@/features/shell/components/ConsoleNavigationGroup";
import {useLocale} from "@/lib/i18n/LocaleProvider";
import {messages} from "@/lib/i18n/dictionary";

export function DashboardSidebar({role,pathname,onClose,onLogout,loggingOut}:{
 role:DashboardRole;pathname:string;onClose:()=>void;onLogout:()=>void;loggingOut:boolean;
}){
 const {locale}=useLocale(),m=messages(locale);
 const support=role==="admin"?"/admin/support":role==="staff"?"/staff/tickets":"/client/support";
 return <aside className="flex h-full min-h-0 flex-col bg-console-sidebar text-white">
  <div className="flex h-16 shrink-0 items-center justify-between border-b border-console-line bg-white pr-2">
   <CloudBrandLogo href={"/"+role}/>
   <button type="button" aria-label={m.closeSidebar} onClick={onClose}
    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-console-ink hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-console-primary lg:hidden">
    <X aria-hidden="true" className="h-5 w-5"/>
   </button>
  </div>
  <nav aria-label={role+" "+m.nav} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3">
   {getDashboardNavGroups(role).map(group=><ConsoleNavigationGroup key={group.title} group={group}
    role={role} pathname={pathname} onNavigate={onClose}/>)}
  </nav>
  <div className="shrink-0 border-t border-white/10 px-3 py-3">
   <Link href={support} onClick={onClose}
    className="flex min-h-12 items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2 text-xs text-slate-300 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white">
    <span className="rounded-xl bg-white/10 p-2 text-white"><LifeBuoy aria-hidden="true" className="h-5 w-5"/></span>
    <span><strong className="block text-sm text-white">{m.help}</strong>{m.assistance}</span>
   </Link>
   <button type="button" onClick={onLogout} disabled={loggingOut}
    className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-medium text-slate-300 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60">
    <LogOut aria-hidden="true" className="h-4 w-4"/>{loggingOut?m.loggingOut:m.logout}
   </button>
  </div>
 </aside>;
}

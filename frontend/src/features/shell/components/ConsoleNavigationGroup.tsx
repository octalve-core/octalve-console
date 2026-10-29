"use client";
import Link from "next/link";
import {ClientServicesNavigation,ClientDomainsNavigation} from "@/features/shell/components/ClientCatalogNavigation";
import {navigationIcons} from "@/features/shell/lib/navigation-icons";
import {cn} from "@/lib/utils";
import type {DashboardNavGroup,DashboardRole} from "@/lib/navigation/dashboard-nav";
import {useLocale} from "@/lib/i18n/LocaleProvider";
import {translateNavigationLabel} from "@/lib/i18n/dictionary";



export function ConsoleNavigationGroup({group,role,pathname,onNavigate}:{
 group:DashboardNavGroup;role:DashboardRole;pathname:string;onNavigate:()=>void;
}){
 const {locale}=useLocale();
 return <div>
  <h2 className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">{translateNavigationLabel(group.title,locale)}</h2>
  <ul className="space-y-1">
   {group.items.map(item=>{
    const Icon=navigationIcons[item.icon];
    const active=pathname===item.href||(item.href!=="/"+role&&pathname.startsWith(item.href+"/"));
    if (role === "client" && item.href === "/client/services") {
      return <ClientServicesNavigation key={item.href} pathname={pathname} onNavigate={onNavigate}/>;
    }
    if (role === "client" && item.href === "/client/domains") {
      return <ClientDomainsNavigation key={item.href} pathname={pathname} onNavigate={onNavigate}/>;
    }
    return <li key={item.href}>
     <Link href={item.href} onClick={onNavigate} aria-current={active?"page":undefined}
      className={cn(
       "flex min-h-10 min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
       active?"bg-console-primary text-white":"text-slate-300 hover:bg-white/10 hover:text-white"
      )}>
      <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0"/>
      <span className="min-w-0 flex-1 truncate">{translateNavigationLabel(item.label,locale)}</span>
      {item.badge?<span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px]">{item.badge}</span>:null}
     </Link>
    </li>;
   })}
  </ul>
 </div>;
}

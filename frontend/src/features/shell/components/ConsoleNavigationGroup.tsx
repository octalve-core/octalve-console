"use client";
import Link from "next/link";
import {ClientServicesNavigation,ClientDomainsNavigation} from "@/features/shell/components/ClientCatalogNavigation";
import {
 BarChart3,BookOpen,Boxes,CreditCard,Globe2,LayoutDashboard,LifeBuoy,ListChecks,
 PackageCheck,ReceiptText,Server,Settings,Shield,ShoppingCart,Ticket,UserRound,Users,
 WalletCards,Zap,type LucideIcon
} from "lucide-react";
import {cn} from "@/lib/utils";
import type {DashboardNavGroup,DashboardNavIcon,DashboardRole} from "@/lib/navigation/dashboard-nav";

const icons:Record<DashboardNavIcon,LucideIcon>={
 layoutDashboard:LayoutDashboard,users:Users,boxes:Boxes,listChecks:ListChecks,
 receiptText:ReceiptText,creditCard:CreditCard,globe2:Globe2,server:Server,
 zap:Zap,lifeBuoy:LifeBuoy,bookOpen:BookOpen,settings:Settings,shield:Shield,
 barChart3:BarChart3,walletCards:WalletCards,shoppingCart:ShoppingCart,
 userRound:UserRound,ticket:Ticket,packageCheck:PackageCheck
};

export function ConsoleNavigationGroup({group,role,pathname,onNavigate}:{
 group:DashboardNavGroup;role:DashboardRole;pathname:string;onNavigate:()=>void;
}){
 return <div>
  <h2 className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{group.title}</h2>
  <ul className="space-y-1">
   {group.items.map(item=>{
    const Icon=icons[item.icon];
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
       "flex min-h-11 min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
       active?"bg-console-primary text-white":"text-slate-300 hover:bg-white/10 hover:text-white"
      )}>
      <Icon aria-hidden="true" className="h-5 w-5 shrink-0"/>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge?<span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px]">{item.badge}</span>:null}
     </Link>
    </li>;
   })}
  </ul>
 </div>;
}

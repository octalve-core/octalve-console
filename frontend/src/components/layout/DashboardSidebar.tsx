"use client";
import Link from "next/link";
import {
 BarChart3,BookOpen,Boxes,CreditCard,Globe2,LayoutDashboard,LifeBuoy,ListChecks,
 LogOut,PackageCheck,ReceiptText,Server,Settings,Shield,ShoppingCart,Ticket,
 UserRound,Users,WalletCards,X,Zap,type LucideIcon
} from "lucide-react";
import {cn} from "@/lib/utils";
import {CloudBrandLogo} from "@/components/branding/CloudBrandLogo";
import {getDashboardNavGroups,type DashboardNavIcon,type DashboardRole} from "@/lib/navigation/dashboard-nav";

const icons:Record<DashboardNavIcon,LucideIcon>={
 layoutDashboard:LayoutDashboard,users:Users,boxes:Boxes,listChecks:ListChecks,
 receiptText:ReceiptText,creditCard:CreditCard,globe2:Globe2,server:Server,zap:Zap,
 lifeBuoy:LifeBuoy,bookOpen:BookOpen,settings:Settings,shield:Shield,
 barChart3:BarChart3,walletCards:WalletCards,shoppingCart:ShoppingCart,
 userRound:UserRound,ticket:Ticket,packageCheck:PackageCheck
};
export function DashboardSidebar({role,pathname,onClose,onLogout,loggingOut}:{
 role:DashboardRole;pathname:string;onClose:()=>void;
 onLogout:()=>void;loggingOut:boolean;
}){
 const navGroups=getDashboardNavGroups(role);
 const support=role==="admin"?"/admin/support":role==="staff"?"/staff/tickets":"/client/support";
 return <aside className="flex h-full min-h-0 flex-col bg-[#000A16] text-white">
   <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white pr-2">
     <CloudBrandLogo href={`/${role}`}/>
     <button type="button" aria-label="Close sidebar" onClick={onClose}
       className="rounded-xl p-2 text-[#142A43] hover:bg-slate-100 lg:hidden"><X className="h-5 w-5"/></button>
   </div>
   <nav aria-label={role+" workspace navigation"} className="min-h-0 flex-1 space-y-7 overflow-y-auto px-3 py-5">
     {navGroups.map(group=><div key={group.title}>
       <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">{group.title}</p>
       <div className="space-y-1">{group.items.map(item=>{
         const Icon=icons[item.icon];
         const active=pathname===item.href||(item.href!==`/${role}`&&pathname.startsWith(item.href+"/"));
         return <Link key={item.href} href={item.href} onClick={onClose}
           aria-current={active?"page":undefined}
           className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition",
             active?"bg-[#0064E0] text-white":"text-slate-300 hover:bg-white/10 hover:text-white")}>
           <Icon className="h-5 w-5 shrink-0"/><span className="truncate">{item.label}</span>
         </Link>;
       })}</div>
     </div>)}
   </nav>
   <div className="shrink-0 border-t border-white/10 px-3 py-4">
     <Link href={support} onClick={onClose} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-medium text-slate-300 hover:bg-white/10">
       <span className="rounded-xl bg-white/10 p-2 text-white"><LifeBuoy className="h-5 w-5"/></span>
       <span><strong className="block text-sm text-white">Need help?</strong>Support and assistance</span>
     </Link>
     <button type="button" onClick={onLogout} disabled={loggingOut}
       className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-xs font-semibold text-slate-300 hover:bg-white/10 disabled:opacity-60">
       <LogOut className="h-4 w-4"/>{loggingOut?"Signing out…":"Log out"}
     </button>
   </div>
 </aside>;
}

"use client";
import Link from "next/link";
import {MoreHorizontal} from "lucide-react";
import {getDashboardNavGroups,type DashboardNavItem,type DashboardRole} from "@/lib/navigation/dashboard-nav";
import {navigationIcons} from "@/features/shell/lib/navigation-icons";
import {useLocale} from "@/lib/i18n/LocaleProvider";
import {translateNavigationLabel} from "@/lib/i18n/dictionary";

/** Keep mobile destinations inside the canonical role navigation authority. */
const primary:Record<DashboardRole,readonly string[]>={
 admin:["Overview","Customers","Orders","Invoices"],
 client:["Overview","Services","Domains","Purchases"],
 staff:["Overview","Customers","Orders","Tickets"],
};
export function getMobilePrimaryNavigation(role:DashboardRole):readonly DashboardNavItem[]{
 const items=getDashboardNavGroups(role).flatMap(group=>group.items);
 return primary[role].map(label=>{
  const item=items.find(candidate=>candidate.label===label);
  if(!item)throw new Error("Missing mobile navigation destination: "+label);
  return item;
 });
}
function isCurrent(pathname:string,href:string,role:DashboardRole){
 return href==="/"+role?pathname===href:pathname===href||pathname.startsWith(href+"/");
}
export function ConsoleMobileBottomNav({role,pathname,onMore}:{role:DashboardRole;pathname:string;onMore:()=>void}){
 const {locale}=useLocale(),items=getMobilePrimaryNavigation(role);
 const moreCurrent=!items.some(item=>isCurrent(pathname,item.href,role));
 return <nav aria-label="Primary mobile navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-console-line bg-white/95 shadow-[0_-8px_24px_rgba(14,46,84,0.06)] backdrop-blur-lg lg:hidden">
  <div className="grid grid-cols-5 gap-0.5 px-2 pt-2 pb-[max(0.65rem,env(safe-area-inset-bottom))]">
   {items.map(item=>{
    const Icon=navigationIcons[item.icon],active=isCurrent(pathname,item.href,role);
    return <Link key={item.href} href={item.href} aria-current={active?"page":undefined}
      className={`flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 text-center font-medium focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-console-primary ${active?"text-console-primary":"text-console-muted hover:text-console-primary"}`}>
     <span className={`grid h-8 w-10 place-items-center rounded-xl ${active?"bg-blue-50":""}`}><Icon aria-hidden="true" className="h-[21px] w-[21px]" strokeWidth={active?2:1.8}/></span>
     <span className="max-w-full truncate text-[10px] leading-4">{translateNavigationLabel(item.label,locale)}</span>
    </Link>;
   })}
   <button type="button" aria-label="More Console pages" aria-haspopup="dialog" onClick={onMore}
    className={`flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 text-center font-medium focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-console-primary ${moreCurrent?"text-console-primary":"text-console-muted"}`}>
    <span className={`grid h-8 w-10 place-items-center rounded-xl ${moreCurrent?"bg-blue-50":""}`}><MoreHorizontal aria-hidden="true" className="h-[21px] w-[21px]"/></span><span className="text-[10px] leading-4">More</span>
   </button>
  </div>
 </nav>;
}

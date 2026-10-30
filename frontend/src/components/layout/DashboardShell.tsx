"use client";
import {useCallback,useState,type ReactNode} from "react";
import {usePathname,useRouter} from "next/navigation";
import {useAuth} from "@/context/AuthContext";
import {DashboardHeader} from "@/components/layout/DashboardHeader";
import {ConsoleThemeSync} from "@/features/shell/components/ConsoleThemeSync";
import {DashboardSidebar} from "@/components/layout/DashboardSidebar";
import {ConsoleMobileDrawer} from "@/features/shell/components/ConsoleMobileDrawer";
import {ConsoleMobileBottomNav} from "@/features/shell/components/ConsoleMobileBottomNav";
import type {DashboardRole} from "@/lib/navigation/dashboard-nav";
import {useLocale} from "@/lib/i18n/LocaleProvider";
import {messages} from "@/lib/i18n/dictionary";

type Props={role:DashboardRole;title:string;description?:string;actions?:ReactNode;children:ReactNode};
/** One typed Console shell shared by Client, Staff and Admin. Django retains all role authority. */
export function DashboardShell({role,title,description,actions,children}:Props){
 const pathname=usePathname(),router=useRouter();
 const {logout}=useAuth();
 const {locale}=useLocale(),m=messages(locale);
 const [sidebarOpen,setSidebarOpen]=useState(false),[loggingOut,setLoggingOut]=useState(false);
 const closeSidebar=useCallback(()=>setSidebarOpen(false),[]);
 async function handleLogout(){
  if(loggingOut)return;
  setLoggingOut(true);
  try{await logout();router.replace("/login");}finally{setLoggingOut(false);}
 }
 const side=(onClose:()=>void)=><DashboardSidebar role={role} pathname={pathname}
  onClose={onClose} onLogout={()=>{void handleLogout();}} loggingOut={loggingOut}/>;
 return <div className="min-h-dvh min-w-0 bg-console-canvas font-console text-console-ink lg:h-dvh lg:overflow-hidden">
  <ConsoleThemeSync/>
  <a href="#console-main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-console-primary">
   {m.skip}
  </a>
  <div className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">{side(closeSidebar)}</div>
  <ConsoleMobileDrawer open={sidebarOpen} onClose={closeSidebar}>{side(closeSidebar)}</ConsoleMobileDrawer>
  <div className="flex min-h-dvh min-w-0 flex-col lg:h-dvh lg:min-h-0 lg:overflow-hidden lg:pl-64">
   <DashboardHeader role={role} onMenuClick={()=>setSidebarOpen(true)}
    onLogout={()=>{void handleLogout();}} loggingOut={loggingOut}/>
   <main id="console-main" tabIndex={-1} className="mx-auto min-h-0 w-full max-w-[1560px] min-w-0 flex-1 px-4 py-4 sm:px-6 pb-28 lg:pb-4 lg:overflow-x-hidden lg:overflow-y-auto lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden">
    <span className="sr-only">{role} {title} {description??""}</span>
    {actions?<div className="mb-4 flex flex-wrap justify-end gap-2">{actions}</div>:null}
    {children}
   </main>
  </div>
  <ConsoleMobileBottomNav role={role} pathname={pathname} onMore={()=>setSidebarOpen(true)}/>
 </div>;
}

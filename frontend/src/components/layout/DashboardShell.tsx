"use client";
import {useCallback,useState,type ReactNode} from "react";
import {usePathname,useRouter} from "next/navigation";
import {useAuth} from "@/context/AuthContext";
import {DashboardHeader} from "@/components/layout/DashboardHeader";
import {DashboardSidebar} from "@/components/layout/DashboardSidebar";
import {ConsoleMobileDrawer} from "@/features/shell/components/ConsoleMobileDrawer";
import type {DashboardRole} from "@/lib/navigation/dashboard-nav";

type Props={role:DashboardRole;title:string;description?:string;actions?:ReactNode;children:ReactNode};
/** One typed Console shell shared by Client, Staff and Admin. Django retains all role authority. */
export function DashboardShell({role,title,description,actions,children}:Props){
 const pathname=usePathname(),router=useRouter();
 const {logout}=useAuth();
 const [sidebarOpen,setSidebarOpen]=useState(false),[loggingOut,setLoggingOut]=useState(false);
 const closeSidebar=useCallback(()=>setSidebarOpen(false),[]);
 async function handleLogout(){
  if(loggingOut)return;
  setLoggingOut(true);
  try{await logout();router.replace("/login");}finally{setLoggingOut(false);}
 }
 const side=(onClose:()=>void)=><DashboardSidebar role={role} pathname={pathname}
  onClose={onClose} onLogout={()=>{void handleLogout();}} loggingOut={loggingOut}/>;
 return <div className="min-h-dvh min-w-0 bg-console-canvas text-console-ink">
  <a href="#console-main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-console-primary">
   Skip to main content
  </a>
  <div className="fixed inset-y-0 left-0 z-40 hidden w-[17.5rem] lg:block">{side(closeSidebar)}</div>
  <ConsoleMobileDrawer open={sidebarOpen} onClose={closeSidebar}>{side(closeSidebar)}</ConsoleMobileDrawer>
  <div className="min-h-dvh min-w-0 lg:pl-[17.5rem]">
   <DashboardHeader role={role} onMenuClick={()=>setSidebarOpen(true)}
    onLogout={()=>{void handleLogout();}} loggingOut={loggingOut}/>
   <main id="console-main" tabIndex={-1} className="mx-auto w-full max-w-[1560px] min-w-0 px-4 py-5 sm:px-6 sm:py-6">
    <span className="sr-only">{role} {title} {description??""}</span>
    {actions?<div className="mb-4 flex flex-wrap justify-end gap-2">{actions}</div>:null}
    {children}
   </main>
  </div>
 </div>;
}

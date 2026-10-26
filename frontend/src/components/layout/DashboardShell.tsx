"use client";
import {useState,type ReactNode} from "react";
import {usePathname,useRouter} from "next/navigation";
import {useAuth} from "@/context/AuthContext";
import {DashboardHeader} from "@/components/layout/DashboardHeader";
import {DashboardSidebar} from "@/components/layout/DashboardSidebar";
import type {DashboardRole} from "@/lib/navigation/dashboard-nav";

type Props={role:DashboardRole;title:string;description?:string;actions?:ReactNode;children:ReactNode};
/** Structural workspace shell. Each section lives in its own TypeScript/Tailwind component. */
export function DashboardShell({role,title,description,actions,children}:Props){
 const pathname=usePathname(),router=useRouter();
 const {logout}=useAuth();
 const [sidebarOpen,setSidebarOpen]=useState(false),[loggingOut,setLoggingOut]=useState(false);
 async function handleLogout(){
   setLoggingOut(true);
   try{await logout();router.replace("/login");}finally{setLoggingOut(false);}
 }
 const side=<DashboardSidebar role={role} pathname={pathname}
   onClose={()=>setSidebarOpen(false)} onLogout={()=>{void handleLogout();}} loggingOut={loggingOut}/>;
 return <div className="min-h-screen bg-[#F8FAFC] text-[#142A43]">
   <div className="fixed inset-y-0 left-0 z-40 hidden w-[17.5rem] lg:block">{side}</div>
   {sidebarOpen&&<div className="fixed inset-0 z-50 lg:hidden">
     <button type="button" onClick={()=>setSidebarOpen(false)}
       aria-label="Close navigation overlay" className="absolute inset-0 bg-slate-950/60"/>
     <div className="relative h-full w-[17.5rem] max-w-[86vw]">{side}</div>
   </div>}
   <div className="lg:pl-[17.5rem]">
     <DashboardHeader role={role} onMenuClick={()=>setSidebarOpen(true)}
       onLogout={()=>{void handleLogout();}} loggingOut={loggingOut}/>
     <main className="min-w-0 px-4 py-5 sm:px-6">
       <span className="sr-only">{role} {title} {description??""}</span>
       {actions&&<div className="mb-4 flex flex-wrap justify-end gap-2">{actions}</div>}
       {children}
     </main>
   </div>
 </div>;
}

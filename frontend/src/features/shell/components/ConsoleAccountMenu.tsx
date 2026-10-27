"use client";
import Link from "next/link";
import {ChevronDown,LogOut,Settings,UserRound} from "lucide-react";
import {useEffect,useId,useRef,useState} from "react";
import {useAuth} from "@/context/AuthContext";
import type {DashboardRole} from "@/lib/navigation/dashboard-nav";
import {useLocale} from "@/lib/i18n/LocaleProvider";
import {messages} from "@/lib/i18n/dictionary";

export function ConsoleAccountMenu({role,onLogout,loggingOut}:{
 role:DashboardRole;onLogout:()=>void;loggingOut:boolean;
}){
 const {user}=useAuth();
 const {locale}=useLocale(),m=messages(locale);
 const [open,setOpen]=useState(false);
 const menuId=useId(),button=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null);
 const display=user?.name||user?.full_name||m.myAccount;
 const settings=role==="admin"?"/admin/settings":role==="staff"?"/staff/security":"/client/profile";
 useEffect(()=>{
  if(!open)return;
  function onKeyDown(event:KeyboardEvent){
   if(event.key==="Escape"){event.preventDefault();setOpen(false);button.current?.focus();}
  }
  function onPointerDown(event:PointerEvent){
   if(event.target instanceof Node&&!menu.current?.contains(event.target)&&!button.current?.contains(event.target))setOpen(false);
  }
  document.addEventListener("keydown",onKeyDown);
  document.addEventListener("pointerdown",onPointerDown);
  return ()=>{document.removeEventListener("keydown",onKeyDown);document.removeEventListener("pointerdown",onPointerDown);};
 },[open]);
 return <div className="relative border-l border-console-line pl-2 sm:pl-3">
  <button ref={button} type="button" onClick={()=>setOpen(value=>!value)} aria-label={m.accountMenu}
   aria-expanded={open} aria-controls={menuId}
   className="flex min-h-11 items-center gap-2 rounded-xl px-1.5 py-1 text-console-ink transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary">
   <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-console-primary text-white">
    <UserRound aria-hidden="true" className="h-5 w-5"/>
   </span>
   <span className="hidden max-w-40 truncate text-sm font-semibold sm:block">{display}</span>
   <ChevronDown aria-hidden="true" className="h-4 w-4 text-slate-500"/>
  </button>
  {open?<div ref={menu} id={menuId} aria-label={m.accountOptions}
   className="absolute right-0 top-14 z-50 w-64 max-w-[calc(100vw-1.5rem)] rounded-xl border border-console-line bg-white p-2 shadow-xl">
   <p className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
    {role==="client"?m.clientConsole:role==="admin"?m.adminConsole:m.staffConsole}
   </p>
   <Link href={settings} onClick={()=>setOpen(false)}
    className="mt-1 flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-console-ink hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary">
    <Settings aria-hidden="true" className="h-4 w-4"/>{m.accountSettings}
   </Link>
   <button type="button" disabled={loggingOut} onClick={()=>{setOpen(false);onLogout();}}
    className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 disabled:opacity-60">
    <LogOut aria-hidden="true" className="h-4 w-4"/>{loggingOut?m.loggingOut:m.logout}
   </button>
  </div>:null}
 </div>;
}

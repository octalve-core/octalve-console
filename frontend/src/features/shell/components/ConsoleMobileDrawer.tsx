"use client";
import {useEffect,useRef,type ReactNode} from "react";

export function ConsoleMobileDrawer({open,onClose,children}:{
 open:boolean;onClose:()=>void;children:ReactNode;
}){
 const drawer=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!open)return;
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const oldOverflow=document.body.style.overflow;
  document.body.style.overflow="hidden";
  drawer.current?.querySelector<HTMLButtonElement>('button[aria-label="Close sidebar"]')?.focus();
  function onKeyDown(event:KeyboardEvent){
   if(event.key==="Escape"){event.preventDefault();onClose();return;}
   if(event.key!=="Tab"||!drawer.current)return;
   const nodes=Array.from(drawer.current.querySelectorAll<HTMLElement>(
    'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
   )).filter(node=>node.getClientRects().length>0);
   if(!nodes.length)return;
   const first=nodes[0],last=nodes[nodes.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
  document.addEventListener("keydown",onKeyDown);
  return ()=>{
   document.removeEventListener("keydown",onKeyDown);
   document.body.style.overflow=oldOverflow;
   previous?.focus();
  };
 },[open,onClose]);
 if(!open)return null;
 return <div role="dialog" aria-modal="true" aria-label="Console navigation"
  className="fixed inset-0 z-50 lg:hidden">
  <button type="button" aria-label="Close navigation overlay" onClick={onClose}
   className="absolute inset-0 h-full w-full bg-slate-950/60"/>
  <div ref={drawer} className="relative h-full w-[17.5rem] max-w-[86vw] shadow-2xl">{children}</div>
 </div>;
}

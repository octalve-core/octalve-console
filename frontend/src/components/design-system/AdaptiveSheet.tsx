"use client";
import {useEffect,useId,useRef,type ReactNode} from "react";
import {X} from "lucide-react";
/** One native modal for responsive desktop dialogs and safe-area mobile bottom sheets.
 * showModal supplies backdrop inertness and browser focus trapping.
 */
export function AdaptiveSheet({open,onClose,title,description,children}:{open:boolean;onClose:()=>void;
 title:string;description?:string;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null),origin=useRef<HTMLElement|null>(null);
 const titleId=useId(),descriptionId=useId();
 useEffect(()=>{
  const dialog=ref.current;if(!dialog)return;
  if(open&&!dialog.open){
   origin.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
   dialog.showModal();
   dialog.querySelector<HTMLElement>('button[aria-label="Close panel"]')?.focus();
  }
  if(!open&&dialog.open){dialog.close();origin.current?.isConnected&&origin.current.focus({preventScroll:true});}
  return ()=>{if(dialog.open){dialog.close();origin.current?.isConnected&&origin.current.focus({preventScroll:true});}};
 },[open]);
 return <dialog ref={ref} aria-labelledby={titleId} aria-describedby={description?descriptionId:undefined}
  onCancel={e=>{e.preventDefault();onClose();}}
  onClick={e=>{if(e.target===e.currentTarget)onClose();}}
  className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-2xl border border-console-line bg-white p-0 pb-[env(safe-area-inset-bottom)] text-console-ink shadow-[0_24px_65px_rgba(7,20,37,0.16)] backdrop:bg-slate-950/60 focus:outline-none sm:inset-0 sm:m-auto sm:max-h-[90dvh] sm:max-w-md sm:rounded-2xl sm:pb-0">
  <div className="mx-auto mt-3 h-1 w-11 rounded-full bg-slate-200 sm:hidden" aria-hidden="true"/>
  <div className="flex items-start justify-between gap-3 border-b border-console-line px-4 py-3 sm:p-5">
   <div className="min-w-0 flex-1"><h2 id={titleId} className="truncate text-base font-medium">{title}</h2>
   {description?<p id={descriptionId} className="mt-1 truncate text-xs text-console-muted">{description}</p>:null}</div>
   <button type="button" aria-label="Close panel" onClick={onClose}
    className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-console-muted hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-console-primary">
    <X className="h-5 w-5" aria-hidden="true"/></button>
  </div>
  <div className="min-w-0 p-4 sm:p-5">{children}</div>
 </dialog>;
}

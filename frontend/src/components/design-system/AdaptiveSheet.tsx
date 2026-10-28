"use client";
import {useEffect,useId,useRef,type ReactNode} from "react";
import {X} from "lucide-react";
import {cn} from "@/lib/utils";
import styles from "./AdaptiveSheet.module.css";

export function AdaptiveSheet({open,onClose,title,description,children}:{
 open:boolean;onClose:()=>void;title:string;description?:string;children:ReactNode;
}){
 const ref=useRef<HTMLDialogElement>(null);
 const titleId=useId(),descriptionId=useId();
 useEffect(()=>{
  const dialog=ref.current;
  if(!dialog)return;
  if(open&&!dialog.open)dialog.showModal();
  if(!open&&dialog.open)dialog.close();
  return ()=>{if(dialog.open)dialog.close();};
 },[open]);
 return <dialog ref={ref} aria-labelledby={titleId}
  aria-describedby={description?descriptionId:undefined}
  onCancel={event=>{event.preventDefault();onClose();}}
  onClick={event=>{if(event.target===event.currentTarget)onClose();}}
  className={cn(styles.sheet,"focus:outline-none")}>
   <div className="mx-auto mt-3 h-1 w-11 rounded-full bg-slate-200 sm:hidden" aria-hidden="true"/>
   <div className="flex items-start justify-between gap-3 border-b border-console-line p-5 sm:p-6">
    <div className="min-w-0">
     <h2 id={titleId} className="text-lg font-semibold tracking-tight">{title}</h2>
     {description?<p id={descriptionId} className="mt-1 text-sm leading-6 text-console-muted">{description}</p>:null}
    </div>
    <button type="button" aria-label="Close panel" onClick={onClose}
     className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-console-muted hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary">
     <X className="h-5 w-5" aria-hidden="true"/>
    </button>
   </div>
   <div className="min-w-0 p-5 sm:p-6">{children}</div>
  </dialog>;
}

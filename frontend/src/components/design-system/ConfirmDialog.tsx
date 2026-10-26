"use client";
import {useEffect,useId,useRef,type ReactNode} from "react";
import {ActionButton} from "./ActionButton";
export type ConfirmDialogProps={
 open:boolean;title:string;description:string;confirmLabel:string;
 onClose:()=>void;onConfirm:()=>void;busy?:boolean;danger?:boolean;children?:ReactNode;
};
export function ConfirmDialog({open,title,description,confirmLabel,onClose,onConfirm,
 busy=false,danger=false,children}:ConfirmDialogProps){
 const element=useRef<HTMLDialogElement>(null),headingId=useId(),descriptionId=useId();
 useEffect(()=>{
  const dialog=element.current;
  if(!dialog)return;
  if(open&&!dialog.open)dialog.showModal();
  if(!open&&dialog.open)dialog.close();
 },[open]);
 return <dialog ref={element} aria-labelledby={headingId} aria-describedby={descriptionId}
  onCancel={event=>{event.preventDefault();if(!busy)onClose();}}
  className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-0 text-console-ink shadow-xl backdrop:bg-slate-950/60">
  <div className="p-6">
   <h2 id={headingId} className="text-xl font-semibold text-console-ink">{title}</h2>
   <p id={descriptionId} className="mt-3 text-sm leading-6 text-console-muted">{description}</p>
   {children?<div className="mt-4">{children}</div>:null}
   <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
    <ActionButton variant="outline" disabled={busy} onClick={onClose}>Cancel</ActionButton>
    <ActionButton variant={danger?"danger":"primary"} loading={busy} onClick={onConfirm}>{confirmLabel}</ActionButton>
   </div>
  </div>
 </dialog>;
}

"use client";
import {useId,type InputHTMLAttributes,type ReactNode} from "react";
import {cn} from "@/lib/utils";
export type TextFieldProps=InputHTMLAttributes<HTMLInputElement>&{
 label:string;hint?:string;error?:string;startIcon?:ReactNode;
};
export function TextField({label,hint,error,startIcon,id,className,"aria-describedby":describedBy,...props}:TextFieldProps){
 const autoId=useId(),controlId=id??autoId;
 const hintId=controlId+"-hint",errorId=controlId+"-error";
 const description=[describedBy,hint?hintId:undefined,error?errorId:undefined].filter(Boolean).join(" ")||undefined;
 return <div className="min-w-0">
  <label htmlFor={controlId} className="mb-2 block text-sm font-medium text-console-ink">{label}</label>
  <div className={cn("flex h-12 min-h-12 w-full min-w-0 items-center gap-3 rounded-xl border bg-white px-4 transition focus-within:border-console-primary focus-within:ring-2 focus-within:ring-blue-100",
   error?"border-rose-400":"border-slate-300")}>
   {startIcon?<span aria-hidden="true" className="flex shrink-0 items-center text-slate-500">{startIcon}</span>:null}
   <input {...props} id={controlId} aria-invalid={Boolean(error)||undefined} aria-describedby={description}
    className={cn("h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-console-ink outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-500",className)}/>
  </div>
  {hint?<p id={hintId} className="mt-1.5 text-xs leading-5 text-console-muted">{hint}</p>:null}
  {error?<p id={errorId} role="alert" className="mt-1.5 text-xs leading-5 text-rose-700">{error}</p>:null}
 </div>;
}

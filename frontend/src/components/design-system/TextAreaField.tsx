"use client";
import {useId,type TextareaHTMLAttributes} from "react";
import {cn} from "@/lib/utils";
export type TextAreaFieldProps=TextareaHTMLAttributes<HTMLTextAreaElement>&{
 label:string;hint?:string;error?:string;
};
export function TextAreaField({label,hint,error,id,rows=5,className,
 "aria-describedby":describedBy,...props}:TextAreaFieldProps){
 const autoId=useId(),controlId=id??autoId,hintId=controlId+"-hint",errorId=controlId+"-error";
 const description=[describedBy,hint?hintId:undefined,error?errorId:undefined].filter(Boolean).join(" ")||undefined;
 return <div className="min-w-0">
  <label htmlFor={controlId} className="mb-2 block text-sm font-medium text-console-ink">{label}</label>
  <textarea {...props} id={controlId} rows={rows} aria-invalid={Boolean(error)||undefined} aria-describedby={description}
   className={cn("block min-h-36 w-full min-w-0 resize-y rounded-xl border bg-white px-4 py-3 text-base leading-7 text-console-ink outline-none transition placeholder:text-slate-400 focus:border-console-primary focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50",error?"border-rose-400":"border-slate-300",className)}/>
  {hint?<p id={hintId} className="mt-1.5 text-xs leading-5 text-console-muted">{hint}</p>:null}
  {error?<p id={errorId} role="alert" className="mt-1.5 text-xs leading-5 text-rose-700">{error}</p>:null}
 </div>;
}

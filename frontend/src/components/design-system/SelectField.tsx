"use client";
import {ChevronDown} from "lucide-react";
import {useId,type SelectHTMLAttributes} from "react";
import {cn} from "@/lib/utils";
export type SelectOption={value:string;label:string;disabled?:boolean};
export type SelectFieldProps=Omit<SelectHTMLAttributes<HTMLSelectElement>,"children">&{
 label:string;options:readonly SelectOption[];placeholder?:string;hint?:string;error?:string;
};
export function SelectField({label,options,placeholder,hint,error,id,className,
 "aria-describedby":describedBy,...props}:SelectFieldProps){
 const autoId=useId(),controlId=id??autoId,hintId=controlId+"-hint",errorId=controlId+"-error";
 const description=[describedBy,hint?hintId:undefined,error?errorId:undefined].filter(Boolean).join(" ")||undefined;
 return <div className="min-w-0">
  <label htmlFor={controlId} className="mb-2 block text-sm font-medium text-console-ink">{label}</label>
  <div className="relative min-w-0">
   <select {...props} id={controlId} aria-invalid={Boolean(error)||undefined} aria-describedby={description}
    className={cn("block h-12 min-h-12 w-full min-w-0 appearance-none rounded-xl border bg-white px-4 pr-10 text-base text-console-ink outline-none transition focus:border-console-primary focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50",error?"border-rose-400":"border-slate-300",className)}>
    {placeholder?<option value="">{placeholder}</option>:null}
    {options.map(option=><option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
   </select>
   <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"/>
  </div>
  {hint?<p id={hintId} className="mt-1.5 text-xs leading-5 text-console-muted">{hint}</p>:null}
  {error?<p id={errorId} role="alert" className="mt-1.5 text-xs leading-5 text-rose-700">{error}</p>:null}
 </div>;
}

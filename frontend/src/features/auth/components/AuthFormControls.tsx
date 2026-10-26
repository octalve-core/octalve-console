"use client";
import {useId,useState,type InputHTMLAttributes,type ReactNode} from "react";
import {ArrowRight,Eye,EyeOff,LockKeyhole,Mail,Phone,UserRound,type LucideIcon} from "lucide-react";
import {cn} from "@/lib/utils";
import {ActionButton} from "@/components/design-system/ActionButton";

type AuthInputProps=InputHTMLAttributes<HTMLInputElement>&{
 label:string;icon?:LucideIcon;error?:string;
};
type AuthPasswordInputProps=Omit<AuthInputProps,"type"|"icon">;

export function AuthInput({label,icon:Icon,error,id,name,className,
 "aria-describedby":externalDescription,...props}:AuthInputProps){
 const generated=useId(),inputId=id??name??generated,errorId=inputId+"-error";
 return <div className="min-w-0">
  <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-console-ink">{label}</label>
  <div className={cn("flex h-14 w-full min-w-0 items-center gap-3 rounded-xl border bg-white px-4 shadow-sm transition-colors focus-within:border-console-primary focus-within:ring-2 focus-within:ring-blue-100",
   error?"border-rose-400":"border-slate-300")}>
   {Icon?<Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-400"/>:null}
   <input {...props} id={inputId} name={name} aria-invalid={Boolean(error)||undefined}
    aria-describedby={[externalDescription,error?errorId:undefined].filter(Boolean).join(" ")||undefined}
    className={cn("h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-console-ink outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-500",className)}/>
  </div>
  {error?<p id={errorId} role="alert" className="mt-2 text-xs leading-5 text-rose-700">{error}</p>:null}
 </div>;
}

export function AuthPasswordInput({label,error,id,name,className,
 "aria-describedby":externalDescription,...props}:AuthPasswordInputProps){
 const generated=useId(),inputId=id??name??generated,errorId=inputId+"-error";
 const [visible,setVisible]=useState(false);
 return <div className="min-w-0">
  <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-console-ink">{label}</label>
  <div className={cn("flex h-14 w-full min-w-0 items-center gap-3 rounded-xl border bg-white px-4 shadow-sm transition-colors focus-within:border-console-primary focus-within:ring-2 focus-within:ring-blue-100",
   error?"border-rose-400":"border-slate-300")}>
   <LockKeyhole aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-400"/>
   <input {...props} id={inputId} name={name} type={visible?"text":"password"}
    aria-invalid={Boolean(error)||undefined}
    aria-describedby={[externalDescription,error?errorId:undefined].filter(Boolean).join(" ")||undefined}
    className={cn("h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-console-ink outline-none placeholder:text-slate-400",className)}/>
   <button type="button" aria-label={visible?"Hide password":"Show password"}
    aria-pressed={visible} onClick={()=>setVisible(value=>!value)}
    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 hover:text-console-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary">
    {visible?<EyeOff aria-hidden="true" className="h-5 w-5"/>:<Eye aria-hidden="true" className="h-5 w-5"/>}
   </button>
  </div>
  {error?<p id={errorId} role="alert" className="mt-2 text-xs leading-5 text-rose-700">{error}</p>:null}
 </div>;
}
export function AuthButton({children,disabled}:{children:ReactNode;disabled?:boolean}){
 return <ActionButton type="submit" size="lg" disabled={disabled} className="w-full" trailingIcon={<ArrowRight aria-hidden="true" className="h-5 w-5"/>}>
  {children}
 </ActionButton>;
}
export const authFieldIcons={mail:Mail,user:UserRound,phone:Phone};

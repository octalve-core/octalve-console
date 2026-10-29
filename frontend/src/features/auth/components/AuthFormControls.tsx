"use client";
import {useId,useState,type InputHTMLAttributes,type ReactNode} from "react";
import {ArrowRight,Eye,EyeOff,LockKeyhole,Mail,Phone,UserRound,type LucideIcon} from "lucide-react";
import {cn} from "@/lib/utils";
import styles from "./AuthLayout.module.css";

type AuthInputProps=InputHTMLAttributes<HTMLInputElement>&{
 label:string;icon?:LucideIcon;error?:string;
};
type AuthPasswordInputProps=Omit<AuthInputProps,"type"|"icon">;

export function AuthInput({label,icon:Icon,error,id,name,className,
 "aria-describedby":externalDescription,...props}:AuthInputProps){
 const generated=useId(),inputId=id??name??generated,errorId=inputId+"-error";
 return <div className={styles.field}>
  <label htmlFor={inputId} className={styles.fieldLabel}>{label}</label>
  <div className={cn(styles.fieldShell,error&&styles.fieldError)}>
   {Icon?<Icon aria-hidden="true" className={styles.fieldIcon} size={17} strokeWidth={1.8}/>:null}
   <input {...props} id={inputId} name={name} aria-invalid={Boolean(error)||undefined}
    aria-describedby={[externalDescription,error?errorId:undefined].filter(Boolean).join(" ")||undefined}
    className={cn(styles.fieldControl,!Icon&&"pl-3",className)}/>
  </div>
  {error?<p id={errorId} role="alert" className={styles.hint}>{error}</p>:null}
 </div>;
}

export function AuthPasswordInput({label,error,id,name,className,
 "aria-describedby":externalDescription,...props}:AuthPasswordInputProps){
 const generated=useId(),inputId=id??name??generated,errorId=inputId+"-error";
 const [visible,setVisible]=useState(false);
 return <div className={styles.field}>
  <label htmlFor={inputId} className={styles.fieldLabel}>{label}</label>
  <div className={cn(styles.fieldShell,error&&styles.fieldError)}>
   <LockKeyhole aria-hidden="true" className={styles.fieldIcon} size={17} strokeWidth={1.8}/>
   <input {...props} id={inputId} name={name} type={visible?"text":"password"}
    aria-invalid={Boolean(error)||undefined}
    aria-describedby={[externalDescription,error?errorId:undefined].filter(Boolean).join(" ")||undefined}
    className={cn(styles.fieldControl,styles.withEnd,className)}/>
   <button type="button" aria-label={visible?"Hide password":"Show password"} aria-pressed={visible}
    onClick={()=>setVisible(s=>!s)} className={styles.eye}>
    {visible?<EyeOff aria-hidden="true" size={18}/>:<Eye aria-hidden="true" size={18}/>}
   </button>
  </div>
  {error?<p id={errorId} role="alert" className={styles.hint}>{error}</p>:null}
 </div>;
}
export function AuthButton({children,disabled}:{children:ReactNode;disabled?:boolean}){
 return <button type="submit" disabled={disabled} className={styles.action}>
  <span>{children}</span><ArrowRight size={16} aria-hidden="true" strokeWidth={2}/>
 </button>;
}
/** Display-only strength guidance. Django decides final password acceptance. */
export function AuthPasswordStrength({password}:{password:string}){
 const categories=[/[a-z]/.test(password),/[A-Z]/.test(password),/[0-9]/.test(password),/[^a-zA-Z0-9]/.test(password)];
 const score=password.length===0?0:Math.min(4,Number(password.length>=12)+Number(password.length>=16)+Number(categories.filter(Boolean).length>=3)+Number(categories.every(Boolean)));
 return <div className={styles.strength} aria-live="polite" aria-atomic="true">
   <div className={styles.strengthBars} aria-hidden="true">{[1,2,3,4].map(n=><span key={n} data-active={score>=n}/>)}</div>
   <div className={styles.strengthInfo}>
     <span>{!password?"Password strength":score>=4?"Strong":score>=3?"Good":"Needs improvement"}</span>
     <span>{password.length<12?"Use at least 12 characters":"Use a unique password"}</span>
   </div>
 </div>;
}
export function AuthSocialOptions(){
 return <div aria-label="Other sign-in methods are unavailable">
  <div className={styles.divider}>Other sign-in options</div>
  <div className={styles.socialRow}>
   {["Google","Apple","Facebook"].map(name=><button key={name} className={styles.social} type="button"
      disabled aria-label={name+" sign-in not available"} title={name+" sign-in not available"}>
     <span aria-hidden="true" className="text-sm font-medium">{name[0]}</span>
    </button>)}
  </div>
 </div>;
}
export const authFieldIcons={mail:Mail,user:UserRound,phone:Phone};

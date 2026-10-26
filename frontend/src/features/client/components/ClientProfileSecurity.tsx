import Link from "next/link";
import {Mail,ShieldCheck} from "lucide-react";
import type {FormEvent} from "react";
import {Panel} from "@/components/design-system/Panel";
import {ActionButton} from "@/components/design-system/ActionButton";
import {TextField} from "@/components/design-system/TextField";
import {StatusBadge} from "@/components/design-system/StatusBadge";

export type PasswordDraft={current:string;next:string;confirm:string};
export function ClientProfileSecurity({emailVerified,hasProfile,onVerify,password,onPasswordChange,onPasswordSubmit}:{
 emailVerified:boolean;hasProfile:boolean;onVerify:()=>void;
 password:PasswordDraft;onPasswordChange:(field:keyof PasswordDraft,value:string)=>void;
 onPasswordSubmit:(event:FormEvent<HTMLFormElement>)=>void;
}){
 return <div className="min-w-0 space-y-5">
  <Panel>
   <h2 className="flex items-center gap-2 text-lg font-semibold text-console-ink">
    <ShieldCheck aria-hidden="true" className="h-5 w-5 text-console-primary"/>Account security
   </h2>
   <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-console-muted">
    Email status: <StatusBadge tone={emailVerified?"success":"warning"}>{emailVerified?"Verified":"Not verified"}</StatusBadge>
   </div>
   <ActionButton type="button" size="sm" variant="outline" disabled={!hasProfile||emailVerified}
    leadingIcon={<Mail aria-hidden="true" className="h-4 w-4"/>} onClick={onVerify}
    className="mt-4 w-full sm:w-auto">
    {emailVerified?"Email verified":"Send verification link"}
   </ActionButton>
   <p className="mt-3 text-xs leading-5 text-console-muted">Email verification requires our secure delivery service.</p>
  </Panel>
  <Panel>
   <h2 className="text-lg font-semibold text-console-ink">Change password</h2>
   <form onSubmit={onPasswordSubmit} className="mt-4 space-y-4">
    {([["current","Current password"],["next","New password"],["confirm","Confirm new password"]] as const).map(([key,label])=>
     <TextField key={key} label={label} type="password" required name={key}
      autoComplete={key==="current"?"current-password":"new-password"}
      value={password[key]} onChange={event=>onPasswordChange(key,event.target.value)}/>
    )}
    <ActionButton type="submit" className="w-full sm:w-auto">Update password</ActionButton>
   </form>
   <Link href="/forgot-password" className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-console-primary hover:underline">
    Forgot password?
   </Link>
  </Panel>
 </div>;
}

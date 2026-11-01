"use client";
import {useState,type FormEvent} from "react";
import {api} from "@/lib/api/client";
import {ShieldCheck,AlertTriangle} from "lucide-react";
import type {DraftConnection} from "./connection-readback";

type Receipt={verified:boolean;adapter_key:string;credential_version:number;
 execution_enabled:false;checked_at:string;evidence:Record<string,unknown>};
export function SavedConnectionActions({connection,onChanged}:{
 connection:DraftConnection;onChanged:()=>void;
}){
 const [working,setWorking]=useState(false),[message,setMessage]=useState(""),[failed,setFailed]=useState(false);
 const supported=["cloudflare-dns","cloudflare-registrar","brevo"].includes(connection.adapter_key);
 async function check(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(working||!supported||connection.state!=="draft")return;
  const form=e.currentTarget,fields=new FormData(form);
  const payload={confirm_password:String(fields.get("password")||""),
                 totp_code:String(fields.get("totp")||"")};
  form.reset();setWorking(true);setMessage("");setFailed(false);
  try{
   const result=await api.post<Receipt>(
    "/providers/connections/"+encodeURIComponent(connection.id)+"/verify/",payload);
   if(result.verified!==true||result.execution_enabled!==false||
      result.adapter_key!==connection.adapter_key)throw Error("Invalid provider evidence");
   setMessage("Supplier readback passed at "+new Date(result.checked_at).toLocaleString("en-GB")+
    ". This connection remains read-only and is not provisioned.");
  }catch{
   setFailed(true);setMessage("Could not certify this provider credential. Review your Super Admin security status and supplier permissions.");
  }finally{setWorking(false);}
 }
 if(!supported||connection.state==="revoked")return null;
 return <form autoComplete="off" onSubmit={check} className="mt-3 space-y-2 rounded-lg border border-console-line bg-white p-3">
  <p className="flex items-center gap-2 text-xs font-medium text-console-ink"><ShieldCheck className="h-4 w-4 text-console-primary" aria-hidden="true"/>Verify saved supplier key</p>
  <p className="text-xs leading-5 text-console-muted">The credential stays encrypted in the server vault. This readback performs no supplier writes and does not enable provisioning.</p>
  <label className="block text-xs text-console-ink">Current account password
   <input type="password" name="password" autoComplete="off" required
    className="mt-1 min-h-11 w-full rounded-lg border border-console-line px-3"/></label>
  <label className="block text-xs text-console-ink">Fresh authenticator code
   <input name="totp" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
    autoComplete="one-time-code" required
    className="mt-1 min-h-11 w-full rounded-lg border border-console-line px-3"/></label>
  <button type="submit" disabled={working} className="min-h-11 rounded-lg border border-console-line px-3 text-xs font-medium text-console-primary disabled:opacity-50">
   {working?"Verifying…":"Verify read-only connection"}</button>
  {message?<p role={failed?"alert":"status"} className={"text-xs leading-5 "+(failed?"text-rose-700":"text-emerald-700")}>
   {failed?<AlertTriangle aria-hidden="true" className="mr-1 inline h-4 w-4"/>:null}{message}</p>:null}
 </form>;
}

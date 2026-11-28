"use client";
import {useState,type FormEvent} from "react";
import {api} from "@/lib/api/client";
import type {DraftConnection} from "./connection-readback";
export function MailSenderPolicy({connection,onSaved}:{connection:DraftConnection;onSaved?:()=>void}){
 const [working,setWorking]=useState(false),[message,setMessage]=useState(""),[failed,setFailed]=useState(false);
 async function approve(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(working||connection.state!=="draft"||connection.environment!=="live"||connection.adapter_key!=="brevo")return;
  const form=event.currentTarget,fields=new FormData(form);
  const input={sender_email:String(fields.get("sender")||""),confirm_password:String(fields.get("password")||""),totp_code:String(fields.get("totp")||""),accept:fields.get("accept")==="on"};
  form.reset();setWorking(true);setMessage("");setFailed(false);
  try{
   const result=await api.post<{configured:boolean;delivery_enabled:boolean}>("/providers/connections/"+encodeURIComponent(connection.id)+"/mail-policy/",input);
   if(result.configured!==true||typeof result.delivery_enabled!=="boolean")throw Error("Unexpected sender approval");
   setMessage(result.delivery_enabled?"Sender approved. Eligible queued notices may be submitted; provider acceptance is not inbox delivery.":"Sender approved. Transactional delivery remains globally disabled.");
   onSaved?.();
  }catch{setFailed(true);setMessage("Sender approval failed. Verify the provider domain, sender address and current authenticator.");}
  finally{setWorking(false);}
 }
 const field="mt-1 min-h-11 w-full rounded-lg border border-console-line px-3 text-sm";
 return <form onSubmit={approve} className="mt-3 space-y-3 rounded-xl border border-console-line bg-white p-3">
  <h3 className="text-sm font-medium">Authorize transactional sender</h3>
  <p className="text-xs leading-5 text-console-muted">Approve the sender on your verified Brevo domain. This does not send a test email or disclose the API key.</p>
  <label className="block text-xs">Verified sender email<input name="sender" type="email" required maxLength={254} className={field}/></label>
  <label className="block text-xs">Current account password<input name="password" type="password" autoComplete="current-password" required className={field}/></label>
  <label className="block text-xs">Fresh authenticator code<input name="totp" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required className={field}/></label>
  <label className="flex items-start gap-2 text-xs"><input name="accept" type="checkbox" required/>Authorize this verified sender for eligible transactional notices.</label>
  <button disabled={working} className="min-h-11 rounded-lg bg-console-primary px-3 text-sm font-medium text-white disabled:opacity-50">{working?"Verifying sender…":"Approve sender"}</button>
  {message&&<p role={failed?"alert":"status"} className={"text-xs "+(failed?"text-rose-700":"text-emerald-700")}>{message}</p>}
 </form>
}

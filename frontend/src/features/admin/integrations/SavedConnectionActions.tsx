"use client";
import {useState,type FormEvent} from "react";
import {api} from "@/lib/api/client";
import {HostingSupplierPolicy} from "./HostingSupplierPolicy";
import {MailSenderPolicy} from "./MailSenderPolicy";
import {PaystackLiveBinding} from "./PaystackLiveBinding";
import {ShieldCheck,AlertTriangle} from "lucide-react";
import type {DraftConnection} from "./connection-readback";

type Receipt={verified:boolean;adapter_key:string;credential_version:number;
 execution_enabled:false;checked_at:string;evidence:Record<string,unknown>};
export function SavedConnectionActions({connection,onVerified}:{
 connection:DraftConnection;onVerified?:()=>void;
}){
 const [working,setWorking]=useState(false),[message,setMessage]=useState(""),[failed,setFailed]=useState(false);
 const hosting=["directadmin","cpanel-whm"].includes(connection.adapter_key);
 const supported=connection.supports_verification??["cloudflare-dns","cloudflare-registrar","cloudflare-registrar-live","brevo","paystack"].includes(connection.adapter_key);
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
   if(hosting){
    if(typeof result.evidence.package_count!=="number"||typeof result.evidence.supplier_active!=="boolean"||result.evidence.provisioning_enabled!==false)throw Error("Invalid hosting inventory evidence");
    setMessage(result.evidence.package_count+" hosting packages imported into Catalogue → Suppliers & Inventory. Review pricing and capabilities there. No hosting accounts were created.");
   }else setMessage("Provider access verified on "+new Date(result.checked_at).toLocaleString("en-GB")+
    ". No changes were made to the provider account.");
   onVerified?.();
  }catch{
   setFailed(true);setMessage("We couldn't verify access. Check your provider permissions and account security, then try again.");
  }finally{setWorking(false);}
 }
 if(!supported||connection.state==="revoked")return null;
 return <><form autoComplete="off" onSubmit={check} className="mt-3 space-y-2 rounded-lg border border-console-line bg-white p-3">
  <p className="flex items-center gap-2 text-xs font-medium text-console-ink"><ShieldCheck className="h-4 w-4 text-console-primary" aria-hidden="true"/>Verify provider access</p>
  <p className="text-xs leading-5 text-console-muted">{hosting?"Verify the hosting API and automatically import its technical packages for review. This does not create accounts or publish products.":"Confirm that Octalve Cloud can securely access this account. This check does not change settings or make purchases."}</p>
  <label className="block text-xs text-console-ink">Current account password
   <input type="password" name="password" autoComplete="off" required
    className="mt-1 min-h-11 w-full rounded-lg border border-console-line px-3"/></label>
  <label className="block text-xs text-console-ink">Fresh authenticator code
   <input name="totp" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
    autoComplete="one-time-code" required
    className="mt-1 min-h-11 w-full rounded-lg border border-console-line px-3"/></label>
  <button type="submit" disabled={working} className="min-h-11 rounded-lg border border-console-line px-3 text-xs font-medium text-console-primary disabled:opacity-50">
   {working?"Verifying…":hosting?"Verify and import packages":"Verify access"}</button>
  {message?<p role={failed?"alert":"status"} className={"text-xs leading-5 "+(failed?"text-rose-700":"text-emerald-700")}>
   {failed?<AlertTriangle aria-hidden="true" className="mr-1 inline h-4 w-4"/>:null}{message}</p>:null}
 </form>{["cloudflare-registrar-live","resellerclub"].includes(connection.adapter_key)&&connection.environment==="live"&&connection.verification_status==="verified"?<RegistrarExecutionPolicy connection={connection}/>:null}{connection.adapter_key==="cloudflare-registrar-live"&&connection.environment==="live"&&connection.verification_status==="verified"?<RegistrarRegistrationReview connection={connection}/>:null}{connection.adapter_key==="paystack"&&connection.environment==="live"&&connection.verification_status==="verified"?<PaystackLiveBinding connection={connection} onSaved={onVerified}/>:null}{["brevo","resend"].includes(connection.adapter_key)&&connection.environment==="live"&&connection.verification_status==="verified"?<MailSenderPolicy connection={connection} onSaved={onVerified}/>:null}{hosting&&connection.hosting_policy_available===true&&connection.environment==="live"&&connection.verification_status==="verified"?<HostingSupplierPolicy connection={connection} onSaved={onVerified}/>:null}</>;
}

function RegistrarRegistrationReview({connection}:{connection:DraftConnection}){
 const [result,setResult]=useState<{domain_name:string;status:string;registered_at?:string;expires_at?:string}|null>(null),[working,setWorking]=useState(false),[error,setError]=useState(false);
 async function read(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(working)return;const form=event.currentTarget,fields=new FormData(form);
  const input={domain:String(fields.get("domain")||"").toLowerCase().trim(),confirm_password:String(fields.get("password")||""),totp_code:String(fields.get("totp")||"")};
  form.reset();setWorking(true);setError(false);setResult(null);
  try{const response=await api.post<{verified:boolean;registration:{domain_name:string;status:string;registered_at?:string;expires_at?:string};execution_enabled:boolean}>("/providers/connections/"+encodeURIComponent(connection.id)+"/registrar-registration-status/",input);
    if(!response.verified||response.execution_enabled||response.registration.domain_name!==input.domain)throw Error("Unverified response");setResult(response.registration);
  }catch{setError(true)}finally{setWorking(false)}
 }
 const field="mt-1 min-h-11 w-full rounded-lg border border-console-line px-3 text-sm";
 return <form onSubmit={read} className="mt-3 space-y-2 rounded-lg border border-console-line bg-white p-3">
  <h4 className="text-sm font-medium">Registrar registration review</h4>
  <p className="text-xs text-console-muted">Check an exact .com or .net registration in this account. Does not create a domain or establish customer ownership.</p>
  <label className="block text-xs">Domain name<input name="domain" required maxLength={253} placeholder="example.com" className={field}/></label>
  <label className="block text-xs">Current password<input name="password" type="password" required autoComplete="current-password" className={field}/></label>
  <label className="block text-xs">Fresh authenticator code<input name="totp" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" className={field}/></label>
  <button type="submit" disabled={working} className="min-h-11 rounded-lg border border-console-line px-3 text-xs">{working?"Checking…":"Read registration status"}</button>
  {error?<p role="alert" className="text-xs text-rose-700">Registration could not be verified.</p>:null}
  {result?<div role="status" className="break-words text-xs"><p>{result.domain_name} · {result.status.replaceAll("_"," ")}</p>{result.expires_at?<p>Registrar expiry: {new Date(result.expires_at).toLocaleDateString("en-GB")}</p>:null}</div>:null}
 </form>
}

function RegistrarExecutionPolicy({connection}:{connection:DraftConnection}){
 const [working,setWorking]=useState(false),[message,setMessage]=useState(""),[failed,setFailed]=useState(false);
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(working)return;const form=event.currentTarget,fields=new FormData(form);
  const data={registration:fields.get("operation")==="enable",dedicated_account:fields.get("dedicated")==="on",
    ...(connection.adapter_key==="resellerclub"?{nameservers:String(fields.get("nameservers")||"").split(/[,\s]+/).filter(Boolean).map(s=>s.toLowerCase())}:{}),
    confirm_password:String(fields.get("password")||""),totp_code:String(fields.get("totp")||"")};
  form.reset();setWorking(true);setFailed(false);setMessage("");
  try{const result=await api.post<{registration_enabled:boolean}>("/providers/connections/"+encodeURIComponent(connection.id)+"/registrar-policy/",data);
   setMessage(result.registration_enabled?"Live registration authority saved for this credential version. Publish current TLD rates before accepting orders.":"Live registration authority revoked.");
  }catch{setFailed(true);setMessage("Registrar policy could not be approved. Check security prerequisites.");}finally{setWorking(false)}
 }
 const field="mt-1 min-h-11 w-full rounded-lg border border-console-line px-3 text-sm";
 return <form onSubmit={save} className="mt-3 space-y-2 rounded-lg border border-console-line bg-white p-3">
 <h4 className="text-sm font-medium">Live registration authority</h4>
 <p className="text-xs text-console-muted">One-year standard .com and .net orders only. Supplier billing and customer contact accuracy must be qualified. Enabling this allows independently paid orders to purchase real domains.</p>
 <label className="block text-xs">Registration policy<select name="operation" required className={field}><option value="disable">Disabled</option><option value="enable">Enable paid registration</option></select></label>
 {connection.adapter_key==="resellerclub"?<label className="block text-xs">Initial nameservers (comma-separated, at least two)<input name="nameservers" required placeholder="ns1.example.com, ns2.example.com" className={field}/></label>:null}
 <label className="flex gap-2 text-xs"><input name="dedicated" type="checkbox" required/>This is a dedicated registrar account controlled by Octalve; no competing out-of-band registration requests.</label>
 <label className="block text-xs">Current password<input type="password" name="password" required autoComplete="current-password" className={field}/></label>
 <label className="block text-xs">Authenticator code<input name="totp" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" className={field}/></label>
 <button type="submit" disabled={working} className="min-h-11 rounded-lg border border-console-line px-3 text-xs">{working?"Saving…":"Save registrar authority"}</button>
 {message?<p role={failed?"alert":"status"} className="text-xs">{message}</p>:null}
 </form>
}

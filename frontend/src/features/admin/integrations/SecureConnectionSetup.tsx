"use client";
import {useEffect,useState,type FormEvent} from "react";
import {ShieldCheck,ShieldAlert,KeyRound,CheckCircle2} from "lucide-react";
import {api} from "@/lib/api/client";
import type {Integration} from "./catalog";

type FieldKind="url"|"name"|"domain"|"identifier";
type ProviderSchema={key:string;name:string;fields:Record<string,FieldKind>;
 secret_fields:string[];enabled_for_execution:false};
type Security={verified:boolean;kind:"totp";enrollment_available:boolean;
 credential_submission_available:boolean;provider_execution_enabled:false};
type SecretEnrollment={secret:string;otpauth_url:string;expires_in_seconds:number};
type SavedDraft={id:string;label:string;state:"draft";credential_version:number;execution_enabled:false};
const pretty=(value:string)=>value.replaceAll("_"," ").replace(/\b\w/g,letter=>letter.toUpperCase());
function validSchema(value:unknown,slug:string):ProviderSchema|null{
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const r=value as Record<string,unknown>;
 if(!Array.isArray(r.integrations)||r.execution_enabled!==false)return null;
 const match=r.integrations.find(v=>v&&typeof v==="object"&&(v as Record<string,unknown>).key===slug) as ProviderSchema|undefined;
 if(!match||!match.fields||typeof match.fields!=="object"||Array.isArray(match.fields)||
   !Array.isArray(match.secret_fields)||match.enabled_for_execution!==false ||
   Object.keys(match.fields).length>6||match.secret_fields.length>3||
   !Object.values(match.fields).every(k=>["url","name","domain","identifier"].includes(k))||
   !match.secret_fields.every(k=>typeof k==="string"&&/^[a-z_]{1,40}$/.test(k)))return null;
 return match;
}
function errorText(){return "The secure operation was not completed. Check your authorization, settings and security code.";}
export function SecureConnectionSetup({item,onSaved}:{item:Integration;onSaved:()=>void}){
 const [schema,setSchema]=useState<ProviderSchema|null>(null);
 const [security,setSecurity]=useState<Security|null>(null);
 const [state,setState]=useState<"loading"|"ready"|"unauthorized"|"unavailable">("loading");
 const [working,setWorking]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [enrollment,setEnrollment]=useState<SecretEnrollment|null>(null);
 useEffect(()=>{
  let active=true;
  setState("loading");setSchema(null);setSecurity(null);setError("");setEnrollment(null);
  void Promise.all([
   api.get<unknown>("/providers/connections/schemas/"),
   api.get<Security>("/providers/security/stepup/")
  ]).then(([spec,result])=>{
   if(!active)return;
   setSchema(validSchema(spec,item.slug));
   if(typeof result.verified!=="boolean"||typeof result.credential_submission_available!=="boolean"||
     result.provider_execution_enabled!==false)throw Error("Invalid security response");
   setSecurity(result);setState("ready");
  }).catch(e=>{if(active)setState(e?.status===403?"unauthorized":"unavailable");});
  return()=>{active=false;};
 },[item.slug]);
 async function enrollStart(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(working)return;
  const form=e.currentTarget,fields=new FormData(form),password=String(fields.get("confirm_password")||"");
  form.reset();setWorking(true);setError("");setNotice("");
  try{
   const result=await api.post<SecretEnrollment>("/providers/security/stepup/enroll/",{confirm_password:password});
   if(!result||!result.secret||!result.otpauth_url||result.expires_in_seconds!==300)throw Error("Invalid enrollment");
   setEnrollment(result);
  }catch{setEnrollment(null);setError(errorText());}
  finally{setWorking(false);}
 }
 async function enrollConfirm(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(working||!enrollment)return;
  const form=e.currentTarget,fields=new FormData(form);
  const password=String(fields.get("confirm_password")||""),
        code=String(fields.get("totp_code")||"");
  form.reset();setWorking(true);setError("");
  try{
   const result=await api.post<{verified:boolean}>("/providers/security/stepup/confirm/",{
    confirm_password:password,totp_code:code});
   if(result.verified!==true)throw Error("Not confirmed");
   setEnrollment(null);setSecurity(v=>v?{...v,verified:true}:v);
   setNotice("Authenticator enrollment confirmed. You can now use it for sensitive connection changes.");
  }catch{setError(errorText());}
  finally{setWorking(false);}
 }
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(working||!schema||!security?.verified||!security.credential_submission_available)return;
  const form=e.currentTarget,fields=new FormData(form);
  const public_settings:Record<string,string>={},secrets:Record<string,string>={};
  for(const key of Object.keys(schema.fields))public_settings[key]=String(fields.get("pub_"+key)||"");
  for(const key of schema.secret_fields)secrets[key]=String(fields.get("sec_"+key)||"");
  const payload={adapter_key:item.slug,label:String(fields.get("label")||""),
   environment:String(fields.get("environment")||""),public_settings,secrets,
   confirm_password:String(fields.get("confirm_password")||""),
   totp_code:String(fields.get("totp_code")||"")};
  form.reset();setWorking(true);setError("");setNotice("");
  try{
   const result=await api.post<SavedDraft>("/providers/connections/",payload);
   if(!result||result.state!=="draft"||result.execution_enabled!==false||
      typeof result.id!=="string")throw Error("Invalid storage receipt");
   setNotice("Encrypted credential draft saved. The key cannot be displayed again. Supplier execution remains disabled.");
   onSaved();
  }catch{setError(errorText());}
  finally{setWorking(false);}
 }
 if(state==="loading")return <p role="status" className="text-xs text-console-muted">Checking secure setup permissions…</p>;
 if(state==="unauthorized")return <p className="rounded-xl border border-console-line p-3 text-xs text-console-muted">This action requires a verified Super Admin account. Ordinary Admin and Staff accounts cannot see or change supplier credentials.</p>;
 if(state==="unavailable"||!security)return <p role="status" className="rounded-xl border border-amber-200 p-3 text-xs text-amber-800">Secure credential setup cannot be verified. No credentials have been submitted.</p>;
 if(!schema)return null;
 const fieldStyle="min-h-11 w-full rounded-lg border border-console-line bg-white px-3 py-2 text-sm text-console-ink focus-visible:outline-2 focus-visible:outline-console-primary";
 return <section aria-label="Secure connection setup" className="rounded-xl border border-console-line p-4">
  <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-console-primary" aria-hidden="true"/><h3 className="text-sm font-medium">Secure connection setup</h3></div>
  <p className="mt-2 text-xs leading-5 text-console-muted">Provider secrets are submitted through the authenticated Console connection, encrypted on the Django server and kept in Octalve-controlled storage. They are never returned after saving. This does not activate a supplier.</p>
  {!security.credential_submission_available?<div role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">
    <ShieldAlert className="mr-1 inline h-4 w-4" aria-hidden="true"/>
    Secure Production credential storage is not approved or configured. Complete the database migration, independent encryption-key custody, audit key and authenticator gates before enabling submissions.
   </div>:null}
  {security.credential_submission_available&&!security.verified?<div className="mt-4 space-y-3">
   <p className="text-xs text-console-muted">First enroll a provider-vault authenticator. This is separate from your sign-in session and does not require SMS.</p>
   {!security.enrollment_available?<p className="text-xs text-amber-800">Authenticator enrollment is not enabled by the server operator.</p>:null}
   {!enrollment?<form onSubmit={enrollStart} autoComplete="off" className="space-y-2">
    <label className="block text-xs">Current account password
     <input name="confirm_password" type="password" required autoComplete="off" className={fieldStyle}/></label>
    <button type="submit" disabled={working||!security.enrollment_available} className="min-h-11 rounded-lg border border-console-line px-3 text-xs font-medium text-console-primary disabled:opacity-50">Start authenticator enrollment</button>
   </form>:<div className="space-y-3">
    <p className="text-xs text-amber-800">Copy this setup key to your authenticator app now. It is shown only during enrollment; do not share or save it in browser storage.</p>
    <code className="block break-all rounded-lg bg-slate-100 p-3 text-xs">{enrollment.secret}</code>
    <form onSubmit={enrollConfirm} autoComplete="off" className="space-y-2">
     <label className="block text-xs">Current account password<input name="confirm_password" type="password" required autoComplete="off" className={fieldStyle}/></label>
     <label className="block text-xs">Six-digit authenticator code<input name="totp_code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" className={fieldStyle}/></label>
     <button type="submit" disabled={working} className="min-h-11 rounded-lg bg-console-primary px-3 text-xs font-medium text-white">Confirm authenticator</button>
    </form>
   </div>}
  </div>:null}
  {security.credential_submission_available&&security.verified?<form onSubmit={save} autoComplete="off" className="mt-4 space-y-3">
   <div className="grid gap-3 sm:grid-cols-2">
    <label className="block text-xs">Connection label
     <input name="label" required minLength={2} maxLength={120} placeholder="e.g. My DNS account" className={fieldStyle}/></label>
    <label className="block text-xs">Environment
     <select name="environment" required className={fieldStyle} defaultValue="test">
      <option value="test">Test</option><option value="live">Live (credential draft only)</option>
     </select></label>
   </div>
   {Object.entries(schema.fields).map(([key,kind])=><label key={key} className="block text-xs">{pretty(key)}
     <input name={"pub_"+key} type={kind==="url"?"url":"text"} required maxLength={220}
      placeholder={kind==="url"?"https://panel.example.com":undefined} spellCheck={false}
      autoCapitalize="off" autoComplete="off" className={fieldStyle}/></label>)}
   {schema.secret_fields.map(key=><label key={key} className="block text-xs"><KeyRound className="mr-1 inline h-3.5 w-3.5" aria-hidden="true"/>{pretty(key)}
     <input name={"sec_"+key} type="password" required minLength={key==="client_secret"?32:12}
      maxLength={4096} autoComplete="off" spellCheck={false} className={fieldStyle}/></label>)}
   <div className="rounded-lg bg-slate-50 p-3 text-xs text-console-muted">Confirm every credential change with your account password and a fresh six-digit authenticator code. No key will be displayed again, and no connection will be activated automatically.</div>
   <label className="block text-xs">Current account password<input name="confirm_password" type="password" required autoComplete="off" className={fieldStyle}/></label>
   <label className="block text-xs">Fresh authenticator code<input name="totp_code" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" required autoComplete="one-time-code" className={fieldStyle}/></label>
   <button type="submit" disabled={working} className="min-h-11 w-full rounded-lg bg-console-primary px-3 text-sm font-medium text-white disabled:opacity-50">
    {working?"Securing credential…":"Save encrypted connection draft"}</button>
  </form>:null}
  {error?<p role="alert" className="mt-3 text-xs text-rose-700"><ShieldAlert className="mr-1 inline h-4 w-4" aria-hidden="true"/>{error}</p>:null}
  {notice?<p role="status" className="mt-3 flex items-start gap-2 text-xs text-emerald-700"><CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true"/>{notice}</p>:null}
 </section>;
}

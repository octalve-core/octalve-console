"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {api} from "@/lib/api/client";

type Mailbox={address:string;quota_mb:number|null;unlimited:boolean};
type Inventory={resource:string;domain:string;items:Array<Mailbox|string>;verified_at:string;pending_operation:boolean};
type Result={state:"confirmed"|"pending_verification";operation_id:string;address?:string;password_status?:string};
export function NativeHostingResources({serviceId,domain,capabilities}:{serviceId:string;domain:string;capabilities:Record<string,boolean>}){
 const [tab,setTab]=useState<"email"|"subdomains">("email");
 const [data,setData]=useState<Inventory|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [pending,setPending]=useState(false);
 const sequence=useRef(0);
 const selected=tab==="email"&&capabilities.email?"email":capabilities.subdomains?"subdomains":"email";
 const base="/services/opanel/"+encodeURIComponent(serviceId);
 async function load(resource:"email"|"subdomains"=selected){
  const request=++sequence.current;setBusy(true);setError("");setData(null);
  try{
   const result=await api.get<Inventory>(base+"/resources/"+resource+"/");
   if(request!==sequence.current)return;
   if(result.resource!==resource||result.domain!==domain||!Array.isArray(result.items))throw Error("Unexpected resource inventory");
   setData(result);setPending(result.pending_operation===true);
  }catch{if(request===sequence.current)setError("Could not confirm the supplier inventory. Please retry or contact support.")}
  finally{if(request===sequence.current)setBusy(false)}
 }
 useEffect(()=>{
  setPending(false);setNotice("");setError("");setData(null);setTab("email");
  return ()=>{sequence.current++};
 },[serviceId,domain]);
 useEffect(()=>{
  if((selected==="email"&&capabilities.email)||(selected==="subdomains"&&capabilities.subdomains))void load(selected);
  // Do not poll supplier resources on background dashboard refresh.
  return ()=>{sequence.current++};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[serviceId,domain,selected,capabilities.email,capabilities.subdomains]);
 async function create(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy||pending||!capabilities.mailbox_create||selected!=="email")return;
  const form=event.currentTarget,fields=new FormData(form);
  const input={local:String(fields.get("local")||"").toLowerCase(),password:String(fields.get("password")||""),quota_mb:Number(fields.get("quota")),confirm_password:String(fields.get("confirmation")||"")};
  form.reset();setBusy(true);setError("");setNotice("");
  try{
   const result=await api.post<Result>(base+"/mailboxes/create/",input);
   if(result.state==="confirmed"){
    setNotice("Mailbox confirmed by the hosting supplier.");await load("email");
   }else if(result.state==="pending_verification"){
    setPending(true);setNotice("Creation outcome is pending verification. Do not submit again. Use Check pending operation.");
   }else throw Error("Unconfirmed result");
  }catch{
   setError("The mailbox operation could not be confirmed. Check pending operation before retrying.");
   setPending(true);
  }finally{setBusy(false)}
 }
 async function reconcile(){
  if(busy)return;setBusy(true);setNotice("");setError("");
  try{
   const result=await api.post<Result>(base+"/mailboxes/reconcile/",{});
   if(result.state==="confirmed"){
    setPending(false);setNotice("Mailbox existence and quota confirmed. Verify your mailbox password separately.");await load("email");
   }else if(result.state==="pending_verification"){
    setPending(true);setNotice("Still awaiting independent confirmation. No additional mailbox request was sent.");
   }else throw Error("Unconfirmed result");
  }catch{setError("No eligible pending operation could be confirmed. Refresh inventory or contact support.");}
  finally{setBusy(false)}
 }
 if(!capabilities.email&&!capabilities.subdomains)return null;
 return <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-label="Native hosting resources">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <h2 className="text-lg font-medium text-slate-950">Hosting resources</h2>
   <button type="button" disabled={busy} onClick={()=>{setNotice("");void load()}} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium disabled:opacity-50">Refresh</button>
  </div>
  <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Resource type">
   {capabilities.email&&<button type="button" aria-pressed={selected==="email"} onClick={()=>{setTab("email");setNotice("")}} className={"min-h-10 rounded-lg px-3 text-sm "+(selected==="email"?"bg-[#0064E0] text-white":"border border-slate-200")}>Email accounts</button>}
   {capabilities.subdomains&&<button type="button" aria-pressed={selected==="subdomains"} onClick={()=>{setTab("subdomains");setNotice("")}} className={"min-h-10 rounded-lg px-3 text-sm "+(selected==="subdomains"?"bg-[#0064E0] text-white":"border border-slate-200")}>Subdomains</button>}
  </div>
  {busy&&<p role="status" className="mt-4 text-sm text-slate-500">Checking supplier resources…</p>}
  {error&&<p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
  {notice&&<p role="status" className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{notice}</p>}
  {data&&data.resource===selected&&<div className="mt-4">
   {data.items.length===0?<p className="rounded-lg border border-slate-200 p-4 text-sm text-slate-500">No resources returned by the supplier.</p>:<ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
    {data.items.map(item=>typeof item==="string"?<li key={item} className="break-all p-3 text-sm">{item}</li>:<li key={item.address} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><span className="break-all font-medium">{item.address}</span><span className="text-slate-500">{item.unlimited?"Unlimited":item.quota_mb===null?"Unknown":item.quota_mb+" MB"}</span></li>)}
   </ul>}
   <p className="mt-2 text-xs text-slate-500">Verified at {new Date(data.verified_at).toLocaleString()}</p>
  </div>}
  {selected==="email"&&capabilities.mailbox_create&&<form onSubmit={create} autoComplete="off" className="mt-5 space-y-3 border-t border-slate-100 pt-5">
   <h3 className="text-sm font-medium">Create email account</h3>
   <p className="text-xs text-slate-500">Create a real mailbox on your assigned hosting server, not a transactional email sender.</p>
   <label className="block text-sm">Mailbox name<div className="mt-1 flex flex-wrap items-center gap-2"><input name="local" required maxLength={64} pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}" placeholder="sales" className="min-w-0 flex-1 rounded-lg border border-slate-200 p-2"/><span className="break-all text-slate-500">@{domain}</span></div></label>
   <label className="block text-sm">Storage quota (MB)<input name="quota" required type="number" min={1} max={1000000} step={1} defaultValue={500} className="mt-1 w-full rounded-lg border border-slate-200 p-2"/></label>
   <label className="block text-sm">New mailbox password<input name="password" required type="password" minLength={16} maxLength={128} autoComplete="new-password" className="mt-1 w-full rounded-lg border border-slate-200 p-2"/></label>
   <label className="block text-sm">Confirm current Console password<input name="confirmation" required type="password" maxLength={1024} autoComplete="current-password" className="mt-1 w-full rounded-lg border border-slate-200 p-2"/></label>
   <div className="flex flex-wrap gap-2"><button disabled={busy||pending||!data} className="min-h-11 rounded-lg bg-[#0064E0] px-4 text-sm font-medium text-white disabled:opacity-50">Create mailbox</button><button type="button" disabled={busy} onClick={()=>void reconcile()} className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-medium disabled:opacity-50">Check pending operation</button></div>
  </form>}
 </section>
}
